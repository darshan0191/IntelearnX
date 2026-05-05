import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';
import { useAuth } from '../context/AuthContext';
import { getTopicExplanation } from '../services/aiService';
import { resourceBank } from '../data/quizData';
import {
  LuTrophy, LuTarget, LuClock, LuFlame, LuZap,
  LuRotateCcw, LuBookOpen, LuSparkles, LuExternalLink,
  LuCheck, LuX, LuChevronDown, LuChevronUp,
} from 'react-icons/lu';
import './QuizResult.css';

/* ── per-question accordion item ── */
function ReviewItem({ q, idx, answer, onAIHelp, aiLoading, aiExplanation, aiTargetIdx }) {
  const [open, setOpen] = useState(!answer.correct);

  return (
    <div className={`rw-item ${answer.correct ? 'rw-correct' : 'rw-incorrect'}`}>
      {/* header row — always visible */}
      <button className="rw-header" onClick={() => setOpen(o => !o)}>
        <span className={`rw-badge ${answer.correct ? 'rw-badge-ok' : 'rw-badge-err'}`}>
          {answer.correct ? <LuCheck /> : <LuX />}
        </span>
        <span className="rw-num">Q{idx + 1}</span>
        <span className="rw-question-preview">{q.question}</span>
        <span className="rw-time">{answer.timeTaken?.toFixed(1)}s</span>
        {open ? <LuChevronUp className="rw-chevron" /> : <LuChevronDown className="rw-chevron" />}
      </button>

      {/* expanded body */}
      {open && (
        <div className="rw-body">
          {answer.correct ? (
            <div className="rw-correct-row">
              <LuCheck style={{ color: 'var(--success)' }} />
              <span>You answered correctly: <strong>{q.options[answer.selectedOption]}</strong></span>
            </div>
          ) : (
            <div className="rw-answers-grid">
              <div className="rw-answer-box rw-answer-wrong">
                <span className="rw-answer-label">Your answer</span>
                <span className="rw-answer-text">{q.options[answer.selectedOption]}</span>
              </div>
              <div className="rw-answer-box rw-answer-right">
                <span className="rw-answer-label">Correct answer</span>
                <span className="rw-answer-text">{q.options[q.correct]}</span>
              </div>
            </div>
          )}

          {!answer.correct && q.explanation && (
            <p className="rw-explanation">{q.explanation}</p>
          )}

          {!answer.correct && (
            <button
              className="btn btn-sm btn-secondary rw-ai-btn"
              onClick={() => onAIHelp(q, answer.selectedOption, q.correct, idx)}
              disabled={aiLoading && aiTargetIdx === idx}
            >
              <LuSparkles />
              {aiLoading && aiTargetIdx === idx ? 'Generating…' : 'AI Explanation'}
            </button>
          )}

          {aiTargetIdx === idx && aiExplanation && (
            <div className="rw-ai-card">
              <div className="rw-ai-header"><LuSparkles /> AI-Powered Explanation</div>
              <p>{aiExplanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function QuizResult() {
  const { quizResult, currentQuiz, resetQuiz, newBadges, showBadgePopup, setShowBadgePopup } = useQuiz();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [aiExplanation, setAiExplanation] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiTargetIdx, setAiTargetIdx] = useState(null);

  useEffect(() => {
    if (!quizResult) navigate('/quiz/select');
  }, [quizResult, navigate]);

  const getAIHelp = async (question, userAnswer, correctAnswer, idx) => {
    setAiLoading(true);
    setAiTargetIdx(idx);
    setAiExplanation('');
    const explanation = await getTopicExplanation(
      question.question,
      question.options[userAnswer],
      question.options[correctAnswer],
      currentQuiz?.topic || ''
    );
    setAiExplanation(explanation);
    setAiLoading(false);
  };

  if (!quizResult) return null;

  const { accuracy, correctAnswers, totalQuestions, timeTaken, xpEarned, maxStreak, answers } = quizResult;
  const resources = resourceBank[quizResult.subject]?.[quizResult.topic] || [];

  const getGrade = () => {
    if (accuracy === 100) return { grade: 'S', color: '#fbbf24', label: 'Perfect!', bg: 'rgba(251,191,36,0.12)' };
    if (accuracy >= 80)  return { grade: 'A', color: '#10b981', label: 'Excellent!', bg: 'rgba(16,185,129,0.1)' };
    if (accuracy >= 60)  return { grade: 'B', color: '#3b82f6', label: 'Good job!', bg: 'rgba(59,130,246,0.1)' };
    if (accuracy >= 40)  return { grade: 'C', color: '#E0A546', label: 'Keep trying!', bg: 'rgba(224,165,70,0.1)' };
    return { grade: 'D', color: '#f43f5e', label: 'Needs work', bg: 'rgba(244,63,94,0.1)' };
  };
  const grade = getGrade();

  const wrongCount = answers.filter(a => !a.correct).length;
  const avgTime = answers.length ? (answers.reduce((s, a) => s + (a.timeTaken || 0), 0) / answers.length).toFixed(1) : 0;

  return (
    <div className="quiz-result animate-fadeIn">

      {/* ── Badge Popup ── */}
      {showBadgePopup && newBadges.length > 0 && (
        <div className="bp-overlay" onClick={() => setShowBadgePopup(false)}>
          <div className="bp-card" onClick={e => e.stopPropagation()}>
            <div className="bp-shimmer" />
            <div className="bp-emoji-row">🎉</div>
            <h3 className="bp-title">Badge{newBadges.length > 1 ? 's' : ''} Unlocked!</h3>
            <div className="bp-list">
              {newBadges.map(badge => (
                <div key={badge.id} className="bp-item">
                  <span className="bp-icon">{badge.icon}</span>
                  <div className="bp-info">
                    <div className="bp-name">{badge.name}</div>
                    <div className="bp-desc">{badge.description}</div>
                  </div>
                  <span className="bp-xp">+{badge.xpReward} XP</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => setShowBadgePopup(false)}>Awesome!</button>
          </div>
        </div>
      )}

      {/* ── Result Hero ── */}
      <div className="qr-hero" style={{ '--gc': grade.color, '--gb': grade.bg }}>
        <div className="qr-grade-wrap">
          <div className="qr-grade-ring">
            <span className="qr-grade-letter">{grade.grade}</span>
          </div>
        </div>
        <div className="qr-hero-info">
          <h1 className="qr-hero-title">{grade.label}</h1>
          <p className="qr-hero-sub">{quizResult.subject} · {quizResult.topic} · {quizResult.difficulty}</p>
        </div>
      </div>

      {/* ── Stats Strip ── */}
      <div className="qr-stats">
        {[
          { icon: <LuTarget />, value: `${accuracy}%`, label: 'Accuracy', color: grade.color },
          { icon: <LuTrophy />, value: `${correctAnswers}/${totalQuestions}`, label: 'Correct', color: '#10b981' },
          { icon: <LuX />,     value: wrongCount, label: 'Wrong', color: '#f43f5e' },
          { icon: <LuClock />, value: `${timeTaken}s`, label: 'Total Time', color: '#3b82f6' },
          { icon: <LuClock />, value: `${avgTime}s`, label: 'Avg / Q', color: '#8b5cf6' },
          { icon: <LuFlame />, value: maxStreak, label: 'Best Streak', color: '#E0A546' },
          { icon: <LuZap />,   value: `+${xpEarned}`, label: 'XP Earned', color: '#D4645C' },
        ].map((s, i) => (
          <div key={i} className="qr-stat-card" style={{ '--sc': s.color }}>
            <span className="qr-stat-icon">{s.icon}</span>
            <span className="qr-stat-value">{s.value}</span>
            <span className="qr-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Answer Review ── */}
      <div className="qr-section">
        <div className="qr-section-head">
          <h2 className="qr-section-title">Answer Review</h2>
          <div className="qr-review-legend">
            <span className="qr-legend-dot qr-legend-ok" /><span>{correctAnswers} correct</span>
            <span className="qr-legend-dot qr-legend-err" /><span>{wrongCount} wrong</span>
          </div>
        </div>

        {/* accuracy bar */}
        <div className="qr-accuracy-bar-wrap">
          <div className="qr-accuracy-bar">
            <div className="qr-accuracy-fill" style={{ width: `${accuracy}%`, background: grade.color }} />
          </div>
          <span className="qr-accuracy-pct" style={{ color: grade.color }}>{accuracy}%</span>
        </div>

        <div className="rw-list">
          {currentQuiz?.questions.map((q, idx) => {
            const answer = answers[idx];
            if (!answer) return null;
            return (
              <ReviewItem
                key={idx}
                q={q} idx={idx} answer={answer}
                onAIHelp={getAIHelp}
                aiLoading={aiLoading}
                aiExplanation={aiExplanation}
                aiTargetIdx={aiTargetIdx}
              />
            );
          })}
        </div>
      </div>

      {/* ── Resources ── */}
      {accuracy < 80 && resources.length > 0 && (
        <div className="qr-section">
          <h2 className="qr-section-title">📚 Recommended Resources</h2>
          <p className="qr-section-sub">Study these to improve your {quizResult.topic} skills</p>
          <div className="qr-resources-grid">
            {resources.map((res, idx) => (
              <a key={idx} href={res.url} target="_blank" rel="noopener noreferrer" className="qr-resource-card">
                <span className="qr-resource-type">
                  {res.type === 'video' ? '🎥' : res.type === 'article' ? '📄' : '💻'} {res.type}
                </span>
                <h4>{res.title}</h4>
                <div className="qr-resource-footer">
                  ⭐ {res.rating} <LuExternalLink />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="qr-actions">
        <button className="btn btn-primary btn-lg" onClick={() => { resetQuiz(); navigate('/quiz/select'); }}>
          <LuRotateCcw /> Take Another Quiz
        </button>
        <Link to="/student-dashboard" className="btn btn-secondary btn-lg" onClick={resetQuiz}>
          <LuBookOpen /> View Dashboard
        </Link>
      </div>
    </div>
  );
}
