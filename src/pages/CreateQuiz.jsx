import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createTeacherQuiz } from '../services/teacherQuizService';
import {
  LuPlus, LuTrash2, LuGripVertical, LuBookOpen, LuPenLine,
  LuCircleCheck, LuCircleAlert, LuArrowLeft, LuSave,
  LuFileText, LuSparkles, LuClock, LuHash, LuType,
} from 'react-icons/lu';
import './CreateQuiz.css';

const EMPTY_MCQ = {
  type: 'mcq',
  question: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  points: 1,
  explanation: '',
};

const EMPTY_THEORY = {
  type: 'theory',
  question: '',
  points: 2,
  expectedAnswer: '',
  maxWords: 500,
};

export default function CreateQuiz() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);
  const [questions, setQuestions] = useState([{ ...EMPTY_MCQ }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // ── Helpers ─────────────────────────────────────────────

  const addQuestion = (type) => {
    setQuestions((prev) => [
      ...prev,
      type === 'mcq' ? { ...EMPTY_MCQ } : { ...EMPTY_THEORY },
    ]);
  };

  const removeQuestion = (idx) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx, field, value) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q))
    );
  };

  const updateOption = (qIdx, optIdx, value) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = [...q.options];
        newOpts[optIdx] = value;
        return { ...q, options: newOpts };
      })
    );
  };

  const addOption = (qIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIdx ? { ...q, options: [...q.options, ''] } : q))
    );
  };

  const removeOption = (qIdx, optIdx) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx || q.options.length <= 2) return q;
        const newOpts = q.options.filter((_, oi) => oi !== optIdx);
        const newCorrect = q.correctAnswer >= newOpts.length ? 0 : q.correctAnswer;
        return { ...q, options: newOpts, correctAnswer: newCorrect };
      })
    );
  };

  // ── Validation ──────────────────────────────────────────

  const validate = () => {
    if (!title.trim()) return 'Quiz title is required.';
    if (!subject.trim()) return 'Subject is required.';
    if (questions.length === 0) return 'Add at least one question.';

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) return `Question ${i + 1} text is empty.`;
      if (q.type === 'mcq') {
        if (q.options.some((o) => !o.trim()))
          return `Question ${i + 1}: all options must be filled.`;
        if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length)
          return `Question ${i + 1}: select a correct answer.`;
      }
    }
    return null;
  };

  // ── Save ────────────────────────────────────────────────

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSaving(true);

    try {
      await createTeacherQuiz(user.id, {
        title: title.trim(),
        description: description.trim(),
        subject: subject.trim(),
        timeLimit,
        totalPoints: questions.reduce((s, q) => s + (q.points || 1), 0),
        questionCount: questions.length,
        questions,
        educatorName: user.name,
        classCode: user.classCode || '',
      });
      setSuccess(true);
      setTimeout(() => navigate('/manage-quizzes'), 1500);
    } catch (e) {
      console.error(e);
      setError('Failed to save quiz. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────

  if (success) {
    return (
      <div className="cq-page animate-fadeIn">
        <div className="cq-success-card">
          <LuCircleCheck className="cq-success-icon" />
          <h2>Quiz Created!</h2>
          <p>Your quiz is now available for students.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cq-page animate-fadeIn">
      {/* Header */}
      <div className="cq-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <LuArrowLeft /> Back
        </button>
        <div className="cq-header-info">
          <div className="cq-header-icon"><LuPenLine /></div>
          <div>
            <h1>Create Quiz</h1>
            <p>Build a quiz with MCQ and theory questions for your students</p>
          </div>
        </div>
      </div>

      {/* ── Meta Card ───────────────────────────────── */}
      <div className="cq-meta-card">
        <div className="cq-meta-header">
          <LuFileText /> Quiz Details
        </div>
        <div className="cq-meta-body">
          <div className="cq-field">
            <label><LuType /> Quiz Title</label>
            <input
              className="cq-input"
              placeholder="e.g. Chapter 5 — Data Structures"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="cq-row-2">
            <div className="cq-field">
              <label><LuBookOpen /> Subject</label>
              <input
                className="cq-input"
                placeholder="e.g. Computer Science"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="cq-field">
              <label><LuClock /> Time Limit (minutes)</label>
              <input
                className="cq-input"
                type="number"
                min={5}
                max={180}
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="cq-field">
            <label><LuSparkles /> Description (optional)</label>
            <textarea
              className="cq-input cq-textarea"
              rows={2}
              placeholder="Brief instructions or context for students…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Questions ──────────────────────────────── */}
      <div className="cq-questions-header">
        <h2><LuHash /> Questions ({questions.length})</h2>
        <div className="cq-add-btns">
          <button className="btn btn-secondary btn-sm" onClick={() => addQuestion('mcq')}>
            <LuPlus /> Add MCQ
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => addQuestion('theory')}>
            <LuPlus /> Add Theory
          </button>
        </div>
      </div>

      <div className="cq-questions-list">
        {questions.map((q, idx) => (
          <div key={idx} className={`cq-q-card cq-q-card--${q.type}`}>
            <div className="cq-q-top">
              <div className="cq-q-grip"><LuGripVertical /></div>
              <span className="cq-q-num">Q{idx + 1}</span>
              <span className={`cq-q-type-badge cq-q-type-badge--${q.type}`}>
                {q.type === 'mcq' ? 'Multiple Choice' : 'Theory / Essay'}
              </span>
              <div className="cq-q-actions">
                <div className="cq-points-wrap">
                  <label>Pts</label>
                  <input
                    className="cq-points-input"
                    type="number"
                    min={1}
                    max={100}
                    value={q.points}
                    onChange={(e) => updateQuestion(idx, 'points', Number(e.target.value))}
                  />
                </div>
                <button
                  className="cq-remove-btn"
                  onClick={() => removeQuestion(idx)}
                  title="Remove question"
                  disabled={questions.length <= 1}
                >
                  <LuTrash2 />
                </button>
              </div>
            </div>

            {/* Question text */}
            <textarea
              className="cq-input cq-q-text"
              rows={2}
              placeholder="Type your question here…"
              value={q.question}
              onChange={(e) => updateQuestion(idx, 'question', e.target.value)}
            />

            {q.type === 'mcq' ? (
              /* ── MCQ Options ── */
              <div className="cq-options">
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={`cq-option ${q.correctAnswer === oi ? 'cq-option--correct' : ''}`}
                  >
                    <button
                      className={`cq-option-radio ${q.correctAnswer === oi ? 'active' : ''}`}
                      onClick={() => updateQuestion(idx, 'correctAnswer', oi)}
                      title="Mark as correct answer"
                    >
                      {q.correctAnswer === oi ? <LuCircleCheck /> : String.fromCharCode(65 + oi)}
                    </button>
                    <input
                      className="cq-option-input"
                      placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                      value={opt}
                      onChange={(e) => updateOption(idx, oi, e.target.value)}
                    />
                    {q.options.length > 2 && (
                      <button className="cq-option-remove" onClick={() => removeOption(idx, oi)}>
                        <LuTrash2 />
                      </button>
                    )}
                  </div>
                ))}
                {q.options.length < 6 && (
                  <button className="cq-add-option" onClick={() => addOption(idx)}>
                    <LuPlus /> Add option
                  </button>
                )}
                <div className="cq-field cq-explanation-field">
                  <label>Explanation (optional)</label>
                  <textarea
                    className="cq-input"
                    rows={2}
                    placeholder="Explain why the correct answer is right…"
                    value={q.explanation || ''}
                    onChange={(e) => updateQuestion(idx, 'explanation', e.target.value)}
                  />
                </div>
              </div>
            ) : (
              /* ── Theory Options ── */
              <div className="cq-theory-config">
                <div className="cq-row-2">
                  <div className="cq-field">
                    <label>Max Words</label>
                    <input
                      className="cq-input"
                      type="number"
                      min={50}
                      max={5000}
                      value={q.maxWords || 500}
                      onChange={(e) => updateQuestion(idx, 'maxWords', Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="cq-field">
                  <label>Expected Answer / Rubric (visible only to you)</label>
                  <textarea
                    className="cq-input cq-textarea"
                    rows={3}
                    placeholder="Key points the student should cover…"
                    value={q.expectedAnswer || ''}
                    onChange={(e) => updateQuestion(idx, 'expectedAnswer', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Error / Save ─────────────────────────── */}
      {error && (
        <div className="cq-error">
          <LuCircleAlert /> {error}
        </div>
      )}

      <div className="cq-footer">
        <div className="cq-summary">
          <span>{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
          <span>•</span>
          <span>{questions.reduce((s, q) => s + (q.points || 1), 0)} total points</span>
          <span>•</span>
          <span>{questions.filter((q) => q.type === 'mcq').length} MCQ</span>
          <span>•</span>
          <span>{questions.filter((q) => q.type === 'theory').length} Theory</span>
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>Saving…</>
          ) : (
            <><LuSave /> Publish Quiz</>
          )}
        </button>
      </div>
    </div>
  );
}
