import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';
import { LuClock, LuZap, LuFlame, LuCheck, LuX, LuArrowRight, LuGauge, LuTrophy } from 'react-icons/lu';
import './QuizPlay.css';

export default function QuizPlay() {
  const {
    currentQuiz,
    currentQuestion,
    currentQuestionIndex,
    quizComplete,
    currentDifficulty,
    streak,
    answerQuestion,
  } = useQuiz();
  const navigate = useNavigate();

  const [selected, setSelected] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);

  useEffect(() => {
    if (!currentQuiz) navigate('/quiz/select');
  }, [currentQuiz, navigate]);

  // Show completion popup then navigate
  useEffect(() => {
    if (quizComplete) {
      setShowCompletionPopup(true);
      const t = setTimeout(() => navigate('/quiz/result'), 2800);
      return () => clearTimeout(t);
    }
  }, [quizComplete, navigate]);

  useEffect(() => {
    if (!showFeedback && currentQuestion) {
      const interval = setInterval(() => setTimer(prev => prev + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [showFeedback, currentQuestion, currentQuestionIndex]);

  useEffect(() => {
    setSelected(null);
    setShowFeedback(false);
    setTimer(0);
  }, [currentQuestionIndex]);

  if (!currentQuiz || !currentQuestion) return null;

  const handleSelect = (optionIdx) => {
    if (showFeedback) return;
    setSelected(optionIdx);
  };

  const handleSubmit = () => {
    if (selected === null) return;
    const correct = selected === currentQuestion.correct;
    setIsCorrect(correct);
    setShowFeedback(true);
    setTimeout(() => answerQuestion(selected), 1500);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const difficultyColors = { easy: '#10b981', medium: '#E0A546', hard: '#f43f5e' };
  const totalQ = currentQuiz.questions.length;
  const progressPct = ((currentQuestionIndex + 1) / totalQ) * 100;

  return (
    <div className="quiz-play animate-fadeIn">

      {/* ── Completion Popup ── */}
      {showCompletionPopup && (
        <div className="cp-overlay">
          <div className="cp-card">
            {/* shimmer top bar */}
            <div className="cp-shimmer-bar" />

            {/* burst rings + trophy */}
            <div className="cp-burst">
              <span className="cp-ring cp-ring-1" />
              <span className="cp-ring cp-ring-2" />
              <span className="cp-ring cp-ring-3" />
              <div className="cp-trophy-wrap">
                <LuTrophy className="cp-trophy-icon" />
              </div>
            </div>

            {/* floating emoji confetti */}
            <div className="cp-confetti" aria-hidden>
              {['🎉','⭐','🔥','✨','🏆','💥','🎊','⚡','🎯','💡'].map((e, i) => (
                <span key={i} className="cp-piece" style={{ '--ci': i }}>{e}</span>
              ))}
            </div>

            <h2 className="cp-title">Quiz Complete!</h2>
            <p className="cp-sub">Hang tight — calculating your results…</p>

            {/* animated fill bar */}
            <div className="cp-bar-track">
              <div className="cp-bar-fill" />
            </div>
          </div>
        </div>
      )}

      {/* ── Top Bar ── */}
      <div className="quiz-topbar">
        <div className="quiz-info-bar">
          <div className="quiz-meta">
            <span className="quiz-subject-tag">{currentQuiz.subject}</span>
            <span className="quiz-topic-tag">{currentQuiz.topic}</span>
          </div>
          <div className="quiz-stats-bar">
            <div className="quiz-stat-item" title="Time">
              <LuClock /><span>{formatTime(timer)}</span>
            </div>
            <div className="quiz-stat-item" title="Streak">
              <LuFlame style={{ color: streak > 0 ? '#E0A546' : undefined }} />
              <span>{streak}</span>
            </div>
            <div className="quiz-stat-item" title="Difficulty" style={{ color: difficultyColors[currentDifficulty] }}>
              <LuGauge /><span>{currentDifficulty}</span>
            </div>
          </div>
        </div>
        <div className="quiz-progress-wrapper">
          <div className="quiz-progress-bar">
            <div className="quiz-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="quiz-progress-text">{currentQuestionIndex + 1} / {totalQ}</span>
        </div>
      </div>

      {/* ── Question Card ── */}
      <div className="question-card animate-scaleIn" key={currentQuestionIndex}>
        <div className="question-difficulty" style={{ color: difficultyColors[currentQuestion.difficulty] }}>
          {currentQuestion.difficulty.toUpperCase()}
        </div>
        <h2 className="question-text">{currentQuestion.question}</h2>

        <div className="options-list">
          {currentQuestion.options.map((option, idx) => {
            let cls = 'option-btn';
            if (showFeedback) {
              if (idx === currentQuestion.correct) cls += ' correct';
              else if (idx === selected && idx !== currentQuestion.correct) cls += ' incorrect';
            } else if (selected === idx) cls += ' selected';

            return (
              <button key={idx} className={cls} onClick={() => handleSelect(idx)} disabled={showFeedback} id={`option-${idx}`}>
                <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
                <span className="option-text">{option}</span>
                {showFeedback && idx === currentQuestion.correct && <LuCheck className="option-feedback-icon correct-icon" />}
                {showFeedback && idx === selected && idx !== currentQuestion.correct && <LuX className="option-feedback-icon incorrect-icon" />}
              </button>
            );
          })}
        </div>

        {showFeedback && (
          <div className={`answer-feedback ${isCorrect ? 'correct-feedback' : 'incorrect-feedback'}`}>
            <div className="feedback-header">
              {isCorrect ? (
                <>
                  <LuCheck /> Correct! +{currentQuiz.difficulty === 'hard' ? 15 : currentQuiz.difficulty === 'medium' ? 12 : 10} XP
                  {streak >= 2 && <span className="streak-bonus">🔥 {streak + 1} streak!</span>}
                </>
              ) : <><LuX /> Incorrect</>}
            </div>
            {!isCorrect && currentQuestion.explanation && (
              <p className="feedback-explanation">{currentQuestion.explanation}</p>
            )}
          </div>
        )}

        {!showFeedback && (
          <button className="btn btn-primary btn-lg next-btn" onClick={handleSubmit} disabled={selected === null} id="submit-answer-btn">
            Submit Answer <LuArrowRight />
          </button>
        )}
      </div>
    </div>
  );
}
