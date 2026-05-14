import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { generateQuizFromPdf } from '../services/pdfQuizService';
import {
  LuUpload, LuFileText, LuX, LuLoader, LuCircleCheck, LuCircleX,
  LuArrowRight, LuRotateCcw, LuSparkles, LuGauge, LuHash, LuBrain,
  LuPenLine, LuEye, LuChevronDown, LuChevronUp,
} from 'react-icons/lu';
import { LuLayoutDashboard } from 'react-icons/lu';
import './PdfQuiz.css';

// ── Flow steps ──
const STEPS = {
  UPLOAD: 'upload',
  GENERATING: 'generating',
  QUIZ: 'quiz',
  RESULT: 'result',
};

export default function PdfQuiz() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [file, setFile] = useState(null);
  const [config, setConfig] = useState({ numQuestions: 5, difficulty: 'medium', quizType: 'mcq' });
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [theoryAnswers, setTheoryAnswers] = useState({});
  const [showFeedback, setShowFeedback] = useState({});
  const [showModelAnswer, setShowModelAnswer] = useState({});
  const [currentQ, setCurrentQ] = useState(0);
  const [error, setError] = useState('');
  const [progressMsg, setProgressMsg] = useState('');
  const fileRef = useRef(null);

  // ── Upload handler ──
  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10 MB.');
      return;
    }
    setFile(selected);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) handleFileSelect({ target: { files: [dropped] } });
  };

  const removeFile = () => { setFile(null); setError(''); };

  // ── Generate quiz ──
  const handleGenerate = async () => {
    if (!file) return;
    setStep(STEPS.GENERATING);
    setError('');
    setProgressMsg('Uploading PDF...');

    try {
      setProgressMsg('Extracting text & generating quiz with AI...');
      const data = await generateQuizFromPdf(file, config, {
        userId: user?.id || '',
        onProgress: (msg) => setProgressMsg(msg),
      });
      setQuiz(data);
      setAnswers({});
      setShowFeedback({});
      setCurrentQ(0);
      setStep(STEPS.QUIZ);
    } catch (err) {
      setError(err.message || 'Failed to generate quiz.');
      setStep(STEPS.UPLOAD);
    }
  };

  // ── Answer MCQ question ──
  const handleAnswer = (questionId, option) => {
    if (showFeedback[questionId]) return;
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    setShowFeedback((prev) => ({ ...prev, [questionId]: true }));
  };

  // ── Submit theory answer ──
  const handleTheorySubmit = (questionId) => {
    setShowFeedback((prev) => ({ ...prev, [questionId]: true }));
    setShowModelAnswer((prev) => ({ ...prev, [questionId]: true }));
  };

  const goNext = () => {
    if (currentQ < quiz.questions.length - 1) {
      setCurrentQ((p) => p + 1);
    } else {
      setStep(STEPS.RESULT);
    }
  };

  // ── Calculate results ──
  const getResults = () => {
    if (!quiz) return { correct: 0, total: 0, pct: 0 };
    const isTheory = quiz.questionType === 'theory';
    if (isTheory) {
      // Theory quizzes don't have auto-grading
      const answered = Object.keys(theoryAnswers).filter(k => theoryAnswers[k]?.trim()).length;
      return { correct: answered, total: quiz.questions.length, pct: Math.round((answered / quiz.questions.length) * 100), isTheory: true };
    }
    let correct = 0;
    quiz.questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) correct++;
    });
    return { correct, total: quiz.questions.length, pct: Math.round((correct / quiz.questions.length) * 100), isTheory: false };
  };

  // ── Restart ──
  const restart = () => {
    setStep(STEPS.UPLOAD);
    setFile(null);
    setQuiz(null);
    setAnswers({});
    setTheoryAnswers({});
    setShowFeedback({});
    setShowModelAnswer({});
    setCurrentQ(0);
    setError('');
  };

  return (
    <div className="pdf-quiz animate-fadeInUp">
      {/* Header */}
      <div className="pq-page-header">
        <div className="pq-page-icon"><LuFileText /></div>
        <div>
          <h1>PDF to Quiz</h1>
          <p>Upload any PDF and let AI generate a quiz from its content</p>
        </div>
      </div>

      {/* ──── STEP: UPLOAD & CONFIG ──── */}
      {step === STEPS.UPLOAD && (
        <div className="pq-upload-section animate-fadeInUp">
          {/* Upload area */}
          <div
            className={`pq-dropzone ${file ? 'has-file' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !file && fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              hidden
            />
            {!file ? (
              <>
                <div className="pq-dropzone-icon"><LuUpload /></div>
                <p className="pq-dropzone-title">Drop your PDF here</p>
                <p className="pq-dropzone-sub">or click to browse · Max 10 MB</p>
              </>
            ) : (
              <div className="pq-file-info">
                <LuFileText className="pq-file-icon" />
                <div className="pq-file-meta">
                  <span className="pq-file-name">{file.name}</span>
                  <span className="pq-file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <button className="pq-file-remove" onClick={(e) => { e.stopPropagation(); removeFile(); }}>
                  <LuX />
                </button>
              </div>
            )}
          </div>

          {error && <div className="pq-error"><LuCircleX /> {error}</div>}

          {/* Config */}
          <div className="pq-config-card">
            <h3 className="pq-config-title"><LuSparkles /> Quiz Settings</h3>

            <div className="pq-config-grid">
              {/* Num questions */}
              <div className="pq-config-item">
                <label><LuHash /> Questions</label>
                <div className="pq-option-row">
                  {[3, 5, 8, 10, 15].map((n) => (
                    <button
                      key={n}
                      className={`pq-opt-btn ${config.numQuestions === n ? 'active' : ''}`}
                      onClick={() => setConfig((c) => ({ ...c, numQuestions: n }))}
                    >{n}</button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div className="pq-config-item">
                <label><LuGauge /> Difficulty</label>
                <div className="pq-option-row">
                  {[
                    { key: 'easy', label: 'Easy', color: '#4CAF82' },
                    { key: 'medium', label: 'Medium', color: '#E0A546' },
                    { key: 'hard', label: 'Hard', color: '#D4645C' },
                  ].map((d) => (
                    <button
                      key={d.key}
                      className={`pq-opt-btn ${config.difficulty === d.key ? 'active' : ''}`}
                      style={config.difficulty === d.key ? { borderColor: d.color, color: d.color } : {}}
                      onClick={() => setConfig((c) => ({ ...c, difficulty: d.key }))}
                    >{d.label}</button>
                  ))}
                </div>
              </div>

              {/* Quiz type */}
              <div className="pq-config-item">
                <label><LuBrain /> Type</label>
                <div className="pq-option-row">
                  {[
                    { key: 'mcq', label: 'MCQ' },
                    { key: 'true_false', label: 'True/False' },
                    { key: 'mixed', label: 'Mixed' },
                    { key: 'theory', label: 'Theory' },
                  ].map((t) => (
                    <button
                      key={t.key}
                      className={`pq-opt-btn ${config.quizType === t.key ? 'active' : ''}`}
                      onClick={() => setConfig((c) => ({ ...c, quizType: t.key }))}
                    >{t.label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Generate button */}
          <button
            className="btn btn-primary btn-lg pq-generate-btn"
            onClick={handleGenerate}
            disabled={!file}
          >
            <LuSparkles /> Generate Quiz
          </button>
        </div>
      )}

      {/* ──── STEP: GENERATING ──── */}
      {step === STEPS.GENERATING && (
        <div className="pq-generating animate-fadeInUp">
          <div className="pq-generating-card">
            <div className="spinner" />
            <h3>{progressMsg}</h3>
            <p>This may take 10–30 seconds depending on the PDF length</p>
            <div className="pq-gen-steps">
              <div className="pq-gen-step done"><LuCircleCheck /> PDF uploaded</div>
              <div className="pq-gen-step active"><LuLoader className="pq-spin" /> AI generating questions</div>
              <div className="pq-gen-step"><span>○</span> Quiz ready</div>
            </div>
          </div>
        </div>
      )}

      {/* ──── STEP: QUIZ ──── */}
      {step === STEPS.QUIZ && quiz && (
        <div className="pq-quiz-section animate-fadeInUp">
          {/* Quiz header */}
          <div className="pq-quiz-header">
            <div>
              <h2>{quiz.title}</h2>
              <p className="pq-quiz-summary">{quiz.sourceSummary}</p>
            </div>
            <span className="pq-q-counter">
              {currentQ + 1} / {quiz.questions.length}
            </span>
          </div>

          {/* Progress bar */}
          <div className="pq-progress">
            <div
              className="pq-progress-fill"
              style={{ width: `${((currentQ + 1) / quiz.questions.length) * 100}%` }}
            />
          </div>

          {/* Question card */}
          {(() => {
            const q = quiz.questions[currentQ];
            const answered = showFeedback[q.id];
            const isTheory = quiz.questionType === 'theory';

            if (isTheory) {
              // ── Theory Question Card ──
              return (
                <div className="pq-question-card pq-theory-card" key={q.id}>
                  <div className="pq-theory-badge"><LuPenLine /> Theory Question</div>
                  <p className="pq-question-text">{q.question}</p>

                  <div className="pq-theory-answer-area">
                    <label className="pq-theory-label">Your Answer</label>
                    <textarea
                      className="pq-theory-textarea"
                      placeholder="Write your descriptive answer here..."
                      rows={6}
                      value={theoryAnswers[q.id] || ''}
                      onChange={(e) => setTheoryAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      disabled={answered}
                    />
                  </div>

                  {!answered && (
                    <button
                      className="btn btn-primary pq-submit-theory-btn"
                      onClick={() => handleTheorySubmit(q.id)}
                      disabled={!theoryAnswers[q.id]?.trim()}
                    >
                      <LuEye /> Submit & View Model Answer
                    </button>
                  )}

                  {answered && (
                    <div className="pq-model-answer-section">
                      <button
                        className="pq-model-answer-toggle"
                        onClick={() => setShowModelAnswer(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                      >
                        <span><LuEye /> Model Answer</span>
                        {showModelAnswer[q.id] ? <LuChevronUp /> : <LuChevronDown />}
                      </button>
                      {showModelAnswer[q.id] && (
                        <div className="pq-model-answer-content">
                          <p className="pq-model-answer-text">{q.modelAnswer}</p>
                          {q.keyPoints && q.keyPoints.length > 0 && (
                            <div className="pq-key-points">
                              <strong>Key Points to Cover:</strong>
                              <ul>
                                {q.keyPoints.map((kp, ki) => (
                                  <li key={ki}>{kp}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {answered && (
                    <button className="btn btn-primary pq-next-btn" onClick={goNext}>
                      {currentQ < quiz.questions.length - 1 ? (
                        <><span>Next Question</span> <LuArrowRight /></>
                      ) : (
                        <><span>See Summary</span> <LuArrowRight /></>
                      )}
                    </button>
                  )}
                </div>
              );
            }

            // ── MCQ/TF Question Card ──
            const userAnswer = answers[q.id];
            return (
              <div className="pq-question-card" key={q.id}>
                <p className="pq-question-text">{q.question}</p>
                <div className="pq-options">
                  {q.options.map((opt, idx) => {
                    let cls = 'pq-option';
                    if (answered) {
                      if (opt === q.correctAnswer) cls += ' correct';
                      else if (opt === userAnswer && opt !== q.correctAnswer) cls += ' incorrect';
                    }
                    return (
                      <button
                        key={idx}
                        className={cls}
                        onClick={() => handleAnswer(q.id, opt)}
                        disabled={answered}
                      >
                        <span className="pq-option-letter">{String.fromCharCode(65 + idx)}</span>
                        <span>{opt}</span>
                        {answered && opt === q.correctAnswer && <LuCircleCheck className="pq-opt-icon correct" />}
                        {answered && opt === userAnswer && opt !== q.correctAnswer && <LuCircleX className="pq-opt-icon incorrect" />}
                      </button>
                    );
                  })}
                </div>

                {answered && (
                  <div className={`pq-explanation ${userAnswer === q.correctAnswer ? 'correct' : 'incorrect'}`}>
                    <strong>{userAnswer === q.correctAnswer ? '✓ Correct!' : '✗ Incorrect'}</strong>
                    <p>{q.explanation}</p>
                  </div>
                )}

                {answered && (
                  <button className="btn btn-primary pq-next-btn" onClick={goNext}>
                    {currentQ < quiz.questions.length - 1 ? (
                      <><span>Next Question</span> <LuArrowRight /></>
                    ) : (
                      <><span>See Results</span> <LuArrowRight /></>
                    )}
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ──── STEP: RESULTS ──── */}
      {step === STEPS.RESULT && quiz && (
        <div className="pq-result-section animate-fadeInUp">
          {(() => {
            const r = getResults();
            const isTheory = r.isTheory;

            if (isTheory) {
              // ── Theory Results ──
              return (
                <>
                  <div className="pq-result-hero">
                    <div className="pq-grade-circle good">✓</div>
                    <h2>Theory Quiz Complete!</h2>
                    <p>You answered {r.correct} of {r.total} questions</p>
                  </div>

                  <div className="pq-review-list">
                    <h3>Review Your Answers</h3>
                    {quiz.questions.map((q, i) => {
                      const userAns = theoryAnswers[q.id] || '';
                      return (
                        <div key={q.id} className="pq-review-item pq-review-theory">
                          <div className="pq-review-q">
                            <span className="pq-review-num">{i + 1}</span>
                            <span>{q.question}</span>
                          </div>
                          {userAns && (
                            <div className="pq-theory-your-answer">
                              <strong>Your Answer:</strong>
                              <p>{userAns}</p>
                            </div>
                          )}
                          <div className="pq-theory-model-review">
                            <strong>Model Answer:</strong>
                            <p>{q.modelAnswer}</p>
                            {q.keyPoints && q.keyPoints.length > 0 && (
                              <div className="pq-key-points">
                                <strong>Key Points:</strong>
                                <ul>
                                  {q.keyPoints.map((kp, ki) => (
                                    <li key={ki}>{kp}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pq-result-actions">
                    <button className="btn btn-primary btn-lg" onClick={restart}>
                      <LuRotateCcw /> Generate New Quiz
                    </button>
                    <button className="btn btn-secondary btn-lg" onClick={() => navigate('/dashboard')}>
                      <LuLayoutDashboard /> Back to Dashboard
                    </button>
                  </div>
                </>
              );
            }

            // ── MCQ Results ──
            const grade = r.pct >= 80 ? 'excellent' : r.pct >= 60 ? 'good' : r.pct >= 40 ? 'average' : 'poor';
            return (
              <>
                <div className="pq-result-hero">
                  <div className={`pq-grade-circle ${grade}`}>{r.pct}%</div>
                  <h2>{r.pct >= 80 ? 'Excellent!' : r.pct >= 60 ? 'Good Job!' : r.pct >= 40 ? 'Not Bad' : 'Keep Trying'}</h2>
                  <p>{r.correct} of {r.total} correct</p>
                </div>

                <div className="pq-review-list">
                  <h3>Review Answers</h3>
                  {quiz.questions.map((q, i) => {
                    const isCorrect = answers[q.id] === q.correctAnswer;
                    return (
                      <div key={q.id} className={`pq-review-item ${isCorrect ? 'correct' : 'incorrect'}`}>
                        <div className="pq-review-q">
                          <span className="pq-review-num">{i + 1}</span>
                          <span>{q.question}</span>
                          {isCorrect ? <LuCircleCheck className="pq-review-icon correct" /> : <LuCircleX className="pq-review-icon incorrect" />}
                        </div>
                        {!isCorrect && (
                          <div className="pq-review-answers">
                            <span className="pq-your-answer">Your answer: {answers[q.id] || 'Not answered'}</span>
                            <span className="pq-correct-answer">Correct: {q.correctAnswer}</span>
                          </div>
                        )}
                        <p className="pq-review-explanation">{q.explanation}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="pq-result-actions">
                  <button className="btn btn-primary btn-lg" onClick={restart}>
                    <LuRotateCcw /> Generate New Quiz
                  </button>
                  <button className="btn btn-secondary btn-lg" onClick={() => navigate('/dashboard')}>
                    <LuLayoutDashboard /> Back to Dashboard
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

