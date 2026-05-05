// AI Service for Topic Explanation and Adaptive Learning Path
// Learning path: Gemini first (VITE_GEMINI_API_KEY), then Claude (VITE_CLAUDE_API_KEY)
// Set keys in .env as needed
//
// Qdrant Integration:
//  - Searches quiz_knowledge for relevant content when building learning paths
//  - Provides focused vector-matched context to reduce token usage and improve accuracy
//  - Stores topic explanations for future semantic retrieval

import {
  isVectorDbConfigured,
  retrieveContext,
  searchQuizKnowledge,
  storeQuizKnowledge,
} from './vectorService';
import { validateEngineeringDomain, OUT_OF_DOMAIN_SHORT } from '../utils/engineeringDomainGuard';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_URL = `${GEMINI_BASE}/gemini-2.5-flash:generateContent`;
const GEMINI_FALLBACK_URL = `${GEMINI_BASE}/gemini-2.5-flash-lite:generateContent`;

const getClaudeApiKey = () => import.meta.env.VITE_CLAUDE_API_KEY || '';

/**
 * Call Gemini with automatic retry + fallback model on 503 (overloaded).
 * Tries gemini-2.5-flash first, then gemini-2.5-flash-lite.
 */
async function geminiGenerate(body, retries = 2) {
  const urls = [GEMINI_URL, GEMINI_FALLBACK_URL];
  for (const url of urls) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(`${url}?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (response.ok) return response;

        if (response.status === 429) {
          sessionStorage.setItem('gemini_rate_limit_expiry', String(Date.now() + 60000));
          throw new Error('Rate limit hit (429). Please wait 60 seconds.');
        }

        if (response.status === 503) {
          const waitMs = (attempt + 1) * 3000;
          console.warn(`Gemini 503 (overloaded) on ${url}, retrying in ${waitMs}ms…`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        // Other errors — parse and throw
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Gemini error ${response.status}`);
      } catch (e) {
        if (e.message.includes('429')) throw e;
        if (attempt === retries - 1 && url === GEMINI_FALLBACK_URL) throw e;
        if (e.message.includes('Failed to fetch')) {
          console.warn('Network error calling Gemini, will try fallback…');
          break; // Skip retries on this URL, try fallback
        }
      }
    }
  }
  throw new Error('All Gemini models are currently unavailable. Please try again later.');
}

function stripJsonFence(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:\w+)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return t;
}

/** Onboarding / first quiz rows pollute topic stats with this label — exclude from learning-path context. */
const INTRO_QUIZ_NOISE = /personalized quiz|^personalized study$/i;

export function isIntroQuizNoiseTopic(topic, subject) {
  const t = String(topic || '');
  const s = String(subject || '');
  return INTRO_QUIZ_NOISE.test(t) || s.trim().toLowerCase() === 'personalized study';
}

export function filterLearningPathWeakAreas(weakAreas) {
  return (weakAreas || []).filter((w) => !isIntroQuizNoiseTopic(w.topic, w.subject));
}

export function filterLearningPathQuizHistory(quizHistory) {
  return (quizHistory || []).filter((q) => !isIntroQuizNoiseTopic(q.topic, q.subject));
}

/** What the 7-day plan should be about — prompt wins, then first keyword, then domain. */
export function resolvePrimaryStudyTopic(context = {}) {
  const prompt = String(context.userPrompt || '').trim();
  if (prompt) return prompt.split(/[,;\n]/)[0].trim().slice(0, 120);
  const kw = String(context.studyKeywords || '').trim();
  if (kw) {
    const first = kw.split(/[,;•]/).map((x) => x.trim()).filter(Boolean)[0];
    if (first) return first.slice(0, 120);
  }
  const labels = context.domainLabels;
  if (Array.isArray(labels) && labels.length) return String(labels[0]).slice(0, 120);
  return '';
}

/**
 * Generate a personalized explanation for a wrongly answered question
 */
export async function getTopicExplanation(question, userAnswer, correctAnswer, topic) {
  const apiKey = getClaudeApiKey();
  
  // If no API key, use built-in explanation
  if (!apiKey) {
    return getFallbackExplanation(question, correctAnswer, topic);
  }

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `A student answered a ${topic} question incorrectly. 
            
Question: ${question}
Student's Answer: ${userAnswer}
Correct Answer: ${correctAnswer}

Please provide a brief, encouraging explanation (2-3 sentences) that:
1. Explains why the correct answer is right
2. Addresses the misconception behind their wrong answer
3. Gives a quick tip to remember the concept

Keep it concise and student-friendly.`
          }
        ]
      })
    });

    if (!response.ok) throw new Error('API request failed');
    
    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error('AI Explanation error:', error);
    return getFallbackExplanation(question, correctAnswer, topic);
  }
}

function buildLearningPathJsonPrompt(weakAreas, quizHistory, currentLevel, context = {}) {
  const {
    userPrompt = '',
    studyDomainIds = [],
    studyKeywords = '',
    onboardingQuizSummary = '',
    onboardingIntroAccuracy = null,
    domainLabels = [],
    performanceSnapshot = null,
  } = context;

  const primaryTopic = resolvePrimaryStudyTopic(context) || 'the student’s focus topic';

  const domainLine = studyDomainIds.length
    ? `Student-chosen domain IDs: ${studyDomainIds.join(', ')}.\n`
    : '';
  const domainHuman =
    domainLabels.length > 0
      ? `Domain themes from onboarding: ${domainLabels.join(', ')}.\n`
      : '';
  const keywordsLine = studyKeywords
    ? `Onboarding keywords string: ${studyKeywords}\n`
    : '';

  const onboardingLine = onboardingQuizSummary
    ? `First onboarding quiz note: ${onboardingQuizSummary}\n`
    : '';

  const introAccLine =
    typeof onboardingIntroAccuracy === 'number'
      ? `Onboarding quiz score: ~${onboardingIntroAccuracy}% correct.\n`
      : '';

  const userAsk = userPrompt.trim()
    ? `Student typed this in the roadmap box (highest priority): "${userPrompt.trim()}"\n`
    : '';

  const perfBlock =
    performanceSnapshot && typeof performanceSnapshot === 'object'
      ? `Library quiz performance (JSON — use to adjust difficulty and emphasis; ignore noise topic names):\n${JSON.stringify(performanceSnapshot)}\n`
      : '';

  return `You are an expert tutor. Output STRICT JSON only (no markdown, no text before/after).

PRIMARY_TOPIC (the 7-day plan MUST teach THIS in order — e.g. if "DSA", use a standard CS sequence: complexity → arrays → linked lists → stacks/queues → trees → graphs/heaps → revision; adapt similarly for JEE, NEET, CA, etc.):
"${primaryTopic}"

STUDENT CONTEXT:
${onboardingLine}${introAccLine}${domainLine}${domainHuman}${keywordsLine}${userAsk}${perfBlock}Weak library topics (<70%, excluding onboarding noise): ${JSON.stringify(weakAreas)}
Recent real quiz rows: ${JSON.stringify(
    quizHistory.slice(-10).map((q) => ({
      topic: q.topic,
      subject: q.subject,
      accuracy: q.accuracy,
      correct: q.correctAnswers,
      total: q.totalQuestions,
    })),
  )}
App level: ${currentLevel}

Return ONE JSON object:

{
  "primaryTopic": "repeat PRIMARY_TOPIC verbatim",
  "summary": "2-4 sentences: what they will know after 7 days.",
  "diagramDescription": "One sentence: linear 7-day roadmap for PRIMARY_TOPIC.",
  "diagramMermaid": "Mermaid flowchart LR with EXACTLY 7 nodes D1 to D7 labeled Day1..Day7 (short), arrows D1-->D2-->D3-->D4-->D5-->D6-->D7. Use simple ASCII labels only, no quotes inside brackets.",
  "sevenDayPlan": [
    {
      "day": 1,
      "title": "Day 1 — short subtitle for PRIMARY_TOPIC",
      "timeEstimate": "e.g. 2–3 hours total",
      "overview": "What to study today, why it comes first in the sequence.",
      "studySequence": [
        "First (45 min): …",
        "Then (30 min): …",
        "Last (15 min): …"
      ],
      "subtopics": [
        {
          "name": "Concrete micro-topic name",
          "detail": "What to read/practice and how to verify you got it.",
          "youtubeUrl": "",
          "youtubeSearchQuery": "specific YouTube search, e.g. PRIMARY_TOPIC subtopic tutorial hindi"
        }
      ],
      "actions": ["Optional checklist"]
    }
  ],
  "funChallenge": "One small challenge tied to PRIMARY_TOPIC.",
  "quizReminder": "How to use IntelearnX quizzes to check progress."
}

RULES:
- "sevenDayPlan" MUST have exactly 7 objects with "day" 1..7 and titles starting "Day 1 —", "Day 2 —", … "Day 7 —".
- Each day: at least 2 "subtopics", each with rich "detail" AND a useful "youtubeSearchQuery" for that day’s concepts (language agnostic unless context implies one). Prefer real "youtubeUrl" only when certain; else "".
- "studySequence" MUST list the order of study blocks that day (3–5 strings with time hints).
- Never use the phrase "Your personalized quiz" or generic onboarding labels as topic names — always real subject matter tied to PRIMARY_TOPIC.
- Connect harder days to weak library topics when performance JSON shows gaps; otherwise follow the canonical learning sequence for PRIMARY_TOPIC.
- IMPORTANT: You are strictly an engineering tutor. The PRIMARY_TOPIC MUST be an engineering subject (CS, ECE, Mechanical, Civil, Chemical, Aerospace, etc.). If the topic is clearly non-engineering (e.g. cooking, history, art, law, medicine) respond with: {"error":"out_of_domain","message":"${OUT_OF_DOMAIN_SHORT}"}.`;
}

/** Compact rollup for Gemini / Claude prompts (all prior quiz performance). */
export function compactPerformanceForLearningPath(performance) {
  if (!performance || typeof performance !== 'object') return null;
  const subjectSummary = Object.entries(performance.subjectAccuracy || {})
    .map(([subject, v]) => ({
      subject,
      n: v.total,
      pct: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
    }))
    .filter((x) => x.n > 0)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 14);

  const weakAreas = (performance.weakAreas || []).filter((w) => !isIntroQuizNoiseTopic(w.topic, ''));
  const strongAreas = (performance.strongAreas || []).filter((w) => !isIntroQuizNoiseTopic(w.topic, ''));

  return {
    overallAccuracy: performance.overallAccuracy,
    totalQuizzes: performance.totalQuizzes,
    totalQuestions: performance.totalQuestions,
    totalCorrect: performance.totalCorrect,
    domainPerformance: (performance.domainPerformance || []).slice(0, 10),
    domainWeakAreas: (performance.domainWeakAreas || []).slice(0, 8),
    subjectSummary: subjectSummary.filter((x) => x.subject && !/^personalized study$/i.test(x.subject)),
    difficultyBreakdown: performance.difficultyBreakdown || {},
    recentTrend: (performance.recentTrend || []).slice(-10),
    weakTopicLabels: weakAreas.slice(0, 12).map((w) => w.topic),
    strongTopicLabels: strongAreas.slice(0, 8).map((w) => w.topic),
  };
}

/**
 * @param {object} context - userPrompt, studyDomainIds, studyKeywords, onboardingQuizSummary, onboardingIntroAccuracy, domainLabels, performanceSnapshot
 */
export async function getAdaptiveLearningPath(weakAreas, quizHistory, currentLevel, context = {}) {
  // ── Engineering domain gate (check user prompt if present) ──
  const userPrompt = (context.userPrompt || '').trim();
  if (userPrompt) {
    const { isEngineering } = validateEngineeringDomain(userPrompt);
    if (!isEngineering) {
      return JSON.stringify({ error: 'out_of_domain', message: OUT_OF_DOMAIN_SHORT });
    }
  }

  const weakF = filterLearningPathWeakAreas(weakAreas);
  const histF = filterLearningPathQuizHistory(quizHistory);
  const claudeKey = getClaudeApiKey();

  // ── Qdrant Enhancement: retrieve relevant past knowledge for weak areas ──
  let vectorContext = '';
  if (isVectorDbConfigured() && weakF.length > 0) {
    try {
      const weakTopicQuery = weakF.slice(0, 3).map((w) => w.topic).join(', ');
      const relevantKnowledge = await searchQuizKnowledge(weakTopicQuery, null, 6);
      if (relevantKnowledge.length > 0) {
        vectorContext = '\n\nRELEVANT PAST QUIZ KNOWLEDGE (from vector DB — weave into plan where applicable):\n' +
          relevantKnowledge.map((k) =>
            `- [${k.topic}] Q: ${k.question} → A: ${k.correctAnswer} (${k.explanation})`
          ).join('\n');
      }
    } catch (e) {
      console.warn('Vector context retrieval failed (non-critical):', e.message);
    }
  }

  const userMessage = buildLearningPathJsonPrompt(weakF, histF, currentLevel, context) + vectorContext;

  const expiry = sessionStorage.getItem('gemini_rate_limit_expiry');
  const isGeminiBlocked = expiry && Date.now() < parseInt(expiry, 10);

  if (GEMINI_API_KEY && !isGeminiBlocked) {
    const tries = [
      { temperature: 0.35, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      { temperature: 0.35, maxOutputTokens: 8192 },
    ];
    for (const gen of tries) {
      try {
        const response = await geminiGenerate({
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: gen,
        });

        const result = await response.json();
        const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        const cleaned = text ? stripJsonFence(text) : '';
        if (cleaned.length > 80) return cleaned;
        throw new Error('Empty Gemini roadmap');
      } catch (error) {
        console.warn('Gemini learning path attempt failed:', error?.message || error);
      }
    }
  }

  if (claudeKey) {
    try {
      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      if (!response.ok) throw new Error('API request failed');

      const data = await response.json();
      return data.content[0].text;
    } catch (error) {
      console.error('Claude learning path error:', error);
    }
  }

  return getFallbackLearningPath(weakF, context);
}

/**
 * Fallback explanation when API is not available
 */
function getFallbackExplanation(question, correctAnswer, topic) {
  return `The correct answer is "${correctAnswer}". This is a key concept in ${topic}. ` +
    `Review this topic carefully and try to understand the underlying principle. ` +
    `Practice similar problems to strengthen your understanding! 💪`;
}

function dayBlock(focus, dayNum, titleSuffix, overview, seq, subs, actions = []) {
  return {
    day: dayNum,
    title: `Day ${dayNum} — ${focus}: ${titleSuffix}`,
    timeEstimate: '2–3 hours (adjust to your pace)',
    overview,
    studySequence: seq,
    subtopics: subs.map((s) => ({
      name: s.name,
      detail: s.detail,
      youtubeUrl: '',
      youtubeSearchQuery: s.q,
    })),
    actions,
  };
}

function buildOfflineSevenDayPlan(focus, sortedWeak, ctx) {
  const { studyKeywords = '', userPrompt = '' } = ctx;
  const isDsa = /dsa|data structure|algorithm|leetcode|cp |competitive programming/i.test(focus);
  const weakLine =
    sortedWeak.length > 0
      ? `Spend extra time on weak areas: ${sortedWeak
          .slice(0, 3)
          .map((w) => `${w.topic} (~${w.accuracy}%)`)
          .join(', ')}.`
      : '';

  if (isDsa) {
    return [
      dayBlock(focus, 1, 'Big-O, arrays & strings', `Map the DSA roadmap; nail complexity intuition and array/string patterns. ${weakLine}`, [
        '20 min: skim syllabus; list 5 goals for the week.',
        '40 min: Big-O cheatsheet — compare sorting and search costs.',
        '45 min: two-pointer & sliding window on arrays; solve 3 tiny problems.',
        '15 min: log mistakes in one page.',
      ], [
        {
          name: 'Asymptotic notation',
          detail: 'Understand best/average/worst; relate to real loop structures.',
          q: `${focus} time complexity big O explained tutorial`,
        },
        {
          name: 'Array patterns',
          detail: 'Two pointers from both ends; sliding window for subarrays.',
          q: `two pointer sliding window array ${focus} tutorial`,
        },
      ]),
      dayBlock(focus, 2, 'Linked lists', 'Master singly/doubly lists, cycles, merges.', [
        '30 min: visualize pointer updates on paper.',
        '50 min: implement reverse, detect cycle (Floyd).',
        '40 min: merge two sorted lists step-by-step.',
      ], [
        { name: 'List basics', detail: 'Dummy head trick; always draw before coding.', q: `linked list for beginners ${focus}` },
        { name: 'Cycle detection', detail: 'Tortoise-hare — why it works.', q: `Floyd cycle detection linked list` },
      ]),
      dayBlock(focus, 3, 'Stacks, queues & hashing', 'FIFO/LIFO intuition; hash maps for O(1) lookups.', [
        '35 min: stack for parentheses & monotonic stack intro.',
        '35 min: queue & deque use-cases.',
        '40 min: hash map frequency problems (2 classics).',
      ], [
        { name: 'Stack patterns', detail: 'Matching brackets; next greater element intro.', q: `stack data structure tutorial ${focus}` },
        { name: 'Hashing', detail: 'Counting, anagrams, complement pairs.', q: `hash map coding problems tutorial` },
      ]),
      dayBlock(focus, 4, 'Trees (BST & traversals)', 'Recursion and traversals before harder tree DP.', [
        '30 min: preorder/inorder/postorder — iterative + recursive.',
        '50 min: BST search/insert; validate BST.',
        '40 min: height, diameter, path sum intro.',
      ], [
        { name: 'Traversals', detail: 'Use explicit stack for iterative inorder.', q: `binary tree traversal tutorial` },
        { name: 'BST properties', detail: 'Inorder of BST is sorted — use that invariant.', q: `BST basics ${focus}` },
      ]),
      dayBlock(focus, 5, 'Heaps & priority queues', 'Top-K, merge K lists mindset.', [
        '35 min: min-heap vs max-heap API in your language.',
        '45 min: K largest, merge K sorted.',
        '40 min: scheduling / meeting rooms style problem.',
      ], [
        { name: 'Heap operations', detail: 'Heapify; when to prefer heap over sort.', q: `priority queue heap tutorial` },
        { name: 'Top-K patterns', detail: 'Fixed-size heap vs quickselect tradeoffs.', q: `top k elements heap leetcode tutorial` },
      ]),
      dayBlock(focus, 6, 'Graphs BFS & DFS', 'Grid graphs and adjacency lists.', [
        '40 min: BFS shortest path unweighted; DFS for components.',
        '45 min: island / grid problems.',
        '35 min: detect cycle in undirected graph (concept).',
      ], [
        { name: 'Graph representations', detail: 'Adjacency list vs matrix; when each wins.', q: `graph bfs dfs tutorial` },
        { name: 'Grid Bishops/Island', detail: '4-direction flood fill pattern.', q: `number of islands bfs dfs tutorial` },
      ]),
      dayBlock(
        focus,
        7,
        'Revision & timed set',
        'Mixed drill; prioritize weak topics from IntelearnX history.',
        [
          '20 min: one-page formula / pattern sheet.',
          '60 min: timed mixed set (5 problems, increasing difficulty).',
          '30 min: retest weakest topic only.',
          '10 min: plan next week.',
        ],
        [
          { name: 'Spaced recap', detail: 'Redo 3 problems you missed earlier in the week without notes first.', q: `${focus} revision one shot` },
          { name: 'Interview-style timed block', detail: '45 min hard stop; note where you stall.', q: `${focus} timed practice problems` },
        ],
        [weakLine || 'Take a IntelearnX quiz to refresh data, then regenerate with Gemini.'],
      ),
    ];
  }

  return [
    dayBlock(focus, 1, 'Orientation', `Clarify outcomes for “${focus}” and gather resources.`, [
      '25 min: define what “done” means for the week.',
      '40 min: one trusted course or book chapter map.',
      '30 min: vocabulary & terminology list.',
    ], [
      { name: 'Scope', detail: `List subtopics under ${focus} you must touch this week.`, q: `${focus} complete syllabus tutorial` },
      { name: 'Baseline quiz', detail: 'Short self-test; note gaps (no grading stress).', q: `${focus} basics test` },
    ]),
    dayBlock(focus, 2, 'Core theory A', 'First major concept block in logical order.', [
      '45 min: read + notes (active recall).',
      '40 min: worked examples — cover to recreate.',
      '25 min: 5 micro-questions.',
    ], [
      { name: 'Concept block A', detail: 'Teach-back: explain aloud without slides.', q: `${focus} lecture tutorial` },
      { name: 'Worked examples', detail: 'Mimic solution structure, don’t copy symbols blindly.', q: `${focus} solved examples` },
    ]),
    dayBlock(focus, 3, 'Core theory B', 'Second concept layer; connect to Day 2.', [
      '45 min: new material with linking diagrams.',
      '40 min: pair related problems easy→medium.',
    ], [
      { name: 'Concept block B', detail: 'Draw one flowchart linking Day 2–3 ideas.', q: `${focus} intermediate tutorial` },
      { name: 'Linking exercises', detail: 'Two problems that need both Day 2 and 3 ideas.', q: `${focus} practice problems medium` },
    ]),
    dayBlock(focus, 4, 'Drill & mistakes', 'Volume + error log.', [
      '50 min: problem set; stop after each to log “why I missed”.',
      '30 min: redo hardest item cold.',
    ], [
      { name: 'Mistake journal', detail: 'Tag errors: careless vs concept vs time.', q: `${focus} common mistakes` },
      { name: 'Timed easy set', detail: 'Speed + accuracy before moving harder.', q: `${focus} timed quiz easy` },
    ]),
    dayBlock(focus, 5, 'Application / case study', 'Realistic scenario or past-paper chunk.', [
      '60 min: one integrated task or multi-step question.',
      '30 min: compare your approach to model answer.',
    ], [
      { name: 'Integrated task', detail: 'Simulate exam constraints if applicable.', q: `${focus} past paper solved` },
      { name: 'Rubric check', detail: 'Score yourself on steps, not only final answer.', q: `${focus} exam strategy` },
    ]),
    dayBlock(focus, 6, 'Weak-area repair', `${sortedWeak.length ? 'Double down on quiz weak topics.' : 'Hardest subtopic second pass.'}`, [
      '45 min: targeted notes on weakest subtopic.',
      '45 min: 3 problems only in that subtopic.',
    ], [
      {
        name: 'Targeted repair',
        detail: sortedWeak[0]
          ? `Focus: ${sortedWeak[0].topic} — rebuild from definitions.`
          : `Pick hardest idea from Days 2–5 and restart from a simpler example.`,
        q: sortedWeak[0] ? `${sortedWeak[0].topic} tutorial` : `${focus} hardest concepts explained`,
      },
      {
        name: 'Verification',
        detail: 'Explain the fix to a friend in 3 minutes.',
        q: `${focus} revision tricks`,
      },
    ]),
    dayBlock(
      focus,
      7,
      'Review & next week',
      'Consolidate; schedule spaced repetition.',
      [
        '30 min flash summary of all 6 days.',
        '45 min mixed review set.',
        '15 min schedule two revisit slots next week.',
      ],
      [
        { name: 'One-pager', detail: 'Single sheet: formulas, pitfalls, algorithms.', q: `${focus} one shot revision` },
        { name: 'Forward plan', detail: 'Set next milestone beyond day 7.', q: `${studyKeywords || focus} study planner` },
      ],
      [userPrompt.trim() ? `Remember your stated goal: ${userPrompt.trim().slice(0, 120)}` : ''],
    ),
  ];
}

/**
 * Fallback learning path when API is not available
 */
function getFallbackLearningPath(weakAreas, context = {}) {
  const {
    userPrompt = '',
    onboardingQuizSummary = '',
    studyKeywords = '',
    onboardingIntroAccuracy = null,
    performanceSnapshot = null,
    domainLabels = [],
  } = context;

  const primaryFocus = resolvePrimaryStudyTopic(context) || studyKeywords.split(/[,;]/)[0]?.trim() || 'your topic';
  const sorted = weakAreas?.length ? [...weakAreas].sort((a, b) => a.accuracy - b.accuracy) : [];
  const sevenDayPlan = buildOfflineSevenDayPlan(primaryFocus, sorted, context);

  const summaryBits = [
    `Seven-day sequence for “${primaryFocus}” (offline template). Add VITE_GEMINI_API_KEY for a tailored Gemini plan.`,
  ];
  if (onboardingQuizSummary) summaryBits.push(onboardingQuizSummary);
  if (studyKeywords) summaryBits.push(`Keywords: ${studyKeywords}.`);
  if (domainLabels.length) summaryBits.push(`Domains: ${domainLabels.join(', ')}.`);
  if (typeof onboardingIntroAccuracy === 'number') {
    summaryBits.push(`Onboarding quiz ~${onboardingIntroAccuracy}%`);
  }
  if (performanceSnapshot?.overallAccuracy != null) {
    summaryBits.push(
      `Library quizzes: ~${performanceSnapshot.overallAccuracy}% overall across ${performanceSnapshot.totalQuizzes || 0} attempts.`,
    );
  }

  return JSON.stringify({
    primaryTopic: primaryFocus,
    summary: summaryBits.join(' '),
    diagramDescription: `Seven stops: Day 1 through Day 7 for ${primaryFocus}; move the car after finishing each day’s sequence.`,
    diagramMermaid:
      'flowchart LR\n D1[Day1] --> D2[Day2] --> D3[Day3] --> D4[Day4] --> D5[Day5] --> D6[Day6] --> D7[Day7]',
    sevenDayPlan,
    funChallenge: `Whiteboard ${primaryFocus}: teach Day 1–3 content in 6 minutes without notes.`,
    quizReminder: 'Use IntelearnX topic quizzes after Days 3, 5, and 7 to validate retention.',
  });
}

/**
 * Calculate difficulty adjustment based on rolling accuracy
 */
export function calculateDifficultyAdjustment(recentAnswers, currentDifficulty) {
  if (recentAnswers.length < 3) return currentDifficulty;
  
  const recent = recentAnswers.slice(-5);
  const accuracy = recent.filter(a => a.correct).length / recent.length;
  
  if (accuracy >= 0.8 && currentDifficulty !== 'hard') {
    return currentDifficulty === 'easy' ? 'medium' : 'hard';
  } else if (accuracy <= 0.4 && currentDifficulty !== 'easy') {
    return currentDifficulty === 'hard' ? 'medium' : 'easy';
  }
  
  return currentDifficulty;
}

/**
 * Identify weak areas from quiz history
 */
export function identifyWeakAreas(quizHistory) {
  const topicStats = {};
  
  quizHistory.forEach(quiz => {
    const key = `${quiz.subject}|${quiz.topic}`;
    if (!topicStats[key]) {
      topicStats[key] = { subject: quiz.subject, topic: quiz.topic, correct: 0, total: 0 };
    }
    topicStats[key].correct += quiz.correctAnswers;
    topicStats[key].total += quiz.totalQuestions;
  });

  return Object.values(topicStats)
    .map(stat => ({
      ...stat,
      accuracy: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0
    }))
    .filter(stat => stat.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy);
}
