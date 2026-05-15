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
  { id: 'engineering', label: 'Engineering Basics', emoji: '⚙️', hint: 'Core engineering, physics, mathematics, design' },
  { id: 'cs', label: 'Computer Science', emoji: '💻', hint: 'Programming, DSA, algorithms, OS, DBMS' },
  { id: 'electronics', label: 'Electronics & ECE', emoji: '🔌', hint: 'Circuits, VLSI, embedded, signals' },
  { id: 'software', label: 'Software Engineering', emoji: '🛠️', hint: 'SDLC, testing, DevOps, architecture' },
  { id: 'mechanical', label: 'Mechanical Engineering', emoji: '🔧', hint: 'Thermodynamics, fluid mechanics, kinematics' },
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
1. Generate exactly 10 high-quality, challenging questions.
2. The questions MUST directly relate to the chosen domains: ${domainLabels.join(', ')}. Do NOT drift into generic topics.
3. Questions should test deep conceptual understanding, practical problem-solving, and advanced reasoning suitable for competitive engineering exams and university prep. Avoid rote trivia.
4. Each question belongs to exactly ONE of these domains. Use the "domain" field with the exact label string.
5. Provide four options each; "correct" is the zero-based index 0-3 of the correct option.
6. The "explanation" should clearly explain WHY the correct option is right and WHY the misconception might lead to other answers.
7. Return ONLY valid JSON (no markdown), shape:
{"questions":[{"domain":"${domainLabels[0]}","question":"...","options":["","","",""],"correct":0,"explanation":"...","difficulty":"medium"}]}

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
    domain: 'Engineering Basics',
    question: 'When analyzing the stability of a feedback system, which criterion is often used without solving the characteristic equation?',
    options: ['Nyquist Criterion', 'Bode Plot', 'Routh-Hurwitz Criterion', 'Root Locus'],
    correct: 2,
    explanation: 'The Routh-Hurwitz criterion determines the number of closed-loop system poles in the right half-plane without solving the characteristic equation.',
  },
  {
    domain: 'Computer Science',
    question: 'In the context of database transactions, what does the "I" in ACID properties ensure?',
    options: ['Information is saved permanently', 'Transactions are executed sequentially without interference', 'Integrity constraints are maintained', 'Initial state is recovered on failure'],
    correct: 1,
    explanation: 'Isolation (I) ensures that concurrent execution of transactions leaves the database in the same state that would have been obtained if the transactions were executed sequentially.',
  },
  {
    domain: 'Electronics & ECE',
    question: 'In a bipolar junction transistor (BJT) operating in the active region, what is the primary relationship between collector and base current?',
    options: ['They are inversely proportional', 'Collector current is beta times the base current', 'They are equal', 'Collector current is independent of base current'],
    correct: 1,
    explanation: 'In the active region, a BJT acts as a current amplifier where the collector current is approximately beta (the common-emitter current gain) times the base current.',
  },
  {
    domain: 'Software Engineering',
    question: 'In the context of the SOLID principles, what does the Dependency Inversion Principle dictate?',
    options: ['High-level modules should depend on low-level modules', 'Classes should depend on concrete implementations', 'High-level modules should not depend on low-level modules; both should depend on abstractions', 'Dependencies should be injected via constructors only'],
    correct: 2,
    explanation: 'Dependency Inversion states that high-level modules should depend on abstractions (interfaces), not on concrete low-level implementations, promoting decoupling.',
  },
  {
    domain: 'Mechanical Engineering',
    question: 'Which law of thermodynamics states that the entropy of an isolated system never decreases over time?',
    options: ['Zeroth Law', 'First Law', 'Second Law', 'Third Law'],
    correct: 2,
    explanation: 'The Second Law of Thermodynamics dictates that total entropy of an isolated system can only increase or remain constant over time, giving direction to thermodynamic processes.',
  }
];

const FALLBACK_QUESTIONS = [
  // Computer Science
  {
    domain: 'Computer Science',
    question: 'What is the worst-case time complexity of the Quicksort algorithm?',
    options: ['O(n log n)', 'O(n)', 'O(n²)', 'O(1)'],
    correct: 2,
    explanation: 'The worst-case scenario occurs when the pivot chosen is consistently the smallest or largest element, leading to O(n²) time complexity.',
  },
  {
    domain: 'Computer Science',
    question: 'Which data structure is primarily used to implement a Least Recently Used (LRU) cache efficiently?',
    options: ['A simple Array', 'A Hash Map paired with a Doubly Linked List', 'A Binary Search Tree', 'A Stack'],
    correct: 1,
    explanation: 'A Hash Map provides O(1) access to items, while the Doubly Linked List allows O(1) removal and insertion at the ends to track the most and least recently used items.',
  },
  // Electronics & ECE
  {
    domain: 'Electronics & ECE',
    question: 'Which logic gate produces a HIGH output only when all its inputs are HIGH?',
    options: ['OR gate', 'NAND gate', 'AND gate', 'XOR gate'],
    correct: 2,
    explanation: 'The AND gate performs logical multiplication, outputting 1 (HIGH) strictly when all its inputs are 1.',
  },
  {
    domain: 'Electronics & ECE',
    question: 'What is the purpose of a low-pass filter in a signal processing circuit?',
    options: ['To amplify high frequencies', 'To block low frequencies', 'To attenuate frequencies higher than the cutoff frequency', 'To convert digital signals to analog'],
    correct: 2,
    explanation: 'A low-pass filter passes signals with a frequency lower than a selected cutoff frequency and attenuates signals with frequencies higher than the cutoff frequency.',
  },
  // Software Engineering
  {
    domain: 'Software Engineering',
    question: 'What is the primary advantage of a Microservices architecture over a Monolithic architecture?',
    options: ['Easier to debug globally', 'Independent deployment and scaling of services', 'Zero network latency between modules', 'Simpler overall system architecture'],
    correct: 1,
    explanation: 'Microservices allow teams to deploy, update, and scale individual components independently without affecting the entire application.',
  },
  {
    domain: 'Software Engineering',
    question: 'Which design pattern is used to ensure a class has only one instance and provides a global point of access to it?',
    options: ['Factory Method', 'Observer', 'Singleton', 'Decorator'],
    correct: 2,
    explanation: 'The Singleton pattern restricts the instantiation of a class to one single instance, which is globally accessible throughout the application.',
  },
  // Engineering Basics
  {
    domain: 'Engineering Basics',
    question: 'In fluid mechanics, Bernoulli\'s principle is a statement of the conservation of which quantity?',
    options: ['Mass', 'Momentum', 'Energy', 'Volume'],
    correct: 2,
    explanation: 'Bernoulli\'s equation is derived from the principle of conservation of energy applied to a steady, incompressible fluid flow.',
  },
  // Mechanical Engineering
  {
    domain: 'Mechanical Engineering',
    question: 'What type of stress occurs when equal and opposite forces are applied parallel to the surface of an object?',
    options: ['Tensile stress', 'Compressive stress', 'Shear stress', 'Volumetric stress'],
    correct: 2,
    explanation: 'Shear stress is caused by forces acting parallel to the cross-sectional area of the material, attempting to slide one part of the material over another.',
  },
  {
    domain: 'Mechanical Engineering',
    question: 'In a four-stroke internal combustion engine, during which stroke is the air-fuel mixture ignited?',
    options: ['Intake stroke', 'Compression stroke', 'Power (Expansion) stroke', 'Exhaust stroke'],
    correct: 2,
    explanation: 'Ignition occurs just before the power stroke, causing the expanding gases to push the piston down and generate mechanical work.',
  }
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
