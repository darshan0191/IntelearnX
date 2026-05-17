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
- Be specific — use actual topic names, not vague descriptions.`;

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
