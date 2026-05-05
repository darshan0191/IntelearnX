/**
 * Teacher Quiz Service — Firebase Realtime Database
 * CRUD for teacher-created quizzes (MCQ + Theory) and student submissions.
 *
 * Data shape:
 *   /teacherQuizzes/{quizId}  → quiz metadata + questions
 *   /teacherQuizSubmissions/{quizId}/{studentId} → student answers + scores
 */
import { db } from '../firebase';
import { ref, set, get, push, update, remove } from 'firebase/database';

// ─── Quiz CRUD (Teacher) ───────────────────────────────────────

/**
 * Create a new quiz under the teacher's ID.
 * Returns { id, ...quiz }.
 */
export async function createTeacherQuiz(educatorId, quizData) {
  const quizRef = push(ref(db, 'teacherQuizzes'));
  const quiz = {
    ...quizData,
    educatorId,
    createdAt: new Date().toISOString(),
    status: 'active', // active | archived
  };
  await set(quizRef, quiz);
  return { id: quizRef.key, ...quiz };
}

/**
 * Update an existing quiz.
 */
export async function updateTeacherQuiz(quizId, updates) {
  await update(ref(db, `teacherQuizzes/${quizId}`), {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Delete a quiz and all its submissions.
 */
export async function deleteTeacherQuiz(quizId) {
  await remove(ref(db, `teacherQuizzes/${quizId}`));
  await remove(ref(db, `teacherQuizSubmissions/${quizId}`));
}

/**
 * Get all quizzes created by a specific educator.
 */
export async function getTeacherQuizzes(educatorId) {
  const snap = await get(ref(db, 'teacherQuizzes'));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.entries(data)
    .filter(([, q]) => q.educatorId === educatorId)
    .map(([id, q]) => ({ id, ...q }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get a single quiz by ID.
 */
export async function getTeacherQuizById(quizId) {
  const snap = await get(ref(db, `teacherQuizzes/${quizId}`));
  return snap.exists() ? { id: quizId, ...snap.val() } : null;
}

/**
 * Get all *active* quizzes (for student quiz-browse page).
 */
export async function getAllActiveTeacherQuizzes() {
  const snap = await get(ref(db, 'teacherQuizzes'));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.entries(data)
    .filter(([, q]) => q.status === 'active')
    .map(([id, q]) => ({ id, ...q }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ─── Submissions (Student) ─────────────────────────────────────

/**
 * Submit a student's answers to a teacher quiz.
 */
export async function submitTeacherQuiz(quizId, studentId, submission) {
  const subRef = ref(db, `teacherQuizSubmissions/${quizId}/${studentId}`);
  const data = {
    ...submission,
    submittedAt: new Date().toISOString(),
    graded: submission.graded ?? false,
  };
  await set(subRef, data);
  return data;
}

/**
 * Get a student's submission for a quiz (or null).
 */
export async function getStudentSubmission(quizId, studentId) {
  const snap = await get(ref(db, `teacherQuizSubmissions/${quizId}/${studentId}`));
  return snap.exists() ? snap.val() : null;
}

/**
 * Get all submissions for a quiz (for teacher grading view).
 */
export async function getQuizSubmissions(quizId) {
  const snap = await get(ref(db, `teacherQuizSubmissions/${quizId}`));
  if (!snap.exists()) return [];
  const data = snap.val();
  return Object.entries(data).map(([studentId, sub]) => ({ studentId, ...sub }));
}

/**
 * Teacher grades a theory answer for a student.
 */
export async function gradeTheoryAnswer(quizId, studentId, questionIndex, score, feedback) {
  const basePath = `teacherQuizSubmissions/${quizId}/${studentId}`;
  await update(ref(db, basePath), {
    [`grades/${questionIndex}`]: { score, feedback, gradedAt: new Date().toISOString() },
  });
}
