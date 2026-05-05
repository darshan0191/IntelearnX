import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTeacherQuizzes, deleteTeacherQuiz, getQuizSubmissions } from '../services/teacherQuizService';
import { getUserProfile } from '../services/storageService';
import {
  LuPlus, LuTrash2, LuEye, LuClock, LuHash, LuFileText,
  LuLoader, LuBookOpen, LuUsers, LuCircleCheck, LuPenLine,
  LuCircleAlert,
} from 'react-icons/lu';
import './ManageQuizzes.css';

export default function ManageQuizzes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submissionCounts, setSubmissionCounts] = useState({});
  const [expandedQuiz, setExpandedQuiz] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  useEffect(() => {
    loadQuizzes();
  }, [user]);

  const loadQuizzes = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getTeacherQuizzes(user.id);
      setQuizzes(data);

      // Fetch submission counts
      const counts = {};
      for (const q of data) {
        const subs = await getQuizSubmissions(q.id);
        counts[q.id] = subs.length;
      }
      setSubmissionCounts(counts);
    } catch (e) {
      console.error('Failed to load quizzes', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (quizId) => {
    if (!confirm('Delete this quiz and all submissions? This cannot be undone.')) return;
    try {
      await deleteTeacherQuiz(quizId);
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
    } catch (e) {
      console.error(e);
    }
  };

  const viewSubmissions = async (quizId) => {
    if (expandedQuiz === quizId) { setExpandedQuiz(null); return; }
    setExpandedQuiz(quizId);
    setLoadingSubs(true);
    try {
      const subs = await getQuizSubmissions(quizId);
      // Enrich with student names
      const enriched = await Promise.all(
        subs.map(async (s) => {
          const profile = await getUserProfile(s.studentId);
          return { ...s, studentName: profile?.name || 'Unknown', avatar: profile?.avatar || '🧑‍🎓' };
        })
      );
      setSubmissions(enriched);
    } catch (e) {
      console.error(e);
      setSubmissions([]);
    } finally {
      setLoadingSubs(false);
    }
  };

  if (loading) {
    return (
      <div className="mq-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <LuLoader className="pq-spin" style={{ fontSize: '2rem', color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="mq-page animate-fadeIn">
      {/* Header */}
      <div className="mq-header">
        <div className="mq-header-info">
          <div className="mq-header-icon"><LuBookOpen /></div>
          <div>
            <h1>My Quizzes</h1>
            <p>Create and manage quizzes for your students</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/create-quiz')}>
          <LuPlus /> Create Quiz
        </button>
      </div>

      {/* Quiz List */}
      {quizzes.length === 0 ? (
        <div className="mq-empty">
          <LuFileText />
          <h3>No quizzes yet</h3>
          <p>Create your first quiz and assign it to your students.</p>
          <button className="btn btn-primary" onClick={() => navigate('/create-quiz')}>
            <LuPlus /> Create Your First Quiz
          </button>
        </div>
      ) : (
        <div className="mq-list">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="mq-card">
              <div className="mq-card-main">
                <div className="mq-card-left">
                  <h3>{quiz.title}</h3>
                  {quiz.description && <p className="mq-card-desc">{quiz.description}</p>}
                  <div className="mq-card-meta">
                    <span><LuBookOpen /> {quiz.subject}</span>
                    <span><LuHash /> {quiz.questionCount} questions</span>
                    <span><LuClock /> {quiz.timeLimit} min</span>
                    <span><LuUsers /> {submissionCounts[quiz.id] || 0} submissions</span>
                  </div>
                  <div className="mq-card-tags">
                    {(quiz.questions || []).some(q => q.type === 'mcq') && (
                      <span className="mq-tag mq-tag--mcq">MCQ</span>
                    )}
                    {(quiz.questions || []).some(q => q.type === 'theory') && (
                      <span className="mq-tag mq-tag--theory">Theory</span>
                    )}
                  </div>
                </div>
                <div className="mq-card-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => viewSubmissions(quiz.id)}>
                    <LuEye /> {expandedQuiz === quiz.id ? 'Hide' : 'Submissions'}
                  </button>
                  <button className="btn btn-ghost btn-sm mq-delete-btn" onClick={() => handleDelete(quiz.id)}>
                    <LuTrash2 />
                  </button>
                </div>
              </div>

              {/* Expanded Submissions */}
              {expandedQuiz === quiz.id && (
                <div className="mq-subs">
                  <div className="mq-subs-header">
                    <LuUsers /> Student Submissions
                  </div>
                  {loadingSubs ? (
                    <div className="mq-subs-loading"><LuLoader className="pq-spin" /> Loading…</div>
                  ) : submissions.length === 0 ? (
                    <div className="mq-subs-empty">No submissions yet</div>
                  ) : (
                    <div className="mq-subs-list">
                      {submissions.map((sub, idx) => (
                        <div key={idx} className="mq-sub-row">
                          <div className="mq-sub-avatar">{sub.avatar}</div>
                          <div className="mq-sub-info">
                            <span className="mq-sub-name">{sub.studentName}</span>
                            <span className="mq-sub-date">
                              {new Date(sub.submittedAt).toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <div className="mq-sub-score">
                            {sub.autoScore !== undefined ? (
                              <span className="mq-sub-score-val">
                                <LuCircleCheck /> {sub.autoScore} / {sub.totalPoints}
                              </span>
                            ) : (
                              <span className="mq-sub-pending">
                                <LuPenLine /> Pending
                              </span>
                            )}
                          </div>
                          {sub.hasTheory && !sub.graded && (
                            <span className="mq-sub-needs-grading">
                              <LuCircleAlert /> Needs grading
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
