import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getAllActiveTeacherQuizzes,
  getTeacherQuizById,
  submitTeacherQuiz,
  getStudentSubmission,
} from '../services/teacherQuizService';
import {
  LuBookOpen, LuClock, LuHash, LuLoader, LuArrowRight,
  LuCircleCheck, LuArrowLeft, LuSend, LuUser,
  LuFileText, LuPenLine, LuCircleAlert, LuTimer, LuAward,
} from 'react-icons/lu';
import './TeacherQuizPlay.css';

export default function TeacherQuizPlay() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── States ─────────────────────────────────────────
  const [view, setView] = useState('browse'); // browse | play | result
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active quiz
  const [quiz, setQuiz] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState({});

  // Timer
  const [timeLeft, setTimeLeft] = useState(0);

  // ── Load all quizzes ────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const all = await getAllActiveTeacherQuizzes();
        setQuizzes(all);

        // Check which quizzes the student already submitted
        const subMap = {};
        for (const q of all) {
          const sub = await getStudentSubmission(q.id, user.id);
          if (sub) subMap[q.id] = sub;
        }
        setAlreadySubmitted(subMap);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ── Timer countdown ────────────────────────────────
  useEffect(() => {
    if (view !== 'play' || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [view, timeLeft]);

  // ── Start quiz ─────────────────────────────────────
  const startQuiz = async (quizId) => {
    try {
      const fullQuiz = await getTeacherQuizById(quizId);
      if (!fullQuiz) return;
      setQuiz(fullQuiz);
      setCurrentQ(0);
      setAnswers({});
      setTimeLeft((fullQuiz.timeLimit || 30) * 60);
      setView('play');
    } catch (e) {
      console.error(e);
    }
  };

  // ── Answer handlers ────────────────────────────────
  const selectMCQ = (qIdx, optIdx) => {
    setAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const setTheoryAnswer = (qIdx, text) => {
    setAnswers((prev) => ({ ...prev, [qIdx]: text }));
  };

  // ── Submit ─────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!quiz || submitting) return;
    setSubmitting(true);

    const questions = quiz.questions || [];
    let autoScore = 0;
    let totalPoints = 0;
    let hasTheory = false;

    const formattedAnswers = questions.map((q, idx) => {
      totalPoints += q.points || 1;

      if (q.type === 'mcq') {
        const selected = answers[idx];
        const isCorrect = selected === q.correctAnswer;
        if (isCorrect) autoScore += q.points || 1;
        return {
          type: 'mcq',
          question: q.question,
          selected,
          correctAnswer: q.correctAnswer,
          isCorrect,
          points: q.points || 1,
        };
      } else {
        hasTheory = true;
        return {
          type: 'theory',
          question: q.question,
          answer: answers[idx] || '',
          points: q.points || 1,
          maxWords: q.maxWords || 500,
        };
      }
    });

    try {
      await submitTeacherQuiz(quiz.id, user.id, {
        answers: formattedAnswers,
        autoScore,
        totalPoints,
        hasTheory,
        studentName: user.name,
        graded: !hasTheory,
      });

      setResult({ autoScore, totalPoints, hasTheory, answers: formattedAnswers });
      setView('result');
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }, [quiz, answers, user, submitting]);

  // ── Format time ────────────────────────────────────
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ═══════════════════════════════════════════════════
  //  BROWSE VIEW — list of teacher quizzes
  // ═══════════════════════════════════════════════════
  if (view === 'browse') {
    if (loading) {
      return (
        <div className="tqp-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <LuLoader className="pq-spin" style={{ fontSize: '2rem', color: 'var(--accent)' }} />
        </div>
      );
    }

    return (
      <div className="tqp-page animate-fadeIn">
        <div className="tqp-browse-header">
          <div className="tqp-browse-icon"><LuFileText /></div>
          <div>
            <h1>Teacher Quizzes</h1>
            <p>Quizzes created by your teachers — solve them to test your knowledge</p>
          </div>
        </div>

        {quizzes.length === 0 ? (
          <div className="tqp-empty">
            <LuBookOpen />
            <h3>No quizzes available</h3>
            <p>Your teachers haven't created any quizzes yet. Check back later!</p>
          </div>
        ) : (
          <div className="tqp-quiz-grid">
            {quizzes.map((q) => {
              const done = !!alreadySubmitted[q.id];
              return (
                <div key={q.id} className={`tqp-quiz-card ${done ? 'tqp-quiz-card--done' : ''}`}>
                  <div className="tqp-quiz-card-top">
                    <div className="tqp-quiz-card-tags">
                      {(q.questions || []).some(x => x.type === 'mcq') && (
                        <span className="tqp-tag tqp-tag--mcq">MCQ</span>
                      )}
                      {(q.questions || []).some(x => x.type === 'theory') && (
                        <span className="tqp-tag tqp-tag--theory">Theory</span>
                      )}
                    </div>
                    {done && (
                      <span className="tqp-done-badge"><LuCircleCheck /> Completed</span>
                    )}
                  </div>
                  <h3>{q.title}</h3>
                  {q.description && <p className="tqp-quiz-desc">{q.description}</p>}
                  <div className="tqp-quiz-meta">
                    <span><LuBookOpen /> {q.subject}</span>
                    <span><LuHash /> {q.questionCount} Qs</span>
                    <span><LuClock /> {q.timeLimit} min</span>
                    <span><LuUser /> {q.educatorName}</span>
                  </div>
                  {done ? (
                    <div className="tqp-score-summary">
                      Score: {alreadySubmitted[q.id].autoScore} / {alreadySubmitted[q.id].totalPoints}
                      {alreadySubmitted[q.id].hasTheory && (
                        <span className="tqp-theory-note"> (theory answers pending review)</span>
                      )}
                    </div>
                  ) : (
                    <button className="btn btn-primary tqp-start-btn" onClick={() => startQuiz(q.id)}>
                      Start Quiz <LuArrowRight />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  //  PLAY VIEW — solving the quiz
  // ═══════════════════════════════════════════════════
  if (view === 'play' && quiz) {
    const questions = quiz.questions || [];
    const q = questions[currentQ];
    const isLast = currentQ === questions.length - 1;
    const answered = answers[currentQ] !== undefined && answers[currentQ] !== '';

    return (
      <div className="tqp-page animate-fadeIn">
        {/* Quiz header */}
        <div className="tqp-play-header">
          <div className="tqp-play-title">
            <h2>{quiz.title}</h2>
            <span className="tqp-play-subject">{quiz.subject}</span>
          </div>
          <div className={`tqp-timer ${timeLeft < 60 ? 'tqp-timer--danger' : ''}`}>
            <LuTimer /> {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress */}
        <div className="tqp-progress">
          <div className="tqp-progress-fill" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
        </div>
        <div className="tqp-progress-label">
          Question {currentQ + 1} of {questions.length}
        </div>

        {/* Question Card */}
        <div className={`tqp-q-card tqp-q-card--${q.type}`}>
          <div className="tqp-q-badge-row">
            <span className={`tqp-q-badge tqp-q-badge--${q.type}`}>
              {q.type === 'mcq' ? 'Multiple Choice' : 'Theory / Essay'}
            </span>
            <span className="tqp-q-points">{q.points || 1} pt{(q.points || 1) > 1 ? 's' : ''}</span>
          </div>

          <p className="tqp-q-text">{q.question}</p>

          {q.type === 'mcq' ? (
            <div className="tqp-options">
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  className={`tqp-option ${answers[currentQ] === oi ? 'tqp-option--selected' : ''}`}
                  onClick={() => selectMCQ(currentQ, oi)}
                >
                  <span className="tqp-option-letter">
                    {String.fromCharCode(65 + oi)}
                  </span>
                  <span className="tqp-option-text">{opt}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="tqp-theory-area">
              <textarea
                className="tqp-theory-input"
                rows={8}
                placeholder="Write your answer here…"
                value={answers[currentQ] || ''}
                onChange={(e) => setTheoryAnswer(currentQ, e.target.value)}
                maxLength={(q.maxWords || 500) * 6}
              />
              <div className="tqp-theory-meta">
                <span>
                  {(answers[currentQ] || '').split(/\s+/).filter(Boolean).length} / {q.maxWords || 500} words
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="tqp-nav">
          <button
            className="btn btn-secondary"
            onClick={() => setCurrentQ((p) => Math.max(0, p - 1))}
            disabled={currentQ === 0}
          >
            <LuArrowLeft /> Previous
          </button>

          {/* Question dots */}
          <div className="tqp-dots">
            {questions.map((_, i) => (
              <button
                key={i}
                className={`tqp-dot ${i === currentQ ? 'tqp-dot--active' : ''} ${answers[i] !== undefined && answers[i] !== '' ? 'tqp-dot--answered' : ''}`}
                onClick={() => setCurrentQ(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {isLast ? (
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : <><LuSend /> Submit Quiz</>}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setCurrentQ((p) => Math.min(questions.length - 1, p + 1))}
            >
              Next <LuArrowRight />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  //  RESULT VIEW
  // ═══════════════════════════════════════════════════
  if (view === 'result' && result) {
    const pct = result.totalPoints > 0 ? Math.round((result.autoScore / result.totalPoints) * 100) : 0;

    return (
      <div className="tqp-page animate-fadeIn">
        <div className="tqp-result-card">
          <div className="tqp-result-icon">
            {pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '📝'}
          </div>
          <h2>Quiz Submitted!</h2>

          <div className="tqp-result-score-ring">
            <span className="tqp-result-pct">{pct}%</span>
          </div>

          <div className="tqp-result-stats">
            <div className="tqp-result-stat">
              <LuCircleCheck />
              <span>Auto-scored: {result.autoScore} / {result.totalPoints}</span>
            </div>
            {result.hasTheory && (
              <div className="tqp-result-stat tqp-result-stat--theory">
                <LuPenLine />
                <span>Theory answers submitted — pending teacher review</span>
              </div>
            )}
          </div>

          {/* Review answers */}
          <div className="tqp-review-list">
            <h3>Answer Review</h3>
            {result.answers.map((a, idx) => (
              <div key={idx} className={`tqp-review-item ${a.type === 'mcq' ? (a.isCorrect ? 'tqp-review--correct' : 'tqp-review--wrong') : 'tqp-review--theory'}`}>
                <div className="tqp-review-num">Q{idx + 1}</div>
                <div className="tqp-review-body">
                  <p className="tqp-review-q">{a.question}</p>
                  {a.type === 'mcq' ? (
                    <div className="tqp-review-answer">
                      {a.isCorrect ? (
                        <span className="tqp-review-correct"><LuCircleCheck /> Correct</span>
                      ) : (
                        <span className="tqp-review-wrong"><LuCircleAlert /> Incorrect</span>
                      )}
                    </div>
                  ) : (
                    <div className="tqp-review-answer">
                      <span className="tqp-review-theory-tag"><LuPenLine /> Theory — submitted for review</span>
                      <p className="tqp-review-theory-text">{a.answer?.substring(0, 150)}{a.answer?.length > 150 ? '…' : ''}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button className="btn btn-primary btn-lg" onClick={() => { setView('browse'); setQuiz(null); setResult(null); }}>
            <LuArrowLeft /> Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  return null;
}
