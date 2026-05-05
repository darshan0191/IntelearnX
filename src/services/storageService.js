/**
 * Storage Service — Firebase Realtime Database
 * All CRUD operations for user data, quiz history, leaderboard, badges, etc.
 */
import { db } from '../firebase';
import {
  ref, set, get, push, update, child, remove,
} from 'firebase/database';

// ===== User Profile =====

export async function getUserProfile(uid) {
  const snap = await get(ref(db, `users/${uid}`));
  return snap.exists() ? { id: uid, ...snap.val() } : null;
}

export async function saveUserProfile(uid, data) {
  await set(ref(db, `users/${uid}`), data);
}

export async function updateUserProfile(uid, updates) {
  await update(ref(db, `users/${uid}`), updates);
}

export async function getAllUsers() {
  const snap = await get(ref(db, 'users'));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.entries(data).map(([id, user]) => ({ id, ...user }));
}

// ===== Quiz History =====

export async function getQuizHistory(uid) {
  const snap = await get(ref(db, `quizHistory/${uid}`));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.entries(data)
    .map(([id, quiz]) => ({ id, ...quiz }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export async function saveQuizResult(uid, result) {
  const quizRef = push(ref(db, `quizHistory/${uid}`));
  const quizResult = {
    ...result,
    timestamp: new Date().toISOString(),
  };
  await set(quizRef, quizResult);

  // Update leaderboard
  await updateLeaderboard(uid, result);

  return { id: quizRef.key, ...quizResult };
}

// ===== Performance Analytics =====

export async function getPerformanceData(uid) {
  const history = await getQuizHistory(uid);

  if (history.length === 0) {
    return {
      totalQuizzes: 0,
      totalQuestions: 0,
      totalCorrect: 0,
      overallAccuracy: 0,
      topicAccuracy: {},
      subjectAccuracy: {},
      domainAccuracy: {},
      difficultyBreakdown: {
        easy: { correct: 0, total: 0 },
        medium: { correct: 0, total: 0 },
        hard: { correct: 0, total: 0 },
      },
      recentTrend: [],
      weakAreas: [],
      strongAreas: [],
      topicPerformance: [],
      domainWeakAreas: [],
      domainPerformance: [],
    };
  }

  let totalCorrect = 0;
  let totalQuestions = 0;
  const topicAccuracy = {};
  const subjectAccuracy = {};
  const domainAccuracy = {};
  const difficultyBreakdown = {
    easy: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    hard: { correct: 0, total: 0 },
  };

  history.forEach((quiz) => {
    totalCorrect += quiz.correctAnswers || 0;
    totalQuestions += quiz.totalQuestions || 0;

    // Topic accuracy
    const topicKey = `${quiz.subject} > ${quiz.topic}`;
    if (!topicAccuracy[topicKey]) topicAccuracy[topicKey] = { correct: 0, total: 0 };
    topicAccuracy[topicKey].correct += quiz.correctAnswers || 0;
    topicAccuracy[topicKey].total += quiz.totalQuestions || 0;

    // Subject accuracy
    if (quiz.subject) {
      if (!subjectAccuracy[quiz.subject]) subjectAccuracy[quiz.subject] = { correct: 0, total: 0 };
      subjectAccuracy[quiz.subject].correct += quiz.correctAnswers || 0;
      subjectAccuracy[quiz.subject].total += quiz.totalQuestions || 0;
    }

    // Difficulty breakdown
    if (quiz.difficulty && difficultyBreakdown[quiz.difficulty]) {
      difficultyBreakdown[quiz.difficulty].correct += quiz.correctAnswers || 0;
      difficultyBreakdown[quiz.difficulty].total += quiz.totalQuestions || 0;
    }

    if (quiz.domainStats && typeof quiz.domainStats === 'object') {
      Object.entries(quiz.domainStats).forEach(([domain, v]) => {
        const cor = typeof v?.correct === 'number' ? v.correct : 0;
        const tot = typeof v?.total === 'number' ? v.total : 0;
        if (!domainAccuracy[domain]) domainAccuracy[domain] = { correct: 0, total: 0 };
        domainAccuracy[domain].correct += cor;
        domainAccuracy[domain].total += tot;
      });
    }
  });

  const topicPerformance = Object.entries(topicAccuracy).map(([topic, data]) => ({
    topic,
    accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    total: data.total,
  }));

  const weakAreas = topicPerformance.filter((t) => t.accuracy < 60).sort((a, b) => a.accuracy - b.accuracy);
  const strongAreas = topicPerformance.filter((t) => t.accuracy >= 80).sort((a, b) => b.accuracy - a.accuracy);

  const domainPerformance = Object.entries(domainAccuracy).map(([topic, data]) => ({
    topic,
    accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    total: data.total,
  }));
  const domainWeakAreas = domainPerformance.filter((t) => t.accuracy < 60 && t.total > 0).sort((a, b) => a.accuracy - b.accuracy);

  const recentTrend = history.slice(-10).map((quiz, idx) => ({
    quiz: idx + 1,
    accuracy: quiz.totalQuestions > 0 ? Math.round((quiz.correctAnswers / quiz.totalQuestions) * 100) : 0,
    date: new Date(quiz.timestamp).toLocaleDateString(),
    topic: quiz.topic,
  }));

  return {
    totalQuizzes: history.length,
    totalQuestions,
    totalCorrect,
    overallAccuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    topicAccuracy,
    subjectAccuracy,
    domainAccuracy,
    difficultyBreakdown,
    recentTrend,
    weakAreas,
    strongAreas,
    topicPerformance,
    domainWeakAreas,
    domainPerformance,
  };
}

// ===== Leaderboard =====

async function updateLeaderboard(uid, quizResult) {
  const user = await getUserProfile(uid);
  if (!user) return;

  const classCode = user.classCode || 'global';
  const leaderRef = ref(db, `leaderboard/${classCode}/${uid}`);
  const snap = await get(leaderRef);

  const existing = snap.exists()
    ? snap.val()
    : { name: user.name, avatar: user.avatar || '🧑‍🎓', xp: 0, quizzes: 0, totalCorrect: 0, totalQuestions: 0, accuracy: 0 };

  existing.xp = user.xp || 0;
  existing.name = user.name;
  existing.quizzes += 1;
  existing.totalCorrect += quizResult.correctAnswers || 0;
  existing.totalQuestions += quizResult.totalQuestions || 0;
  existing.accuracy = existing.totalQuestions > 0
    ? Math.round((existing.totalCorrect / existing.totalQuestions) * 100) : 0;

  await set(leaderRef, existing);
}

export async function getLeaderboard(classCode = 'global') {
  const snap = await get(ref(db, `leaderboard/${classCode}`));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.entries(data)
    .map(([userId, entry]) => ({ userId, ...entry }))
    .sort((a, b) => b.xp - a.xp);
}

// ===== Badge Management =====

export async function getUserBadges(uid) {
  const snap = await get(ref(db, `badges/${uid}`));
  return snap.exists() ? snap.val() : [];
}

export async function awardBadge(uid, badgeId) {
  const badges = await getUserBadges(uid);
  if (Array.isArray(badges) && !badges.includes(badgeId)) {
    badges.push(badgeId);
    await set(ref(db, `badges/${uid}`), badges);
    return true;
  }
  return false;
}

// ===== XP Management =====

export async function addXP(uid, amount) {
  const user = await getUserProfile(uid);
  if (!user) return null;

  const newXP = (user.xp || 0) + amount;
  const newLevel = Math.floor(newXP / 250) + 1;

  await update(ref(db, `users/${uid}`), { xp: newXP, level: newLevel });

  return { ...user, xp: newXP, level: newLevel };
}

// ===== Custom Quiz Management (Educator) =====

export async function getCustomQuizzes(educatorUid) {
  const snap = await get(ref(db, `customQuizzes/${educatorUid}`));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.entries(data).map(([id, quiz]) => ({ id, ...quiz }));
}

export async function saveCustomQuiz(educatorUid, quiz) {
  const quizRef = push(ref(db, `customQuizzes/${educatorUid}`));
  const newQuiz = {
    ...quiz,
    createdAt: new Date().toISOString(),
  };
  await set(quizRef, newQuiz);
  return { id: quizRef.key, ...newQuiz };
}

// ===== Educator: Get Class Students =====

export async function getClassStudents(classCode) {
  const users = await getAllUsers();
  return users.filter((u) => u.role === 'student' && u.classCode === classCode);
}

export async function getStudentPerformance(studentId) {
  return getPerformanceData(studentId);
}

// ===== Intro Quiz (First-time onboarding) =====

export async function saveIntroQuizResult(uid, payload) {
  const {
    score,
    totalQuestions,
    selectedSubject,
    studyDomainIds,
    studyKeywords,
    onboardingDomainScores,
    onboardingQuizSummary,
    onboardingIntroAccuracy,
  } = payload;

  const updatePayload = {
    introQuizCompleted: true,
    introQuizScore: score,
    introQuizTotal: totalQuestions,
  };
  if (selectedSubject !== undefined) updatePayload.selectedSubject = selectedSubject;
  if (studyDomainIds !== undefined) updatePayload.studyDomainIds = studyDomainIds;
  if (studyKeywords !== undefined) updatePayload.studyKeywords = studyKeywords;
  if (onboardingDomainScores !== undefined) updatePayload.onboardingDomainScores = onboardingDomainScores;
  if (onboardingQuizSummary !== undefined) updatePayload.onboardingQuizSummary = onboardingQuizSummary;
  if (onboardingIntroAccuracy !== undefined) updatePayload.onboardingIntroAccuracy = onboardingIntroAccuracy;

  await update(ref(db, `users/${uid}`), updatePayload);
}
