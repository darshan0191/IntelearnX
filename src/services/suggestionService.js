/**
 * Suggestion Service — Aggregates student data across all modules and generates
 * AI-powered personalized improvement suggestions.
 *
 * Data Sources Analyzed:
 *  1. Initial 10 onboarding quizzes
 *  2. PDF Quiz results
 *  3. Teacher Quiz results
 *  4. Take Quiz (library quiz) results
 *  5. Gamification data (XP, level, badges, streak)
 *  6. Learning Path analysis (weak areas, progress)
 *
 * Output Formats:
 *  - Notes (structured text suggestions)
 *  - Video (YouTube embedded + AI-generated conclusion video)
 *  - Visual diagrams (Mermaid-based topic maps)
 */

import { geminiGenerate, geminiGenerateSafe, isGeminiConfigured, isInCooldown } from './openaiClient';
import { getPerformanceData, getQuizHistory, getUserProfile, getUserBadges } from './storageService';
import { domainIdToLabel } from './personalizedQuizService';
import { isIntroQuizNoiseTopic } from './aiService';

// ─── Helpers ───

function stripJsonFence(text) {
  let t = (text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return t;
}

function parseJson(text) {
  const cleaned = stripJsonFence(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Invalid JSON from AI');
  }
}

// ─── Data Aggregation ───

/**
 * Collect and aggregate all student data into a compact analysis object.
 */
export async function aggregateStudentData(userId) {
  const [profile, performance, quizHistory, badges] = await Promise.all([
    getUserProfile(userId),
    getPerformanceData(userId),
    getQuizHistory(userId),
    getUserBadges(userId),
  ]);

  // Separate quiz sources
  const introQuizzes = quizHistory.filter(q =>
    q.source === 'intro' || q.source === 'onboarding' ||
    isIntroQuizNoiseTopic(q.topic, q.subject)
  ).slice(0, 10);

  const pdfQuizzes = quizHistory.filter(q =>
    q.source === 'pdf' || q.quizType === 'pdf' ||
    (q.topic || '').toLowerCase().includes('pdf')
  );

  const teacherQuizzes = quizHistory.filter(q =>
    q.source === 'teacher' || q.quizType === 'teacher' ||
    q.teacherQuizId
  );

  const libraryQuizzes = quizHistory.filter(q =>
    !introQuizzes.includes(q) && !pdfQuizzes.includes(q) && !teacherQuizzes.includes(q)
  );

  // Topic-level analysis
  const topicStats = {};
  quizHistory.forEach(quiz => {
    const key = quiz.topic || quiz.subject || 'General';
    if (isIntroQuizNoiseTopic(key, quiz.subject)) return;
    if (!topicStats[key]) {
      topicStats[key] = { topic: key, subject: quiz.subject || '', correct: 0, total: 0, attempts: 0 };
    }
    topicStats[key].correct += quiz.correctAnswers || 0;
    topicStats[key].total += quiz.totalQuestions || 0;
    topicStats[key].attempts += 1;
  });

  const topicAnalysis = Object.values(topicStats).map(t => ({
    ...t,
    accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0,
  }));

  const weakTopics = topicAnalysis.filter(t => t.accuracy < 60).sort((a, b) => a.accuracy - b.accuracy);
  const mediumTopics = topicAnalysis.filter(t => t.accuracy >= 60 && t.accuracy < 80).sort((a, b) => a.accuracy - b.accuracy);
  const strongTopics = topicAnalysis.filter(t => t.accuracy >= 80).sort((a, b) => b.accuracy - a.accuracy);

  // Gamification analysis
  const gamification = {
    xp: profile?.xp || 0,
    level: profile?.level || 1,
    loginStreak: profile?.loginStreak || 0,
    badges: Array.isArray(badges) ? badges : [],
    badgeCount: Array.isArray(badges) ? badges.length : 0,
  };

  // Learning path context
  const learningPath = {
    prompt: profile?.learningPathPrompt || '',
    progress: profile?.learningPathProgress || null,
    studyKeywords: profile?.studyKeywords || '',
    studyDomainIds: profile?.studyDomainIds || [],
    domainLabels: (profile?.studyDomainIds || []).map(domainIdToLabel),
    onboardingQuizSummary: profile?.onboardingQuizSummary || '',
    introAccuracy: profile?.onboardingIntroAccuracy || null,
  };

  // Difficulty breakdown
  const difficultyStats = performance?.difficultyBreakdown || {};

  return {
    profile,
    performance,
    quizHistory,
    introQuizzes,
    pdfQuizzes,
    teacherQuizzes,
    libraryQuizzes,
    topicAnalysis,
    weakTopics,
    mediumTopics,
    strongTopics,
    gamification,
    learningPath,
    difficultyStats,
    totalQuizzes: quizHistory.length,
    overallAccuracy: performance?.overallAccuracy || 0,
  };
}

// ─── AI Suggestion Generation ───

/**
 * Generate comprehensive, personalized suggestions using Gemini.
 * Returns notes, video recommendations, and diagram data.
 */
export async function generateSuggestions(aggregatedData) {
  // Cache check
  const cacheKey = `suggestion_cache_${aggregatedData.profile?.id || 'unknown'}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed._ts < 10 * 60 * 1000) return parsed.data;
    } catch { /* ignore */ }
  }

  const context = buildPromptContext(aggregatedData);

  if (isGeminiConfigured() && !isInCooldown()) {
    try {
      const result = await generateAISuggestions(context);
      if (result) {
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: result, _ts: Date.now() }));
        return result;
      }
    } catch (e) {
      console.warn('AI suggestion generation failed, using fallback:', e);
    }
  }

  const fallback = buildFallbackSuggestions(aggregatedData);
  sessionStorage.setItem(cacheKey, JSON.stringify({ data: fallback, _ts: Date.now() }));
  return fallback;
}

function buildPromptContext(data) {
  return {
    overallAccuracy: data.overallAccuracy,
    totalQuizzes: data.totalQuizzes,
    weakTopics: data.weakTopics.slice(0, 8).map(t => ({
      topic: t.topic, accuracy: t.accuracy, attempts: t.attempts
    })),
    mediumTopics: data.mediumTopics.slice(0, 5).map(t => ({
      topic: t.topic, accuracy: t.accuracy
    })),
    strongTopics: data.strongTopics.slice(0, 5).map(t => ({
      topic: t.topic, accuracy: t.accuracy
    })),
    introQuizCount: data.introQuizzes.length,
    pdfQuizCount: data.pdfQuizzes.length,
    teacherQuizCount: data.teacherQuizzes.length,
    libraryQuizCount: data.libraryQuizzes.length,
    gamification: data.gamification,
    learningPath: {
      keywords: data.learningPath.studyKeywords,
      domains: data.learningPath.domainLabels,
      introAccuracy: data.learningPath.introAccuracy,
      onboardingSummary: data.learningPath.onboardingQuizSummary,
    },
    difficultyStats: data.difficultyStats,
    recentTrend: (data.performance?.recentTrend || []).slice(-8),
  };
}

async function generateAISuggestions(context) {
  const prompt = `You are an expert AI learning advisor for an engineering student.

STUDENT DATA (JSON):
${JSON.stringify(context)}

TASK:
Analyze all data — quiz results from onboarding, PDF quizzes, teacher quizzes, library quizzes, gamification stats, and learning path — and produce personalized improvement suggestions.

Return ONLY valid JSON (no markdown) with this structure:
{
  "overallAnalysis": "2-3 sentence overview of the student's learning journey and key patterns observed across all modules.",
  "strengthSummary": "1-2 sentences about their strongest areas.",
  "improvementAreas": [
    {
      "topic": "Topic Name",
      "severity": "critical|moderate|minor",
      "currentAccuracy": 45,
      "targetAccuracy": 75,
      "notesSuggestion": {
        "title": "Short note title",
        "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4"],
        "quickTip": "One actionable tip",
        "commonMistakes": ["Mistake 1", "Mistake 2"],
        "practiceStrategy": "How to practice this topic"
      },
      "videoSuggestion": {
        "youtubeSearchQuery": "specific YouTube search query for this topic tutorial",
        "videoTitle": "Descriptive title for the recommended video content",
        "whyWatch": "Why this video helps with the weakness",
        "watchDuration": "15-20 minutes"
      },
      "diagramSuggestion": {
        "title": "Diagram title",
        "description": "What this diagram shows",
        "mermaidCode": "flowchart TD\\n A[Start] --> B[Concept1]\\n B --> C[Concept2]"
      },
      "courseSuggestions": [
        {
          "title": "Course title from the platform",
          "platform": "Udemy|Coursera|NPTEL|edX|MIT OCW",
          "instructor": "Instructor name if known",
          "searchQuery": "exact search query to find this course on the platform",
          "why": "Why this course helps with the weak topic",
          "level": "Beginner|Intermediate|Advanced",
          "isFree": true
        }
      ]
      }
    }
  ],
  "newTopicSuggestions": [
    {
      "topic": "New Topic to Learn",
      "reason": "Why this topic is important based on their current knowledge",
      "prerequisitesMet": true,
      "notesSuggestion": {
        "title": "Introduction to the topic",
        "keyPoints": ["What it is", "Why it matters", "How to start", "First steps"],
        "quickTip": "Best way to begin",
        "commonMistakes": ["Beginner mistake 1"],
        "practiceStrategy": "How to build initial understanding"
      },
      "videoSuggestion": {
        "youtubeSearchQuery": "specific YouTube search for beginners",
        "videoTitle": "Recommended video title",
        "whyWatch": "Why start with this video",
        "watchDuration": "10-15 minutes"
      },
      "diagramSuggestion": {
        "title": "Topic overview diagram",
        "description": "Visual overview of the topic",
        "mermaidCode": "flowchart LR\\n A[Topic] --> B[Sub1]\\n A --> C[Sub2]"
      },
      "courseSuggestions": [
        {
          "title": "Beginner course for the new topic",
          "platform": "Coursera|NPTEL|Udemy",
          "instructor": "Instructor if known",
          "searchQuery": "search query for the course",
          "why": "Why this is a good starting course",
          "level": "Beginner",
          "isFree": true
        }
      ]
      }
    }
  ],
  "gamificationInsight": "1-2 sentences analyzing their XP, streak, and badges — motivational feedback.",
  "weeklyPlan": {
    "summary": "Brief weekly plan summary",
    "days": [
      { "day": "Mon-Tue", "focus": "Topic and activity", "duration": "1-2 hours" },
      { "day": "Wed-Thu", "focus": "Topic and activity", "duration": "1-2 hours" },
      { "day": "Fri-Sat", "focus": "Topic and activity", "duration": "1-2 hours" },
      { "day": "Sun", "focus": "Review and quiz", "duration": "1 hour" }
    ]
  },
  "conclusionVideoScript": {
    "title": "Personalized Study Summary",
    "scenes": [
      { "text": "Scene 1 text — key message about their progress", "duration": 4 },
      { "text": "Scene 2 text — main weakness to address", "duration": 4 },
      { "text": "Scene 3 text — recommended action steps", "duration": 5 },
      { "text": "Scene 4 text — motivational closing message", "duration": 4 }
    ]
  }
}

RULES:
- "improvementAreas" should have 3-6 items, sorted by severity (critical first).
- "newTopicSuggestions" should have 2-3 items — topics they haven't studied but should, based on their domain and current knowledge.
- Mermaid diagrams must use simple ASCII labels, no quotes inside brackets, use \\n for newlines.
- YouTube search queries should be specific and include "tutorial" or "explained".
- The conclusionVideoScript should have 4-6 scenes, each 3-6 seconds.
- All suggestions must be engineering-related.
- Be specific — use actual topic names, not vague descriptions.
- Each "courseSuggestions" array should have 2-3 courses from different platforms (Udemy, Coursera, NPTEL, edX, MIT OCW).
- For NPTEL courses, use real NPTEL course names when possible (e.g. "Data Structures and Algorithms" by Prof. Naveen Garg, IIT Delhi).
- For Coursera, prefer well-known university courses (Stanford, Princeton, University of Michigan, etc.).
- "searchQuery" should be the exact text to search on that platform to find the course.
- Set "isFree" to true for NPTEL, MIT OCW, and free Coursera/edX courses.`;

  const responseText = await geminiGenerate(prompt, {
    temperature: 0.4,
    maxOutputTokens: 8192,
    useCache: false,
  });

  if (!responseText) return null;

  const data = parseJson(responseText);

  // Validate structure
  if (!data.improvementAreas || !Array.isArray(data.improvementAreas)) return null;

  return {
    ...data,
    source: 'gemini',
  };
}

function buildFallbackSuggestions(aggregatedData) {
  const { weakTopics, mediumTopics, strongTopics, gamification, learningPath, overallAccuracy } = aggregatedData;

  const improvementAreas = weakTopics.slice(0, 5).map(t => ({
    topic: t.topic,
    severity: t.accuracy < 30 ? 'critical' : t.accuracy < 50 ? 'moderate' : 'minor',
    currentAccuracy: t.accuracy,
    targetAccuracy: Math.min(t.accuracy + 25, 90),
    notesSuggestion: {
      title: `Strengthen: ${t.topic}`,
      keyPoints: [
        `Current accuracy: ${t.accuracy}% — needs focused review`,
        'Revisit fundamental concepts and definitions',
        'Practice with progressively harder problems',
        'Use spaced repetition for long-term retention',
      ],
      quickTip: 'Start with the basics and build up systematically',
      commonMistakes: ['Rushing through without understanding fundamentals', 'Not practicing enough variations'],
      practiceStrategy: `Take 2-3 quizzes on ${t.topic} this week, review wrong answers immediately`,
    },
    videoSuggestion: {
      youtubeSearchQuery: `${t.topic} tutorial for beginners explained`,
      videoTitle: `${t.topic} — Complete Guide`,
      whyWatch: `Your accuracy is ${t.accuracy}%, this will help build a solid foundation`,
      watchDuration: '15-25 minutes',
    },
    diagramSuggestion: {
      title: `${t.topic} Concept Map`,
      description: `Key concepts and relationships in ${t.topic}`,
      mermaidCode: `flowchart TD\n  A[${t.topic}] --> B[Core Concepts]\n  A --> C[Practice]\n  B --> D[Theory]\n  B --> E[Applications]\n  C --> F[Easy Problems]\n  C --> G[Medium Problems]`,
    },
    courseSuggestions: getCoursesForTopic(t.topic),
  }));

  const newTopicSuggestions = [
    {
      topic: learningPath.keywords || 'Advanced Problem Solving',
      reason: 'Based on your learning path and current progress, this will help you advance further.',
      prerequisitesMet: true,
      notesSuggestion: {
        title: `Explore: ${learningPath.keywords || 'Advanced Problem Solving'}`,
        keyPoints: ['Builds on your existing knowledge', 'Important for career growth', 'Start with fundamentals', 'Practice regularly'],
        quickTip: 'Begin with a YouTube tutorial to get the big picture',
        commonMistakes: ['Skipping prerequisites'],
        practiceStrategy: 'Dedicate 30 minutes daily to this new topic',
      },
      videoSuggestion: {
        youtubeSearchQuery: `${learningPath.keywords || 'engineering problem solving'} complete tutorial`,
        videoTitle: `Introduction to ${learningPath.keywords || 'Advanced Topics'}`,
        whyWatch: 'Great starting point for expanding your knowledge',
        watchDuration: '20-30 minutes',
      },
      diagramSuggestion: {
        title: 'Learning Roadmap',
        description: 'Your suggested learning path forward',
        mermaidCode: 'flowchart LR\n  A[Current Knowledge] --> B[New Concepts]\n  B --> C[Practice]\n  C --> D[Mastery]',
      },
      courseSuggestions: getCoursesForTopic(learningPath.keywords || 'Engineering'),
    },
  ];

  return {
    overallAnalysis: overallAccuracy > 70
      ? `Great progress! With ${overallAccuracy}% overall accuracy across ${aggregatedData.totalQuizzes} quizzes, you have a solid foundation. Focus on weak spots to push even higher.`
      : `You have completed ${aggregatedData.totalQuizzes} quizzes with ${overallAccuracy}% accuracy. Consistent practice on weak topics will help you improve significantly.`,
    strengthSummary: strongTopics.length > 0
      ? `You excel in ${strongTopics.slice(0, 3).map(t => t.topic).join(', ')} — keep challenging yourself with harder questions!`
      : 'Keep taking quizzes to discover and build your strengths!',
    improvementAreas,
    newTopicSuggestions,
    gamificationInsight: `Level ${gamification.level} with ${gamification.xp} XP and a ${gamification.loginStreak}-day streak. ${gamification.loginStreak >= 3 ? 'Amazing consistency!' : 'Try to maintain a daily streak for better retention.'}`,
    weeklyPlan: {
      summary: 'Focus on your weakest topics first, then explore new areas.',
      days: [
        { day: 'Mon-Tue', focus: weakTopics[0]?.topic || 'Core concepts review', duration: '1-2 hours' },
        { day: 'Wed-Thu', focus: weakTopics[1]?.topic || 'Practice problems', duration: '1-2 hours' },
        { day: 'Fri-Sat', focus: mediumTopics[0]?.topic || 'Advanced topics', duration: '1-2 hours' },
        { day: 'Sun', focus: 'Review and quiz assessment', duration: '1 hour' },
      ],
    },
    conclusionVideoScript: {
      title: 'Your Personalized Study Summary',
      scenes: [
        { text: `You've completed ${aggregatedData.totalQuizzes} quizzes with ${overallAccuracy}% accuracy. Let's see how to improve!`, duration: 5 },
        { text: weakTopics.length > 0 ? `Focus area: ${weakTopics[0].topic} at ${weakTopics[0].accuracy}% — needs your attention this week.` : 'All topics looking solid! Time to explore new areas.', duration: 5 },
        { text: 'Strategy: Take targeted quizzes, watch recommended videos, and review notes daily.', duration: 5 },
        { text: 'You got this! Consistent effort leads to mastery. Keep your streak going! 🚀', duration: 4 },
      ],
    },
    source: 'fallback',
  };
}

// ─── Course Platform Utilities ───

/** Curated course bank keyed by broad topic area. */
const COURSE_BANK = {
  'Data Structures': [
    { title: 'Data Structures and Algorithms', platform: 'NPTEL', instructor: 'Prof. Naveen Garg, IIT Delhi', searchQuery: 'NPTEL Data Structures and Algorithms', why: 'Comprehensive IIT-level coverage of all core data structures', level: 'Intermediate', isFree: true },
    { title: 'Algorithms Specialization', platform: 'Coursera', instructor: 'Tim Roughgarden, Stanford', searchQuery: 'Coursera Algorithms Stanford', why: 'World-class Stanford course covering algorithm design paradigms', level: 'Intermediate', isFree: false },
    { title: 'Mastering Data Structures & Algorithms using C and C++', platform: 'Udemy', instructor: 'Abdul Bari', searchQuery: 'Udemy Abdul Bari Data Structures', why: 'Highly rated practical course with animations and examples', level: 'Beginner', isFree: false },
  ],
  'Algorithms': [
    { title: 'Design and Analysis of Algorithms', platform: 'NPTEL', instructor: 'Prof. Madhavan Mukund, CMI', searchQuery: 'NPTEL Design Analysis Algorithms', why: 'Rigorous algorithm analysis from a top Indian institution', level: 'Intermediate', isFree: true },
    { title: 'Algorithms, Part I & II', platform: 'Coursera', instructor: 'Robert Sedgewick, Princeton', searchQuery: 'Coursera Algorithms Princeton Sedgewick', why: 'Classic Princeton course with excellent visualizations', level: 'Intermediate', isFree: false },
    { title: 'Introduction to Algorithms', platform: 'MIT OCW', instructor: 'MIT 6.006', searchQuery: 'MIT OCW 6.006 Introduction to Algorithms', why: 'MIT\'s legendary algorithms course — free and rigorous', level: 'Advanced', isFree: true },
  ],
  'Database': [
    { title: 'Database Management System', platform: 'NPTEL', instructor: 'Prof. Partha Pratim Das, IIT Kharagpur', searchQuery: 'NPTEL Database Management System', why: 'Complete DBMS course from IIT with SQL and normalization', level: 'Intermediate', isFree: true },
    { title: 'Databases and SQL for Data Science', platform: 'Coursera', instructor: 'IBM', searchQuery: 'Coursera Databases SQL IBM', why: 'Practical SQL skills with hands-on labs from IBM', level: 'Beginner', isFree: false },
    { title: 'The Complete SQL Bootcamp', platform: 'Udemy', instructor: 'Jose Portilla', searchQuery: 'Udemy Complete SQL Bootcamp Jose Portilla', why: 'Best-selling practical SQL course with real-world exercises', level: 'Beginner', isFree: false },
  ],
  'Operating Systems': [
    { title: 'Introduction to Operating Systems', platform: 'NPTEL', instructor: 'Prof. Chester Rebeiro, IIT Madras', searchQuery: 'NPTEL Introduction Operating Systems', why: 'Covers processes, scheduling, memory management — IIT quality', level: 'Intermediate', isFree: true },
    { title: 'Operating Systems: Three Easy Pieces', platform: 'edX', instructor: 'University of Wisconsin', searchQuery: 'edX Operating Systems Three Easy Pieces', why: 'Based on the popular OSTEP textbook — concurrency and persistence', level: 'Intermediate', isFree: true },
    { title: 'Operating Systems and System Programming', platform: 'MIT OCW', instructor: 'MIT 6.828', searchQuery: 'MIT OCW 6.828 Operating Systems', why: 'Deep dive into OS internals from MIT', level: 'Advanced', isFree: true },
  ],
  'Computer Networks': [
    { title: 'Computer Networks', platform: 'NPTEL', instructor: 'Prof. Sujoy Ghosh, IIT Kharagpur', searchQuery: 'NPTEL Computer Networks', why: 'Covers TCP/IP, routing, and network protocols in depth', level: 'Intermediate', isFree: true },
    { title: 'The Bits and Bytes of Computer Networking', platform: 'Coursera', instructor: 'Google', searchQuery: 'Coursera Computer Networking Google', why: 'Google\'s practical networking course — beginner-friendly', level: 'Beginner', isFree: false },
    { title: 'Computer Networking: A Top-Down Approach', platform: 'Udemy', instructor: 'Based on Kurose/Ross textbook', searchQuery: 'Udemy Computer Networking top down', why: 'Application-layer-first approach — very intuitive', level: 'Beginner', isFree: false },
  ],
  'Machine Learning': [
    { title: 'Machine Learning', platform: 'Coursera', instructor: 'Andrew Ng, Stanford', searchQuery: 'Coursera Machine Learning Andrew Ng', why: 'The gold standard ML course by Andrew Ng — legendary', level: 'Beginner', isFree: false },
    { title: 'Introduction to Machine Learning', platform: 'NPTEL', instructor: 'Prof. Sudeshna Sarkar, IIT Kharagpur', searchQuery: 'NPTEL Machine Learning Sudeshna Sarkar', why: 'Comprehensive ML course covering regression to deep learning', level: 'Intermediate', isFree: true },
    { title: 'Machine Learning A-Z', platform: 'Udemy', instructor: 'Kirill Eremenko', searchQuery: 'Udemy Machine Learning A-Z', why: 'Hands-on ML with Python and R — great for practical skills', level: 'Beginner', isFree: false },
  ],
  'Programming': [
    { title: 'Programming, Data Structures and Algorithms Using Python', platform: 'NPTEL', instructor: 'Prof. Madhavan Mukund, CMI', searchQuery: 'NPTEL Programming Python Madhavan Mukund', why: 'Combines programming fundamentals with algorithmic thinking', level: 'Beginner', isFree: true },
    { title: 'Python for Everybody Specialization', platform: 'Coursera', instructor: 'Dr. Charles Severance, U-Michigan', searchQuery: 'Coursera Python for Everybody', why: 'One of the most popular beginner programming courses worldwide', level: 'Beginner', isFree: false },
    { title: 'CS50: Introduction to Computer Science', platform: 'edX', instructor: 'David Malan, Harvard', searchQuery: 'edX CS50 Harvard', why: 'Harvard\'s iconic CS intro course — engaging and rigorous', level: 'Beginner', isFree: true },
  ],
  'Web Development': [
    { title: 'The Complete Web Developer Course', platform: 'Udemy', instructor: 'Dr. Angela Yu', searchQuery: 'Udemy Complete Web Developer Angela Yu', why: 'Full-stack web development — HTML, CSS, JS, React, Node', level: 'Beginner', isFree: false },
    { title: 'Full-Stack Web Development with React', platform: 'Coursera', instructor: 'HKUST', searchQuery: 'Coursera Full Stack React HKUST', why: 'React-focused full-stack course from Hong Kong UST', level: 'Intermediate', isFree: false },
    { title: 'Web Development', platform: 'MIT OCW', instructor: 'MIT 6.148', searchQuery: 'MIT OCW web development', why: 'MIT\'s web development fundamentals — free and structured', level: 'Beginner', isFree: true },
  ],
  'Software Engineering': [
    { title: 'Software Engineering', platform: 'NPTEL', instructor: 'Prof. Rajib Mall, IIT Kharagpur', searchQuery: 'NPTEL Software Engineering Rajib Mall', why: 'Complete SE lifecycle — SDLC, testing, design patterns', level: 'Intermediate', isFree: true },
    { title: 'Software Design and Architecture', platform: 'Coursera', instructor: 'University of Alberta', searchQuery: 'Coursera Software Design Architecture Alberta', why: 'Covers design patterns, architecture styles, and UML', level: 'Intermediate', isFree: false },
    { title: 'Software Engineering Essentials', platform: 'edX', instructor: 'TU Munich', searchQuery: 'edX Software Engineering Essentials TU Munich', why: 'Practical SE with agile methods and modern tools', level: 'Beginner', isFree: true },
  ],
  'Electronics': [
    { title: 'Analog Electronic Circuits', platform: 'NPTEL', instructor: 'Prof. Pradip Mandal, IIT Kharagpur', searchQuery: 'NPTEL Analog Electronics', why: 'Covers BJT, MOSFET, op-amps — essential for ECE', level: 'Intermediate', isFree: true },
    { title: 'Circuits and Electronics', platform: 'edX', instructor: 'MIT 6.002', searchQuery: 'edX Circuits Electronics MIT', why: 'MIT\'s foundational electronics course — well structured', level: 'Beginner', isFree: true },
    { title: 'Master Analog Electronics', platform: 'Udemy', instructor: 'Various', searchQuery: 'Udemy Analog Electronics complete course', why: 'Practical analog circuit design and analysis', level: 'Beginner', isFree: false },
  ],
  'default': [
    { title: 'Problem Solving Through Programming in C', platform: 'NPTEL', instructor: 'Prof. Anupam Basu, IIT Kharagpur', searchQuery: 'NPTEL Problem Solving Programming C', why: 'Strong foundation in programming logic and problem solving', level: 'Beginner', isFree: true },
    { title: 'Learning How to Learn', platform: 'Coursera', instructor: 'Dr. Barbara Oakley, McMaster University', searchQuery: 'Coursera Learning How to Learn', why: 'Meta-learning skills that boost performance in any subject', level: 'Beginner', isFree: true },
    { title: 'Engineering Mathematics', platform: 'NPTEL', instructor: 'Prof. Jitender Kumar, IIT Kharagpur', searchQuery: 'NPTEL Engineering Mathematics', why: 'Core math skills needed across all engineering domains', level: 'Beginner', isFree: true },
  ],
};

/** Match a topic string to the best course bank key. */
function matchCourseBankKey(topic) {
  const t = (topic || '').toLowerCase();
  const mappings = [
    { keys: ['data structure', 'dsa', 'linked list', 'stack', 'queue', 'tree', 'heap', 'array', 'hashing'], bank: 'Data Structures' },
    { keys: ['algorithm', 'sorting', 'searching', 'dynamic programming', 'greedy', 'graph', 'bfs', 'dfs', 'complexity'], bank: 'Algorithms' },
    { keys: ['database', 'dbms', 'sql', 'normalization', 'relational', 'nosql', 'query'], bank: 'Database' },
    { keys: ['operating system', 'process', 'scheduling', 'deadlock', 'memory management', 'paging'], bank: 'Operating Systems' },
    { keys: ['network', 'tcp', 'ip', 'routing', 'osi', 'http', 'dns', 'socket'], bank: 'Computer Networks' },
    { keys: ['machine learning', 'ml', 'deep learning', 'neural', 'regression', 'classification', 'ai', 'artificial intelligence'], bank: 'Machine Learning' },
    { keys: ['programming', 'python', 'java', 'c++', 'coding', 'oop', 'object oriented'], bank: 'Programming' },
    { keys: ['web', 'html', 'css', 'javascript', 'react', 'node', 'frontend', 'backend', 'full stack'], bank: 'Web Development' },
    { keys: ['software engineering', 'sdlc', 'testing', 'design pattern', 'agile', 'devops', 'uml'], bank: 'Software Engineering' },
    { keys: ['electronics', 'circuit', 'vlsi', 'embedded', 'signal', 'analog', 'digital', 'ece', 'semiconductor'], bank: 'Electronics' },
  ];
  for (const m of mappings) {
    if (m.keys.some(k => t.includes(k))) return m.bank;
  }
  return 'default';
}

/** Get curated courses for a topic from the bank. */
function getCoursesForTopic(topic) {
  const key = matchCourseBankKey(topic);
  return (COURSE_BANK[key] || COURSE_BANK['default']).slice(0, 3);
}

/** Build a search URL for a specific platform. */
export function getCourseSearchUrl(platform, query) {
  const q = encodeURIComponent(query);
  switch ((platform || '').toLowerCase()) {
    case 'udemy': return `https://www.udemy.com/courses/search/?q=${q}`;
    case 'coursera': return `https://www.coursera.org/search?query=${q}`;
    case 'nptel': return `https://nptel.ac.in/courses?q=${q}`;
    case 'edx': return `https://www.edx.org/search?q=${q}`;
    case 'mit ocw': return `https://ocw.mit.edu/search/?q=${q}`;
    default: return `https://www.google.com/search?q=${q}+course`;
  }
}

/** Get platform logo/icon emoji. */
export function getPlatformIcon(platform) {
  switch ((platform || '').toLowerCase()) {
    case 'udemy': return '🟣';
    case 'coursera': return '🔵';
    case 'nptel': return '🟠';
    case 'edx': return '🔴';
    case 'mit ocw': return '🔶';
    default: return '📚';
  }
}

// ─── YouTube Utilities ───

/**
 * Extract YouTube video ID from a URL.
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Build a YouTube embed URL from a video ID.
 */
export function youtubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0`;
}

/**
 * Build a YouTube search URL.
 */
export function youtubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/**
 * Search YouTube via the oEmbed/data API (returns search URL for embedding).
 * For actual video playback, we use YouTube IFrame API with search query.
 */
export function getYouTubeSearchEmbedUrl(query) {
  // Use YouTube's embed search results
  return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}`;
}
