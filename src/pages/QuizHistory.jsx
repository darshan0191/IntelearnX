import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getQuizHistory } from '../services/storageService';
import {
  LuHistory, LuTarget, LuTrophy, LuClock, LuFlame, LuZap,
  LuChevronDown, LuCheck, LuX, LuBookOpen, LuSearch,
  LuFilter, LuLoader, LuCalendar, LuTimer,
} from 'react-icons/lu';
import './QuizHistory.css';

/* ── Grade Helper ── */
function getGrade(accuracy) {
  if (accuracy === 100) return { letter: 'S', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' };
  if (accuracy >= 80)  return { letter: 'A', color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
  if (accuracy >= 60)  return { letter: 'B', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' };
  if (accuracy >= 40)  return { letter: 'C', color: '#E0A546', bg: 'rgba(224,165,70,0.1)' };
  return { letter: 'D', color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' };
}

/* ── Format seconds into readable string ── */
function formatSeconds(secs) {
  if (!secs && secs !== 0) return '—';
  if (secs < 60) return `${Math.round(secs)}s`;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}m ${s}s`;
}

/* ── Individual Question Detail ── */
function QuestionItem({ question, answer, idx }) {
  const [open, setOpen] = useState(false);
  const isCorrect = answer?.correct;

  // Determine the option texts
  const options = question?.options || [];
  const selectedOptionIdx = answer?.selectedOption;
  const correctOptionIdx = question?.correct;

  return (
    <div className={`qh-q-item ${isCorrect ? 'qh-q-item--correct' : 'qh-q-item--wrong'}`}>
      {/* Header */}
      <button className="qh-q-header" onClick={() => setOpen(o => !o)}>
        <span className={`qh-q-badge ${isCorrect ? 'qh-q-badge--ok' : 'qh-q-badge--err'}`}>
          {isCorrect ? <LuCheck /> : <LuX />}
        </span>
        <span className="qh-q-num">Q{idx + 1}</span>
        <span className="qh-q-preview">{question?.question || 'Question'}</span>
        <span className="qh-q-time">
          <LuTimer style={{ fontSize: '0.65rem' }} />
          {answer?.timeTaken != null ? `${answer.timeTaken.toFixed(1)}s` : '—'}
        </span>
        <LuChevronDown className={`qh-q-chevron ${open ? 'qh-chevron--open' : ''}`} />
      </button>

      {/* Expanded body */}
      {open && (
        <div className="qh-q-body">
          <p className="qh-q-text-full">{question?.question}</p>

          {/* All options with highlights */}
          <div className="qh-q-options">
            {options.map((opt, oi) => {
              const isSelected = oi === selectedOptionIdx;
              const isCorrectOpt = oi === correctOptionIdx;
              let cls = 'qh-q-option';
              if (isSelected && isCorrectOpt) cls += ' qh-q-option--selected qh-q-option--correct';
              else if (isSelected) cls += ' qh-q-option--selected';
              else if (isCorrectOpt) cls += ' qh-q-option--correct';

              return (
                <div key={oi} className={cls}>
                  <span className="qh-q-option-letter">{String.fromCharCode(65 + oi)}</span>
                  <span>{opt}</span>
                  {isCorrectOpt && <LuCheck className="qh-q-option-icon" style={{ color: 'var(--success)' }} />}
                  {isSelected && !isCorrectOpt && <LuX className="qh-q-option-icon" style={{ color: 'var(--danger)' }} />}
                </div>
              );
            })}
          </div>

          {/* Answer comparison for wrong answers */}
          {!isCorrect && options.length > 0 && (
            <div className="qh-q-answers">
              <div className="qh-q-answer-box qh-q-answer-box--yours">
                <span className="qh-q-answer-label">Your answer</span>
                <span className="qh-q-answer-text">
                  {selectedOptionIdx != null ? options[selectedOptionIdx] : 'Not answered'}
                </span>
              </div>
              <div className="qh-q-answer-box qh-q-answer-box--correct-answer">
                <span className="qh-q-answer-label">Correct answer</span>
                <span className="qh-q-answer-text">
                  {correctOptionIdx != null ? options[correctOptionIdx] : '—'}
                </span>
              </div>
            </div>
          )}

          {/* Correct answer inline */}
          {isCorrect && (
            <div className="qh-q-correct-inline">
              <LuCheck /> You answered correctly: <strong>{options[selectedOptionIdx]}</strong>
            </div>
          )}

          {/* Explanation */}
          {question?.explanation && (
            <div className="qh-q-explanation">
              <div className="qh-q-explanation-label">Explanation</div>
              {question.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Quiz History Entry ── */
function HistoryEntry({ entry }) {
  const [open, setOpen] = useState(false);
  const grade = getGrade(entry.accuracy || 0);

  const wrongCount = (entry.totalQuestions || 0) - (entry.correctAnswers || 0);
  const answers = entry.answers || [];
  const questions = entry.questions || [];
  const avgTime = answers.length
    ? (answers.reduce((s, a) => s + (a.timeTaken || 0), 0) / answers.length)
    : 0;

  const dateStr = entry.timestamp
    ? new Date(entry.timestamp).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : '—';
  const timeStr = entry.timestamp
    ? new Date(entry.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit',
      })
    : '';

  return (
    <div className="qh-entry">
      {/* Entry header */}
      <button className="qh-entry-header" onClick={() => setOpen(o => !o)}>
        <div
          className="qh-entry-grade"
          style={{ color: grade.color, borderColor: grade.color, background: grade.bg }}
        >
          {grade.letter}
        </div>
        <div className="qh-entry-info">
          <div className="qh-entry-title">
            {entry.subject} · {entry.topic}
          </div>
          <div className="qh-entry-meta">
            <span><LuBookOpen style={{ fontSize: '0.65rem' }} /> {entry.difficulty}</span>
            <span><LuTarget style={{ fontSize: '0.65rem' }} /> {entry.correctAnswers}/{entry.totalQuestions}</span>
            <span><LuClock style={{ fontSize: '0.65rem' }} /> {formatSeconds(entry.timeTaken)}</span>
            <span><LuZap style={{ fontSize: '0.65rem' }} /> +{entry.xpEarned || 0} XP</span>
          </div>
        </div>
        <span
          className="qh-entry-accuracy"
          style={{
            color: grade.color,
            background: grade.bg,
          }}
        >
          {entry.accuracy}%
        </span>
        <span className="qh-entry-date">
          <LuCalendar style={{ fontSize: '0.6rem' }} /> {dateStr}
        </span>
        <LuChevronDown className={`qh-chevron ${open ? 'qh-chevron--open' : ''}`} />
      </button>

      {/* Expanded detail panel */}
      {open && (
        <div className="qh-detail">
          {/* Detail stats */}
          <div className="qh-detail-stats">
            {[
              { icon: <LuTarget />, value: `${entry.accuracy}%`, label: 'Accuracy', color: grade.color },
              { icon: <LuTrophy />, value: `${entry.correctAnswers}/${entry.totalQuestions}`, label: 'Correct', color: '#10b981' },
              { icon: <LuX />, value: wrongCount, label: 'Wrong', color: '#f43f5e' },
              { icon: <LuClock />, value: formatSeconds(entry.timeTaken), label: 'Total Time', color: '#3b82f6' },
              { icon: <LuTimer />, value: `${avgTime.toFixed(1)}s`, label: 'Avg / Q', color: '#8b5cf6' },
            ].map((s, i) => (
              <div key={i} className="qh-detail-stat" style={{ '--sc': s.color }}>
                <span className="qh-detail-stat-icon">{s.icon}</span>
                <span className="qh-detail-stat-value">{s.value}</span>
                <span className="qh-detail-stat-label">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Questions Review */}
          {questions.length > 0 ? (
            <>
              <h3 className="qh-questions-title">
                <LuBookOpen /> Question-by-Question Review
              </h3>
              <div className="qh-questions-list">
                {questions.map((q, idx) => {
                  const answer = answers[idx];
                  return (
                    <QuestionItem
                      key={idx}
                      question={q}
                      answer={answer}
                      idx={idx}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--s4)', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Detailed question data is not available for this quiz.
              <br />
              <span style={{ fontSize: '0.72rem' }}>Only quizzes taken after this update include question-level detail.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main QuizHistory Page
   ═══════════════════════════════════════════════════════════ */
export default function QuizHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const data = await getQuizHistory(user.id);
        setHistory(data);
      } catch (err) {
        console.error('Failed to load quiz history', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Derive unique subjects
  const subjects = useMemo(() => {
    const set = new Set(history.map(h => h.subject).filter(Boolean));
    return Array.from(set).sort();
  }, [history]);

  // Apply filters
  const filtered = useMemo(() => {
    let list = history;
    if (subjectFilter !== 'all') {
      list = list.filter(h => h.subject === subjectFilter);
    }
    if (difficultyFilter !== 'all') {
      list = list.filter(h => h.difficulty === difficultyFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(h =>
        (h.subject || '').toLowerCase().includes(q) ||
        (h.topic || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [history, subjectFilter, difficultyFilter, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [subjectFilter, difficultyFilter, searchQuery]);

  // Summary stats
  const totalQuizzes = history.length;
  const overallAccuracy = history.length > 0
    ? Math.round(history.reduce((s, h) => s + (h.accuracy || 0), 0) / history.length)
    : 0;
  const totalXP = history.reduce((s, h) => s + (h.xpEarned || 0), 0);
  const bestStreak = history.reduce((mx, h) => Math.max(mx, h.maxStreak || 0), 0);

  if (loading) {
    return (
      <div className="qh-loading">
        <LuLoader className="pq-spin" style={{ fontSize: '2rem', color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="qh-page">
      {/* ── Header ── */}
      <div className="qh-header">
        <div className="qh-header-icon"><LuHistory /></div>
        <div>
          <h1>Quiz History</h1>
          <p>Review your past quizzes with detailed question-by-question breakdowns</p>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="qh-summary">
        {[
          { icon: <LuBookOpen />, value: totalQuizzes, label: 'Total Quizzes', color: 'var(--accent)' },
          { icon: <LuTarget />, value: `${overallAccuracy}%`, label: 'Avg Accuracy', color: '#10b981' },
          { icon: <LuZap />, value: totalXP, label: 'Total XP', color: '#E0A546' },
          { icon: <LuFlame />, value: bestStreak, label: 'Best Streak', color: '#f43f5e' },
        ].map((s, i) => (
          <div key={i} className="qh-summary-card" style={{ '--sc': s.color }}>
            <span className="qh-summary-icon">{s.icon}</span>
            <span className="qh-summary-value">{s.value}</span>
            <span className="qh-summary-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      {history.length > 0 && (
        <div className="qh-filters">
          <LuFilter style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

          <select
            className="qh-filter-select"
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            id="qh-filter-subject"
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            className="qh-filter-select"
            value={difficultyFilter}
            onChange={e => setDifficultyFilter(e.target.value)}
            id="qh-filter-difficulty"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <div className="qh-search-wrap">
            <LuSearch className="qh-search-icon" />
            <input
              className="qh-search-input"
              type="text"
              placeholder="Search by subject or topic…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              id="qh-search"
            />
          </div>
        </div>
      )}

      {/* ── Quiz List ── */}
      {filtered.length === 0 ? (
        <div className="qh-empty">
          <LuHistory />
          <h3>{history.length === 0 ? 'No quiz history yet' : 'No quizzes match your filters'}</h3>
          <p>
            {history.length === 0
              ? 'Take your first quiz to see your detailed history here!'
              : 'Try adjusting your filters or search query.'}
          </p>
        </div>
      ) : (
        <>
          <div className="qh-list">
            {paginated.map((entry) => (
              <HistoryEntry key={entry.id} entry={entry} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="qh-pagination">
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span className="qh-pagination-info">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
