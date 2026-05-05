import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveIntroQuizResult, saveQuizResult, addXP } from '../services/storageService';
import {
  generatePersonalizedQuizQuestions,
  STUDY_DOMAIN_OPTIONS,
  computeDomainStats,
} from '../services/personalizedQuizService';
import { validateEngineeringDomain, OUT_OF_DOMAIN_SHORT } from '../utils/engineeringDomainGuard';
import {
  LuArrowRight, LuCircleCheck, LuCircleX, LuRocket, LuLoader, LuSparkles,
} from 'react-icons/lu';
import './SubjectSelectModal.css';

const STEPS = { SETUP: 'setup', GENERATING: 'generating', QUIZ: 'quiz', RESULT: 'result' };
const QUIZ_TITLE = 'Your personalized quiz';

export default function SubjectSelectModal() {
  const { user, updateUser } = useAuth();

  const [step, setStep] = useState(STEPS.SETUP);
  const [domainIds, setDomainIds] = useState(() => ['engineering']);
  const [keywords, setKeywords] = useState('');
  const [genError, setGenError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showFeedback, setShowFeedback] = useState(null);
  const [score, setScore] = useState(0);
  const [saving, setSaving] = useState(false);
  const [quizSource, setQuizSource] = useState('');

  const totalQuestions = questions.length;

  const toggleDomain = (id) => {
    setDomainIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const handleGenerate = async () => {
    if (domainIds.length === 0) {
      setGenError('Pick at least one domain.');
      return;
    }

    // ── Engineering domain gate for keywords ──
    if (keywords.trim()) {
      const { isEngineering } = validateEngineeringDomain(keywords.trim());
      if (!isEngineering) {
        setGenError(OUT_OF_DOMAIN_SHORT);
        return;
      }
    }

    setGenError('');
    setStep(STEPS.GENERATING);
    try {
      const { questions: qs, source } = await generatePersonalizedQuizQuestions({
        domainIds,
        keywords: keywords.trim(),
      });
      setQuestions(qs);
      setQuizSource(source);
      setCurrentQ(0);
      setAnswers({});
      setShowFeedback(null);
      setScore(0);
      setStep(STEPS.QUIZ);
    } catch (e) {
      console.error(e);
      setGenError(e.message || 'Could not generate quiz. Try again.');
      setStep(STEPS.SETUP);
    }
  };

  const handleAnswer = (questionIndex, optionIndex) => {
    if (showFeedback !== null) return;
    const q = questions[questionIndex];
    const isCorrect = optionIndex === q.correct;
    setAnswers((prev) => ({ ...prev, [questionIndex]: { selected: optionIndex, correct: isCorrect } }));
    setShowFeedback(questionIndex);
    if (isCorrect) setScore((prev) => prev + 1);
  };

  const handleNext = () => {
    setShowFeedback(null);
    if (currentQ + 1 >= totalQuestions) {
      setStep(STEPS.RESULT);
    } else {
      setCurrentQ((prev) => prev + 1);
    }
  };

  const answersRecord = useMemo(() => {
    const o = {};
    Object.keys(answers).forEach((k) => {
      o[Number(k)] = answers[k];
    });
    return o;
  }, [answers]);

  const handleFinish = async () => {
    if (saving || totalQuestions === 0) return;
    setSaving(true);
    try {
      const { domainStats, domainScoresPct } = computeDomainStats(questions, answersRecord);
      const weakest = Object.entries(domainScoresPct).sort((a, b) => a[1] - b[1])[0];
      const summary = weakest
        ? `Onboarding: ${score}/${totalQuestions}. Consider extra work in ${weakest[0]} (${weakest[1]}%).`
        : `Onboarding quiz: ${score}/${totalQuestions}.`;
      const onboardingIntroAccuracy = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

      await saveIntroQuizResult(user.id, {
        score,
        totalQuestions,
        studyDomainIds: domainIds,
        studyKeywords: keywords.trim(),
        onboardingDomainScores: domainScoresPct,
        onboardingQuizSummary: summary,
        onboardingIntroAccuracy,
      });

      const accuracy = Math.round((score / totalQuestions) * 100);
      let xpEarned = score * 10;
      if (accuracy === 100) xpEarned += 50;
      xpEarned = Math.round(xpEarned);

      await saveQuizResult(user.id, {
        subject: 'Personalized study',
        topic: QUIZ_TITLE,
        difficulty: 'medium',
        totalQuestions,
        correctAnswers: score,
        accuracy,
        timeTaken: 0,
        xpEarned,
        answers: [],
        maxStreak: 0,
        domainStats,
        studyDomainIds: domainIds,
        studyKeywords: keywords.trim(),
      });

      await addXP(user.id, xpEarned);

      await updateUser({
        introQuizCompleted: true,
        studyDomainIds: domainIds,
        studyKeywords: keywords.trim(),
        onboardingDomainScores: domainScoresPct,
        onboardingQuizSummary: summary,
        onboardingIntroAccuracy,
        xp: (user.xp || 0) + xpEarned,
        level: Math.floor(((user.xp || 0) + xpEarned) / 250) + 1,
      });
    } catch (err) {
      console.error('Failed to save intro quiz result:', err);
      await updateUser({ introQuizCompleted: true });
    } finally {
      setSaving(false);
    }
  };

  const q = step === STEPS.QUIZ && questions.length ? questions[currentQ] : null;
  const answer = answers[currentQ];
  const isAnswered = answer !== undefined;

  return (
    <div className="ssm-overlay ssm-gen" id="subject-select-modal">
      <div className="ssm-container ssm-gen__container">
        {step === STEPS.SETUP && (
          <div className="ssm-gen__setup">
            <div className="ssm-gen__glow" aria-hidden />
            <span className="ssm-gen__badge"><LuSparkles /> Let’s personalize</span>
            <h1 className="ssm-gen__title">Build your first quiz</h1>
            <p className="ssm-gen__lead">
              Pick the domains you care about and add keywords—use <strong>commas</strong> between phrases so each one gets its own corner on your dashboard radar (e.g. “JEE mechanics, calculus, organic chemistry”).
              We’ll generate 10 questions shaped around <strong>you</strong>.
            </p>

            <div className="ssm-gen__domains">
              {STUDY_DOMAIN_OPTIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`ssm-gen__domain ${domainIds.includes(d.id) ? 'is-on' : ''}`}
                  onClick={() => toggleDomain(d.id)}
                >
                  <span className="ssm-gen__domain-emoji">{d.emoji}</span>
                  <span className="ssm-gen__domain-label">{d.label}</span>
                  <span className="ssm-gen__domain-hint">{d.hint}</span>
                </button>
              ))}
            </div>

            <label className="ssm-gen__kw-label" htmlFor="ssm-keywords">Keywords & focus</label>
            <textarea
              id="ssm-keywords"
              className="ssm-gen__textarea"
              rows={3}
              placeholder="What do you want to study? Exams, topics, goals…"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />

            {genError && <p className="ssm-gen__error">{genError}</p>}

            <button type="button" className="btn btn-primary btn-lg ssm-gen__cta" onClick={handleGenerate}>
              <LuSparkles /> Generate 10 questions
            </button>
          </div>
        )}

        {step === STEPS.GENERATING && (
          <div className="ssm-gen__loading">
            <LuLoader className="ssm-gen__spin" aria-hidden />
            <h2>Cooking your quiz…</h2>
            <p>Aligning questions to your domains and keywords.</p>
          </div>
        )}

        {step === STEPS.QUIZ && q && (
          <div className="ssm-quiz">
            {currentQ === 0 && (
              <div className="ssm-welcome-strip">
                <span className="ssm-welcome-emoji" aria-hidden>✨</span>
                <div>
                  <strong>10 questions · your domains</strong>
                  <p>
                    {quizSource === 'gemini' ? 'AI-generated from what you picked.' : 'Practice set (connect Gemini in .env for AI-tailored quizzes).'}
                    {' '}Do your best—your dashboard updates after this.
                  </p>
                </div>
              </div>
            )}
            <div className="ssm-quiz-header">
              <div className="ssm-quiz-heading">
                <span className="ssm-topic-badge">{q.domain}</span>
                <h3>{QUIZ_TITLE}</h3>
              </div>
              <span className="ssm-quiz-counter">{currentQ + 1} / {totalQuestions}</span>
            </div>

            <div className="ssm-quiz-progress">
              <div
                className="ssm-quiz-progress-fill"
                style={{ width: `${((currentQ + 1) / totalQuestions) * 100}%` }}
              />
            </div>

            <div className="ssm-question-card">
              <p className="ssm-question-meta">
                Q{currentQ + 1} · {q.domain}
              </p>
              <p className="ssm-question-text">{q.question}</p>

              <div className="ssm-options">
                {q.options.map((opt, idx) => {
                  let cls = 'ssm-option';
                  if (isAnswered) {
                    if (idx === q.correct) cls += ' correct';
                    else if (idx === answer.selected && idx !== q.correct) cls += ' incorrect';
                  }
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={cls}
                      onClick={() => handleAnswer(currentQ, idx)}
                      disabled={isAnswered}
                    >
                      <span className="ssm-option-letter">{String.fromCharCode(65 + idx)}</span>
                      <span>{opt}</span>
                      {isAnswered && idx === q.correct && <LuCircleCheck style={{ marginLeft: 'auto', color: 'var(--success)' }} />}
                      {isAnswered && idx === answer.selected && idx !== q.correct && <LuCircleX style={{ marginLeft: 'auto', color: 'var(--danger)' }} />}
                    </button>
                  );
                })}
              </div>

              {isAnswered && (
                <div className={`ssm-explanation ${answer.correct ? 'correct' : 'incorrect'}`}>
                  <strong>{answer.correct ? 'Nice!' : 'Not quite'}</strong>
                  <span>{q.explanation}</span>
                </div>
              )}

              {isAnswered && (
                <button type="button" className="btn btn-primary ssm-next-btn" onClick={handleNext}>
                  {currentQ < totalQuestions - 1 ? (
                    <><span>Next</span> <LuArrowRight /></>
                  ) : (
                    <><span>See results</span> <LuArrowRight /></>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {step === STEPS.RESULT && (() => {
          const pct = totalQuestions ? Math.round((score / totalQuestions) * 100) : 0;
          const grade = pct >= 80 ? 'excellent' : pct >= 60 ? 'good' : pct >= 40 ? 'average' : 'poor';
          const message = pct >= 80 ? 'You crushed it!' : pct >= 60 ? 'Solid start!' : pct >= 40 ? 'Room to grow!' : 'Keep going!';

          return (
            <div className="ssm-result">
              <span className="ssm-emoji">🎉</span>
              <div className={`ssm-result-score ${grade}`}>{pct}%</div>
              <h2>{message}</h2>
              <p>
                {score} / {totalQuestions} · domains: {domainIds.map((id) => STUDY_DOMAIN_OPTIONS.find((d) => d.id === id)?.label).join(', ')}
              </p>
              <button
                type="button"
                className="btn btn-primary btn-lg ssm-result-btn"
                onClick={handleFinish}
                disabled={saving}
                id="ssm-finish-btn"
              >
                <LuRocket /> {saving ? 'Saving…' : 'Unlock dashboard'}
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
