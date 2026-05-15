import quizData from '../data/quizData.js';
import { domainIdToLabel } from '../services/personalizedQuizService.js';

/** Radar axes = subjects in the quiz bank only (quizData). */
const SUBJECT_SHORT_LABELS = {
  'Full Stack Web Development': 'Full Stack',
  DSA: 'DSA',
  'OOPs using Java': 'OOP',
  'Software Engineering': 'SW Eng.',
  Finance: 'Finance',
};

export const SKILL_AXES = Object.keys(quizData).map((match) => ({
  match,
  label: SUBJECT_SHORT_LABELS[match] || match,
}));

export function getSkillRadarRows(subjectAccuracy = {}) {
  return SKILL_AXES.map(({ match, label }) => {
    const row = subjectAccuracy[match];
    const practiced = !!(row && row.total > 0);
    const accuracy = practiced ? Math.round((row.correct / row.total) * 100) : 0;
    return {
      skill: label,
      subjectKey: match,
      accuracy,
      practiced,
    };
  });
}

/** Split onboarding keyword string into radar axes (commas, semicolons, bullets, newlines). */
export function parseStudyKeywords(studyKeywords) {
  if (!studyKeywords || typeof studyKeywords !== 'string') return [];
  const s = studyKeywords.trim();
  if (!s) return [];
  const parts = s
    .split(/[,;•]|\n+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const unique = [...new Set(parts.length >= 2 ? parts : [s])];
  return unique.slice(0, 8);
}

/**
 * Radar corners = user's first-quiz keywords. Scores: topic matches from library quizzes,
 * else overall accuracy after more quizzes, else baseline from first quiz (% correct).
 * @returns {null | Array<{ skill: string, fullLabel: string, accuracy: number, practiced: boolean, baselineOnly?: boolean }>}
 */
export function getKeywordRadarRows(user, performance) {
  const keywords = parseStudyKeywords(user?.studyKeywords);
  if (!keywords.length) return null;

  const introAcc =
    typeof user?.onboardingIntroAccuracy === 'number' ? user.onboardingIntroAccuracy : null;
  const domainScores = user?.onboardingDomainScores || {};
  const domainAvg =
    introAcc == null && Object.keys(domainScores).length
      ? Math.round(
          Object.values(domainScores).reduce((a, b) => Number(a) + Number(b), 0) /
            Object.keys(domainScores).length,
        )
      : null;
  const fallbackBaseline = introAcc ?? domainAvg ?? 0;
  const hasLibraryActivity = (performance?.totalQuizzes || 0) > 0;
  const topicPerf = performance?.topicPerformance || [];

  return keywords.map((full) => {
    const short = full.length > 16 ? `${full.slice(0, 15)}…` : full;
    const kw = full.toLowerCase();

    const match = topicPerf.find((t) => {
      const tl = t.topic.toLowerCase();
      if (tl.includes(kw) || (kw.length > 3 && kw.includes(tl))) return true;
      const words = kw.split(/\s+/).filter((w) => w.length > 2);
      return words.length > 0 && words.every((w) => tl.includes(w));
    });

    let accuracy = fallbackBaseline;
    let practiced = false;
    let baselineOnly = false;

    if (match && match.total > 0) {
      accuracy = match.accuracy;
      practiced = true;
    } else if (hasLibraryActivity) {
      accuracy = performance.overallAccuracy ?? fallbackBaseline;
      practiced = true;
    } else if (introAcc != null || domainAvg != null) {
      accuracy = fallbackBaseline;
      baselineOnly = true;
    }

    return {
      skill: short,
      fullLabel: full,
      accuracy,
      practiced,
      baselineOnly,
    };
  });
}

/** @returns {null | Array<{ skill: string, accuracy: number, practiced: boolean, baselineOnly?: boolean }>} */
export function getDomainRadarRows(user, performance) {
  const ids = user?.studyDomainIds;
  if (!ids || !ids.length) return null;
  const labels = ids.map(domainIdToLabel);
  const acc = performance?.domainAccuracy || {};
  const onboarding = user?.onboardingDomainScores || {};

  return labels.map((label) => {
    const row = acc[label];
    const fromQuizzes = !!(row && row.total > 0);
    let accuracy = 0;
    let practiced = false;
    let baselineOnly = false;
    if (fromQuizzes) {
      accuracy = Math.round((row.correct / row.total) * 100);
      practiced = true;
    } else if (typeof onboarding[label] === 'number') {
      accuracy = onboarding[label];
      baselineOnly = true;
    }
    return {
      skill: label,
      accuracy,
      practiced,
      baselineOnly,
    };
  });
}

export function getGuidanceSteps(performance, user) {
  const steps = [];
  const weakDomain = performance.domainWeakAreas?.[0];
  const weak = performance.weakAreas?.[0];

  if (user?.studyDomainIds?.length && weakDomain) {
    steps.push({
      n: 1,
      title: `Boost ${weakDomain.topic}`,
      detail: `Your personalized domain scores suggest extra practice in ${weakDomain.topic} (${weakDomain.accuracy}%). Short revision plus targeted questions work best.`,
    });
  } else if (weak) {
    steps.push({
      n: 1,
      title: 'Prioritize one weak topic',
      detail: `Your lowest recent score is on "${weak.topic}". Spend one short session on explanations, then retry a small quiz on that topic.`,
    });
  } else {
    steps.push({
      n: 1,
      title: 'Keep momentum',
      detail: 'No critical weak spots right now. Rotate subjects so skills stay balanced over time.',
    });
  }

  const hard = performance.difficultyBreakdown?.hard;
  const hardRatio = hard?.total > 0 ? hard.correct / hard.total : 1;
  steps.push({
    n: 2,
    title: hard?.total >= 2 && hardRatio < 0.55 ? 'Level up difficulty carefully' : 'Stretch with harder questions',
    detail:
      hard?.total >= 2 && hardRatio < 0.55
        ? 'Hard questions are still challenging. Master medium sets first, then return to hard mode in short bursts.'
        : 'When easy quizzes feel comfortable, move to medium or hard in the same topic to deepen understanding.',
  });

  steps.push({
    n: 3,
    title: 'Use your learning path',
    detail: 'The learning path turns patterns in your history into next steps. Check it after every few quizzes.',
  });

  return steps;
}

/**
 * @returns {Array<{ id: string, kind: 'focus' | 'explore' | 'habit' | 'celebrate', title: string, detail: string }>}
 */
export function getImprovementSuggestions(performance) {
  const out = [];
  const {
    weakAreas = [],
    strongAreas = [],
    overallAccuracy = 0,
    subjectAccuracy = {},
    difficultyBreakdown = {},
    domainWeakAreas = [],
  } = performance;

  domainWeakAreas.slice(0, 2).forEach((area, i) => {
    out.push({
      id: `domain-weak-${i}-${area.topic}`,
      kind: 'focus',
      title: `Domain focus: ${area.topic}`,
      detail: `About ${area.accuracy}% on recent attempts in this area—add drills and spaced review before moving on.`,
    });
  });

  SKILL_AXES.forEach(({ match, label }) => {
    const s = subjectAccuracy[match];
    if (!s || !s.total) {
      out.push({
        id: `explore-${match}`,
        kind: 'explore',
        title: `Try ${label}`,
        detail: 'No quiz data in this area yet. One short quiz here will reveal strengths and gaps.',
      });
    }
  });

  weakAreas.slice(0, 3).forEach((area, i) => {
    out.push({
      id: `weak-${i}-${area.topic}`,
      kind: 'focus',
      title: `Strengthen: ${area.topic}`,
      detail: `Currently around ${area.accuracy}% accuracy. Re-read core ideas, then take a shorter quiz on this topic before moving on.`,
    });
  });

  const hard = difficultyBreakdown.hard;
  if (hard && hard.total >= 4) {
    const hr = hard.correct / hard.total;
    if (hr < 0.45) {
      out.push({
        id: 'hard-struggle',
        kind: 'habit',
        title: 'Hard mode needs foundation',
        detail: 'Several hard quizzes scored low. Alternate: two medium quizzes, then one hard question set until scores stabilize.',
      });
    }
  }

  const med = difficultyBreakdown.medium;
  if (med && med.total >= 3 && med.correct / med.total >= 0.75 && (!hard || hard.total < 2)) {
    out.push({
      id: 'level-up',
      kind: 'habit',
      title: 'Ready for harder challenges',
      detail: 'Medium difficulty looks solid. Pick the same topic on hard difficulty to prepare for interviews and deeper exams.',
    });
  }

  if (overallAccuracy >= 75 && weakAreas.length === 0) {
    out.push({
      id: 'celebrate',
      kind: 'celebrate',
      title: 'Strong overall performance',
      detail: 'Keep mixing subjects so retention stays high, and teach a friend—explaining reveals blind spots.',
    });
  }

  strongAreas.slice(0, 2).forEach((area, i) => {
    out.push({
      id: `strong-${i}`,
      kind: 'celebrate',
      title: `Leverage strength: ${area.topic}`,
      detail: `You are doing well here (${area.accuracy}%). Use this confidence to tackle adjacent harder topics.`,
    });
  });

  if (out.length === 0) {
    out.push({
      id: 'default',
      kind: 'habit',
      title: 'Establish a steady rhythm',
      detail: 'Take quizzes on a predictable schedule—even two short sessions per week compound quickly.',
    });
  }

  const kindOrder = { focus: 0, explore: 1, habit: 2, celebrate: 3 };
  out.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]);
  return out.slice(0, 7);
}

/** Offline fallback for review topics when Gemini is unavailable. */
export function buildFallbackReviewTopics(performance) {
  const topics = [];
  const seen = new Set();

  const push = (name, reason) => {
    const key = name.toLowerCase();
    if (seen.has(key) || !name) return;
    seen.add(key);
    topics.push({ name, reason });
  };

  (performance.domainWeakAreas || []).slice(0, 2).forEach((a) => {
    push(a.topic, `About ${a.accuracy}% on recent tries—short review and practice questions will help.`);
  });
  (performance.weakAreas || []).slice(0, 3).forEach((a) => {
    push(a.topic, `Accuracy around ${a.accuracy}%—re-read basics then try a short quiz on this topic.`);
  });

  if (topics.length === 0 && (performance.totalQuizzes || 0) === 0) {
    push('Your focus areas', 'Complete a quiz to unlock tailored review ideas.');
  }

  if (topics.length === 0) {
    push('Balanced practice', 'Rotate across subjects to keep skills sharp.');
  }

  const summary =
    topics.length > 0
      ? 'Based on your last quizzes, prioritize these areas.'
      : 'Keep practicing—more data will refine these suggestions.';

  return { summary, topics: topics.slice(0, 5), source: 'fallback' };
}

/**
 * Returns a brief description of what a topic consists of.
 */
export function getTopicDescription(topicName) {
  if (!topicName) return '';
  const normalized = topicName.toLowerCase();
  
  const map = {
    'dsa': 'Data Structures and Algorithms involves organizing data efficiently (arrays, trees, graphs) and using step-by-step procedures (sorting, searching) to solve complex problems.',
    'arrays & strings': 'Fundamental data structures stored continuously in memory. Focuses on string manipulation, two-pointer techniques, and sliding window algorithms.',
    'trees & graphs': 'Non-linear data structures representing hierarchical or networked data. Topics include binary trees, BSTs, DFS/BFS traversals, and shortest path algorithms.',
    'full stack': 'The complete cycle of web development, including both the user-facing front-end (HTML/CSS/JS, React) and the server-side back-end (Node.js, databases).',
    'frontend': 'The client-side of web applications. Consists of UI/UX implementation, DOM manipulation, responsive design, and framework usage like React or Vue.',
    'backend': 'The server-side of web applications. Covers server logic, API design (REST/GraphQL), database management, authentication, and server environments like Node.js.',
    'oop': 'Object-Oriented Programming. A paradigm centered around objects rather than functions. Key concepts include inheritance, encapsulation, polymorphism, and abstraction.',
    'software engineering': 'The systematic application of engineering approaches to software development. Covers SDLC, Agile methodologies, system design, testing, and CI/CD pipelines.',
    'sdlc & methodologies': 'Software Development Life Cycle. The process for planning, creating, testing, and deploying an information system, including frameworks like Agile and Scrum.',
    'testing': 'The process of evaluating a system or its components to find whether it satisfies the specified requirements. Includes unit, integration, and end-to-end testing.',
    'finance': 'The management, creation, and study of money and investments. Covers personal budgeting, market analysis, financial instruments, and corporate finance.',
    'personal finance': 'Management of an individual\'s money, including saving, investing, budgeting, banking, insurance, and retirement planning.',
    'markets & investing': 'The buying and selling of financial instruments like stocks, bonds, and mutual funds to generate wealth over time.',
    'engineering': 'The application of science and math to solve problems. Involves design, analysis, prototyping, and optimization of structures, machines, or systems.',
    'computer science': 'The study of computers and computational systems, spanning theory, algorithms, hardware, software design, and artificial intelligence.',
    'electronics & ece': 'Electronics and Communication Engineering. Deals with electronic devices, circuits, communication equipment, microprocessors, and signal processing.',
    'cybersecurity': 'The practice of protecting systems, networks, and programs from digital attacks, unauthorized access, and data breaches.',
    'ai & ml': 'Artificial Intelligence and Machine Learning. Training models on data to make predictions, recognize patterns, or automate tasks without explicit programming.',
    'embedded systems': 'Computer systems with a dedicated function within a larger mechanical or electrical system, often involving microcontrollers and real-time constraints.',
    'onboarding quiz': 'An initial assessment covering a mix of foundational domains chosen during sign-up to gauge starting proficiency.',
  };

  for (const [key, desc] of Object.entries(map)) {
    if (normalized.includes(key)) {
      return desc;
    }
  }

  return `This topic encompasses the core theories, practical applications, and advanced concepts related to ${topicName.replace('Personalized study > ', '')}.`;
}

