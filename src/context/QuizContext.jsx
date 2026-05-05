import { createContext, useContext, useState, useCallback } from 'react';
import quizData from '../data/quizData';
import { useAuth } from './AuthContext';
import {
  saveQuizResult,
  addXP,
  getQuizHistory,
  getUserBadges,
  awardBadge,
  getPerformanceData,
} from '../services/storageService';
import { badgeDefinitions } from '../data/quizData';
import { calculateDifficultyAdjustment } from '../services/aiService';

const QuizContext = createContext(null);

export function QuizProvider({ children }) {
  const { user, updateUser } = useAuth();
  
  // Quiz state
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [quizComplete, setQuizComplete] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [currentDifficulty, setCurrentDifficulty] = useState('medium');
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [timePerQuestion, setTimePerQuestion] = useState([]);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [newBadges, setNewBadges] = useState([]);
  const [showBadgePopup, setShowBadgePopup] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  // Start a new quiz
  const startQuiz = useCallback((subject, topic, difficulty = 'medium', numQuestions = 5) => {
    const topicQuestions = quizData[subject]?.[topic];
    if (!topicQuestions || topicQuestions.length === 0) return false;

    // Filter by difficulty and adjust
    let filteredQuestions = topicQuestions.filter(q => q.difficulty === difficulty);
    
    // If not enough questions at this difficulty, include adjacent difficulties
    if (filteredQuestions.length < numQuestions) {
      filteredQuestions = topicQuestions;
    }

    // Shuffle and pick
    const shuffled = [...filteredQuestions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(numQuestions, shuffled.length));

    setCurrentQuiz({
      subject,
      topic,
      difficulty,
      questions: selected,
      startTime: Date.now(),
    });
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setQuizComplete(false);
    setQuizResult(null);
    setCurrentDifficulty(difficulty);
    setStreak(0);
    setMaxStreak(0);
    setTimePerQuestion([]);
    setQuestionStartTime(Date.now());
    setNewBadges([]);

    return true;
  }, []);

  // Check and award badges
  const checkBadges = useCallback(async (result) => {
    if (!user) return;

    try {
      const [history, existingBadges] = await Promise.all([
        getQuizHistory(user.id),
        getUserBadges(user.id)
      ]);

      const stats = {
        totalQuizzes: history.length,
        perfectScores: history.filter(q => q.correctAnswers === q.totalQuestions).length,
        maxStreak: result.maxStreak || 0,
        subjectsAttempted: new Set(history.map(q => q.subject)).size,
        fastAnswers: result.answers ? result.answers.filter(a => a.correct && a.timeTaken < 10).length : 0,
        totalXP: (user.xp || 0) + result.xpEarned,
        hardQuizHighScore: result.difficulty === 'hard' ? result.accuracy : 0,
        loginStreak: user.loginStreak || 0,
      };

      const earned = [];
      for (const badge of badgeDefinitions) {
        if (!existingBadges.includes(badge.id) && badge.condition(stats)) {
          await awardBadge(user.id, badge.id);
          await addXP(user.id, badge.xpReward);
          earned.push(badge);
        }
      }

      if (earned.length > 0) {
        setNewBadges(earned);
        setShowBadgePopup(true);
      }
    } catch(err) {
      console.error("Failed to check badges", err);
    }
  }, [user]);

  // Finish quiz and calculate results
  const finishQuiz = useCallback(async (finalAnswers) => {
    if (!currentQuiz || !user || isFinishing) return;
    
    setIsFinishing(true);
    
    try {
      const correctCount = finalAnswers.filter(a => a.correct).length;
      const totalQuestions = currentQuiz.questions.length;
      const accuracy = Math.round((correctCount / totalQuestions) * 100);
      const totalTime = finalAnswers.reduce((sum, a) => sum + a.timeTaken, 0);

      // Calculate XP
      let xpEarned = correctCount * 10; // Base XP
      if (accuracy === 100) xpEarned += 50; // Perfect bonus
      if (currentQuiz.difficulty === 'hard') xpEarned *= 1.5;
      else if (currentQuiz.difficulty === 'medium') xpEarned *= 1.2;
      xpEarned = Math.round(xpEarned);

      const result = {
        subject: currentQuiz.subject,
        topic: currentQuiz.topic,
        difficulty: currentQuiz.difficulty,
        totalQuestions,
        correctAnswers: correctCount,
        accuracy,
        timeTaken: Math.round(totalTime),
        xpEarned,
        answers: finalAnswers,
        maxStreak: maxStreak > streak ? maxStreak : (finalAnswers[finalAnswers.length - 1]?.correct ? streak + 1 : streak),
      };

      // Save to storage
      await saveQuizResult(user.id, result);
      await addXP(user.id, xpEarned);

      // Check for new badges
      await checkBadges(result);

      // Update user context
      updateUser({ xp: (user.xp || 0) + xpEarned, level: Math.floor(((user.xp || 0) + xpEarned) / 250) + 1 });

      setQuizResult(result);
      setQuizComplete(true);
    } catch(err) {
       console.error("Failed to finish quiz and save data", err);
    } finally {
       setIsFinishing(false);
    }
  }, [currentQuiz, user, maxStreak, streak, updateUser, checkBadges, isFinishing]);

  // Answer a question
  const answerQuestion = useCallback((selectedOption) => {
    if (!currentQuiz || isFinishing) return;

    const question = currentQuiz.questions[currentQuestionIndex];
    const isCorrect = selectedOption === question.correct;
    const timeTaken = (Date.now() - questionStartTime) / 1000;

    const answer = {
      questionId: question.id,
      selectedOption,
      correct: isCorrect,
      timeTaken,
      difficulty: question.difficulty,
    };

    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    setTimePerQuestion(prev => [...prev, timeTaken]);

    // Update streak
    if (isCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
    } else {
      setStreak(0);
    }

    // Dynamic difficulty adjustment
    if (newAnswers.length >= 3) {
      const adjusted = calculateDifficultyAdjustment(newAnswers, currentDifficulty);
      if (adjusted !== currentDifficulty) {
        setCurrentDifficulty(adjusted);
      }
    }

    // Check if quiz is complete
    if (currentQuestionIndex + 1 >= currentQuiz.questions.length) {
      finishQuiz(newAnswers);
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      setQuestionStartTime(Date.now());
    }
  }, [currentQuiz, currentQuestionIndex, answers, questionStartTime, streak, maxStreak, currentDifficulty, finishQuiz, isFinishing]);

  // Reset quiz
  const resetQuiz = useCallback(() => {
    setCurrentQuiz(null);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setQuizComplete(false);
    setQuizResult(null);
    setStreak(0);
    setMaxStreak(0);
    setTimePerQuestion([]);
    setNewBadges([]);
    setShowBadgePopup(false);
  }, []);

  // Get available subjects and topics
  const getSubjects = useCallback(() => {
    return Object.keys(quizData);
  }, []);

  const getTopics = useCallback((subject) => {
    return quizData[subject] ? Object.keys(quizData[subject]) : [];
  }, []);

  const value = {
    // State
    currentQuiz,
    currentQuestionIndex,
    currentQuestion: currentQuiz?.questions?.[currentQuestionIndex] || null,
    answers,
    quizComplete,
    quizResult,
    currentDifficulty,
    streak,
    maxStreak,
    timePerQuestion,
    newBadges,
    showBadgePopup,
    progress: currentQuiz ? ((currentQuestionIndex) / currentQuiz.questions.length) * 100 : 0,
    isFinishing,
    
    // Actions
    startQuiz,
    answerQuestion,
    resetQuiz,
    getSubjects,
    getTopics,
    setShowBadgePopup,
  };

  return (
    <QuizContext.Provider value={value}>
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  const context = useContext(QuizContext);
  if (!context) {
    throw new Error('useQuiz must be used within a QuizProvider');
  }
  return context;
}

export default QuizContext;
