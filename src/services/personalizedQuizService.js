/**
 * Personalized onboarding quiz — domains (Engineering, Commerce, Medical) + user keywords.
 * Uses Gemini when VITE_GEMINI_API_KEY is set; otherwise a built-in fallback bank.
 *
 * Qdrant Integration:
 *  - Enriches review suggestions with semantically relevant quiz knowledge from vector DB
 *  - Stores onboarding quiz results in Qdrant for future semantic retrieval
 */

import quizData from '../data/quizData.js';
import { isVectorDbConfigured, searchQuizKnowledge, storeQuizKnowledge } from './vectorService';
import { geminiGenerate, geminiGenerateSafe, isGeminiConfigured, isInCooldown } from './openaiClient';
import { validateEngineeringDomain, OUT_OF_DOMAIN_SHORT } from '../utils/engineeringDomainGuard';

const LIBRARY_SUBJECT_NAMES = Object.keys(quizData);

export const STUDY_DOMAIN_OPTIONS = [
  { id: 'engineering', label: 'Engineering', emoji: '⚙️', hint: 'Core engineering, mechanics, design, tech' },
  { id: 'cs', label: 'Computer Science', emoji: '💻', hint: 'Programming, DSA, algorithms, OS, DBMS' },
  { id: 'electronics', label: 'Electronics & ECE', emoji: '🔌', hint: 'Circuits, VLSI, embedded, signals' },
  { id: 'software', label: 'Software Engineering', emoji: '🛠️', hint: 'SDLC, testing, DevOps, architecture' },
];

export function domainIdToLabel(id) {
  return STUDY_DOMAIN_OPTIONS.find((d) => d.id === id)?.label || id;
}

function stripJsonFence(text) {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return t;
}

function parseGeminiJson(text) {
  const cleaned = stripJsonFence(text);
  let data;
  try {
    data = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) data = JSON.parse(m[0]);
    else throw new Error('Invalid JSON from AI');
  }
  return data;
}

function normalizeQuestions(rawList, domainLabels) {
  return rawList.map((q, i) => {
    let opts = Array.isArray(q.options) ? [...q.options] : [];
    if (opts.length !== 4) {
      throw new Error(`Question ${i + 1} must have exactly 4 options`);
    }
    let correct = q.correct;
    if (correct === undefined && q.correctAnswer !== undefined) {
      const idx = opts.findIndex((o) => o === q.correctAnswer);
      correct = idx >= 0 ? idx : 0;
    }
    if (typeof correct !== 'number' || correct < 0 || correct > 3) correct = 0;

    let domain = q.domain || q.Domain || domainLabels[0];
    if (typeof domain === 'string') {
      const match = domainLabels.find((l) => l.toLowerCase() === domain.toLowerCase());
      domain = match || domainLabels[i % domainLabels.length];
    } else {
      domain = domainLabels[i % domainLabels.length];
    }

    return {
      id: q.id || `pq-${i + 1}`,
      domain,
      question: String(q.question || '').trim(),
      options: opts.map((o) => String(o)),
      correct,
      explanation: String(q.explanation || 'Review this concept and try similar questions.'),
      difficulty: q.difficulty || 'medium',
    };
  });
}

/**
 * @param {{ domainIds: string[], keywords: string }} config
 * @returns {Promise<{ questions: object[], source: 'gemini'|'fallback' }>}
 */
export async function generatePersonalizedQuizQuestions(config) {
  const { domainIds, keywords } = config;
  const domainLabels = domainIds.map(domainIdToLabel).filter(Boolean);
  if (domainLabels.length === 0) {
    throw new Error('Select at least one domain');
  }

  // ── Engineering domain gate for user-entered keywords ──
  if (keywords && keywords.trim()) {
    const { isEngineering } = validateEngineeringDomain(keywords.trim());
    if (!isEngineering) {
      throw new Error(OUT_OF_DOMAIN_SHORT);
    }
  }

  const kw = (keywords || '').trim() || 'general aptitude and reasoning';

  if (isGeminiConfigured() && !isInCooldown()) {
    try {
      const prompt = `You are an expert engineering education quiz generator.

IMPORTANT: You ONLY generate quizzes about engineering subjects (Computer Science, Electronics, Mechanical, Civil, Chemical, Aerospace, Software Engineering, etc.). If the domains/keywords below are clearly non-engineering (cooking, history, law, medicine unrelated to biomedical engineering, etc.), respond with: {"error":"out_of_domain","message":"${OUT_OF_DOMAIN_SHORT}"}

STUDENT CONTEXT:
- Domains to cover (spread questions evenly): ${domainLabels.join(', ')}.
- Student interests / keywords (use to shape scenarios and wording): ${kw}

RULES:
1. Generate exactly 10 questions.
2. Each question belongs to exactly ONE of these domains: ${domainLabels.join(', ')}. Use the "domain" field with the exact label string.
3. Questions should be logical / conceptual — avoid rote trivia; prefer reasoning suitable for competitive exams and university prep.
4. Four options each; "correct" is the zero-based index 0–3 of the correct option.
5. Return ONLY valid JSON (no markdown), shape:
{"questions":[{"domain":"${domainLabels[0]}","question":"...","options":["","","",""],"correct":0,"explanation":"..."}]}

Generate all 10 questions now.`;

      const responseText = await geminiGenerate(prompt, {
        temperature: 0.45,
        maxOutputTokens: 8192,
        useCache: false,
      });
      if (!responseText) throw new Error('Empty AI response');

      const data = parseGeminiJson(responseText);
      if (!data.questions || !Array.isArray(data.questions) || data.questions.length < 8) {
        throw new Error('AI returned too few questions');
      }

      const questions = normalizeQuestions(data.questions.slice(0, 10), domainLabels);
      return { questions, source: 'gemini' };
    } catch (e) {
      console.warn('Gemini personalized quiz failed, using fallback:', e);
    }
  }

  return { questions: buildFallbackQuiz(domainLabels, kw), source: 'fallback' };
}

function buildFallbackQuiz(domainLabels, keywords) {
  let pool = [...FALLBACK_QUESTIONS, ...FALLBACK_GENERIC].filter((q) => domainLabels.includes(q.domain));
  if (pool.length === 0) {
    pool = [...FALLBACK_QUESTIONS, ...FALLBACK_GENERIC];
  }
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const picked = [];
  for (let i = 0; i < 10; i++) {
    const base = { ...shuffled[i % shuffled.length] };
    base.id = `fb-${i + 1}`;
    base.domain = domainLabels[i % domainLabels.length];
    if (keywords && keywords.length > 2) {
      base.question = `${base.question} (Your focus: ${keywords.slice(0, 80)}.)`;
    }
    picked.push(base);
  }
  return picked;
}

const FALLBACK_GENERIC = [
  {
    domain: 'Engineering',
    question: 'When comparing two design choices, what should you weigh first when safety is involved?',
    options: ['Only cost', 'Risk and failure modes', 'Only speed of delivery', 'Only aesthetics'],
    correct: 1,
    explanation: 'Engineering judgment prioritizes safety and understanding failure modes before optimizing cost or speed.',
  },
  {
    domain: 'Computer Science',
    question: 'What is the primary benefit of using version control systems like Git?',
    options: ['Faster code execution', 'Tracking changes and collaboration', 'Automatic bug fixing', 'Code compilation'],
    correct: 1,
    explanation: 'Version control systems track code changes over time and enable collaborative development workflows.',
  },
  {
    domain: 'Electronics & ECE',
    question: 'What is the function of a capacitor in a circuit?',
    options: ['Amplify signals', 'Store electrical energy temporarily', 'Convert AC to DC', 'Increase resistance'],
    correct: 1,
    explanation: 'A capacitor stores electrical energy in an electric field between its plates and releases it when needed.',
  },
];

const FALLBACK_QUESTIONS = [
  {
    domain: 'Engineering',
    question: 'A system behaves unpredictably under load. What is the most systematic first step?',
    options: ['Rewrite everything', 'Measure and reproduce the issue', 'Add more servers blindly', 'Skip testing'],
    correct: 1,
    explanation: 'Reproduce and measure before changing design — core debugging practice.',
  },
  {
    domain: 'Engineering',
    question: 'Why are prototypes often built before full-scale production?',
    options: ['To avoid planning', 'To validate assumptions with lower risk', 'To skip documentation', 'To eliminate testing'],
    correct: 1,
    explanation: 'Prototypes reduce risk by testing assumptions early.',
  },
  {
    domain: 'Engineering',
    question: 'What does "scalability" usually refer to?',
    options: ['Only UI size', 'Ability to handle growth in usage or data', 'Color contrast', 'Font choice'],
    correct: 1,
    explanation: 'Scalability is how well a solution grows with demand.',
  },
  {
    domain: 'Software Engineering',
    question: 'Which habit best prevents technical debt from snowballing?',
    options: ['Never refactor', 'Small continuous improvements and reviews', 'Only fix after failure', 'Copy-paste only'],
    correct: 1,
    explanation: 'Continuous refactoring and review keep systems maintainable.',
  },
  {
    domain: 'Computer Science',
    question: 'What is the time complexity of binary search on a sorted array?',
    options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'],
    correct: 1,
    explanation: 'Binary search halves the search space each step, giving O(log n) time complexity.',
  },
  {
    domain: 'Computer Science',
    question: 'Which data structure uses LIFO (Last In, First Out) ordering?',
    options: ['Queue', 'Stack', 'Linked List', 'Hash Table'],
    correct: 1,
    explanation: 'A stack follows LIFO — the last element pushed is the first one popped.',
  },
  {
    domain: 'Computer Science',
    question: 'What does SQL stand for?',
    options: ['Simple Query Logic', 'Structured Query Language', 'System Quality Level', 'Sequential Query Layout'],
    correct: 1,
    explanation: 'SQL stands for Structured Query Language, used for managing relational databases.',
  },
  {
    domain: 'Electronics & ECE',
    question: 'What is Ohm\'s Law?',
    options: ['P = IV', 'V = IR', 'E = mc²', 'F = ma'],
    correct: 1,
    explanation: 'Ohm\'s Law states that voltage (V) equals current (I) times resistance (R).',
  },
  {
    domain: 'Electronics & ECE',
    question: 'What does a transistor primarily do in a digital circuit?',
    options: ['Store data permanently', 'Act as an electronic switch', 'Convert analog to digital', 'Generate clock signals'],
    correct: 1,
    explanation: 'In digital circuits, transistors act as switches that can be ON or OFF, forming the basis of logic gates.',
  },
  {
    domain: 'Software Engineering',
    question: 'What is the primary purpose of a code review?',
    options: ['Slowing down development', 'Finding bugs and improving code quality', 'Assigning blame', 'Meeting compliance quotas'],
    correct: 1,
    explanation: 'Code reviews catch bugs early, improve quality, share knowledge, and ensure best practices.',
  },
  {
    domain: 'Software Engineering',
    question: 'What does CI/CD stand for?',
    options: ['Continuous Integration / Continuous Deployment', 'Code Integration / Code Deployment', 'Custom Implementation / Custom Design', 'Consistent Integration / Constant Delivery'],
    correct: 0,
    explanation: 'CI/CD stands for Continuous Integration and Continuous Deployment (or Delivery), automating the build-test-deploy pipeline.',
  },
  {
    domain: 'Electronics & ECE',
    question: 'What does VLSI stand for?',
    options: ['Very Low Speed Integration', 'Very Large Scale Integration', 'Variable Logic System Interface', 'Virtual Logic Simulation Interface'],
    correct: 1,
    explanation: 'VLSI stands for Very Large Scale Integration — the process of creating integrated circuits with millions of transistors.',
  },
];

/**
 * @param {object[]} questions
 * @param {Record<number, { correct: boolean }>} answersByIndex
 */
export function computeDomainStats(questions, answersByIndex) {
  const stats = {};
  questions.forEach((q, i) => {
    const d = q.domain || 'General';
    if (!stats[d]) stats[d] = { correct: 0, total: 0 };
    stats[d].total += 1;
    if (answersByIndex[i]?.correct) stats[d].correct += 1;
  });
  const scoresPct = {};
  Object.entries(stats).forEach(([d, v]) => {
    scoresPct[d] = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
  });
  return { domainStats: stats, domainScoresPct: scoresPct };
}

/**
 * AI suggestions for what to review next, based on quiz performance and onboarding context.
 * @param {object} context — compact stats + user fields (studyDomains[], studyKeywords, onboardingQuizSummary, onboardingDomainScores, weakAreas, domainWeakAreas, subjectAccuracy, overallAccuracy, totalQuizzes)
 * @returns {Promise<{ summary: string, topics: Array<{ name: string, reason: string }>, source: 'gemini' } | null>}
 */
export async function generateReviewSuggestionsFromQuiz(context) {
  if (!isGeminiConfigured() || isInCooldown()) return null;

  // Cache based on context string to save API quota
  const cacheKey = 'ai_review_cache_' + JSON.stringify(context);
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      // ignore parse error
    }
  }

  // ── Qdrant Enhancement: pull relevant knowledge from vector DB ──
  let vectorContextBlock = '';
  if (isVectorDbConfigured()) {
    try {
      const searchQuery = [
        ...(context.studyKeywords ? [context.studyKeywords] : []),
        ...(context.weakAreas || []).slice(0, 3).map((w) => w.topic),
      ].join(', ') || 'general study topics';

      const vectorResults = await searchQuizKnowledge(searchQuery, null, 4);
      if (vectorResults.length > 0) {
        vectorContextBlock = '\n\nRELEVANT KNOWLEDGE FROM VECTOR DB (use to refine suggestions):\n' +
          vectorResults.map((k) => `- [${k.topic}] ${k.question} → ${k.correctAnswer}`).join('\n');
      }
    } catch (e) {
      console.warn('Vector search for review suggestions failed (non-critical):', e.message);
    }
  }

  const prompt = `You are a concise study coach for a quiz app.

STUDENT CONTEXT (JSON):
${JSON.stringify(context)}

IN-APP LIBRARY SUBJECTS (use exact names when recommending a quiz track): ${LIBRARY_SUBJECT_NAMES.join(', ')}
${vectorContextBlock}

TASK:
1. Write one short encouraging summary sentence (max 25 words) about their learning trajectory.
2. Suggest exactly 4 specific topics or subtopics to review next. Prioritize weak areas and gaps. Align with their chosen domains/keywords when relevant. Prefer tying 1–2 items to the library subjects above when it fits.

Return ONLY valid JSON (no markdown):
{"summary":"...","topics":[{"name":"short label","reason":"one clear sentence"}]}`;

  // Use geminiGenerateSafe — never throws, returns null on failure
  const responseText = await geminiGenerateSafe(prompt, {
    temperature: 0.4,
    maxOutputTokens: 2048,
    systemPrompt: 'You are a concise study coach. Return ONLY valid JSON.',
  });

  if (!responseText) return null;

  try {
    const data = parseGeminiJson(responseText);
    const topics = Array.isArray(data.topics) ? data.topics : [];
    const normalized = topics
      .map((t) => ({
        name: String(t.name || t.topic || '').trim(),
        reason: String(t.reason || t.detail || '').trim(),
      }))
      .filter((t) => t.name && t.reason)
      .slice(0, 6);

    if (normalized.length === 0) return null;

    const resObj = {
      summary: String(data.summary || '').trim() || 'Here are focused topics to review from your recent quiz data.',
      topics: normalized,
      source: 'gemini',
    };
    sessionStorage.setItem(cacheKey, JSON.stringify(resObj));
    return resObj;
  } catch (e) {
    console.warn('Failed to parse review suggestions:', e);
    return null;
  }
}
