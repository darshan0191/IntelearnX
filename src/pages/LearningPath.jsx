import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getQuizHistory, getPerformanceData } from '../services/storageService';
import {
  getAdaptiveLearningPath,
  identifyWeakAreas,
  compactPerformanceForLearningPath,
  filterLearningPathWeakAreas,
} from '../services/aiService';
import { domainIdToLabel } from '../services/personalizedQuizService';
import { parseStructuredRoadmap, learningPathFingerprint } from '../utils/learningPathStructuredParse';
import { validateEngineeringDomain, OUT_OF_DOMAIN_MESSAGE } from '../utils/engineeringDomainGuard';
import LearningPathMermaid from '../components/LearningPathMermaid';
import LearningPathRoadmapFlow from '../components/LearningPathRoadmapFlow';
import { resourceBank } from '../data/quizData';
import { parseRoadmapSteps } from '../utils/learningPathParse';
import {
  LuRoute, LuSparkles, LuTarget, LuBookOpen, LuExternalLink, LuArrowRight, LuLoader,
  LuRocket, LuGitBranch, LuPlay, LuChevronLeft, LuChevronRight, LuShieldAlert,
} from 'react-icons/lu';
import './LearningPath.css';

function pathContext(user, promptText, performance) {
  const performanceSnapshot = compactPerformanceForLearningPath(performance);
  return {
    userPrompt: promptText,
    studyDomainIds: user?.studyDomainIds || [],
    domainLabels: (user?.studyDomainIds || []).map(domainIdToLabel),
    studyKeywords: user?.studyKeywords || '',
    onboardingQuizSummary: user?.onboardingQuizSummary || '',
    onboardingIntroAccuracy: user?.onboardingIntroAccuracy,
    performanceSnapshot,
  };
}

export default function LearningPath() {
  const { user, updateUser } = useAuth();
  const [aiPath, setAiPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [weakAreas, setWeakAreas] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [journeyStep, setJourneyStep] = useState(0);
  const [domainError, setDomainError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!user?.id) return;
      setInitialLoading(true);
      try {
        const [hist, perf] = await Promise.all([
          getQuizHistory(user.id),
          getPerformanceData(user.id),
        ]);
        if (cancelled) return;
        setHistory(hist);
        setPerformance(perf);
        const weak = filterLearningPathWeakAreas(identifyWeakAreas(hist));
        setWeakAreas(weak);
        const p = user?.learningPathPrompt || '';
        setPrompt(p);
        setLoading(true);
        const path = await getAdaptiveLearningPath(weak, hist, user?.level || 1, pathContext(user, p, perf));
        if (!cancelled) setAiPath(path);
      } catch (err) {
        console.error('Failed to load learning path data', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setInitialLoading(false);
        }
      }
    }
    const timeoutId = setTimeout(() => {
      run();
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      cancelled = true;
    };
  }, [user?.id, user?.level, user?.learningPathPrompt, user?.onboardingQuizSummary, user?.studyDomainIds, user?.studyKeywords, user?.onboardingIntroAccuracy]);

  const roadmapStructured = useMemo(() => parseStructuredRoadmap(aiPath), [aiPath]);
  const legacySteps = useMemo(() => parseRoadmapSteps(aiPath), [aiPath]);

  useEffect(() => {
    if (!roadmapStructured?.phases?.length) {
      setJourneyStep(0);
      return;
    }
    const fp = learningPathFingerprint(roadmapStructured);
    const saved = user?.learningPathProgress;
    const max = roadmapStructured.phases.length - 1;
    if (saved?.fingerprint === fp && typeof saved.currentStep === 'number') {
      setJourneyStep(Math.min(Math.max(0, saved.currentStep), max));
    } else {
      setJourneyStep(0);
    }
  }, [roadmapStructured, user?.learningPathProgress?.fingerprint, user?.learningPathProgress?.currentStep, user?.id]);

  const generatePath = async () => {
    if (!user?.id) return;

    // ── Engineering domain gate ──
    if (prompt.trim()) {
      const { isEngineering } = validateEngineeringDomain(prompt.trim());
      if (!isEngineering) {
        setDomainError(OUT_OF_DOMAIN_MESSAGE);
        return;
      }
    }
    setDomainError('');

    setLoading(true);
    await updateUser({ learningPathPrompt: prompt.trim() });
    try {
      const [hist, perf] = await Promise.all([
        getQuizHistory(user.id),
        getPerformanceData(user.id),
      ]);
      setHistory(hist);
      setPerformance(perf);
      const weak = filterLearningPathWeakAreas(identifyWeakAreas(hist));
      setWeakAreas(weak);
      const path = await getAdaptiveLearningPath(
        weak,
        hist,
        user?.level || 1,
        pathContext(user, prompt.trim(), perf),
      );
      setAiPath(path);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  function youtubeSearchHref(q) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  }

  const getResourcesForTopic = (subject, topic) => resourceBank[subject]?.[topic] || [];

  const safeJourneyStep = useMemo(() => {
    const n = roadmapStructured?.phases?.length || 0;
    if (n === 0) return 0;
    return Math.min(Math.max(0, journeyStep), n - 1);
  }, [roadmapStructured?.phases?.length, journeyStep]);

  const persistStep = async (next) => {
    if (!roadmapStructured?.phases?.length) return;
    const fp = learningPathFingerprint(roadmapStructured);
    const max = roadmapStructured.phases.length - 1;
    const clamped = Math.min(Math.max(0, next), max);
    setJourneyStep(clamped);
    try {
      await updateUser({
        learningPathProgress: { fingerprint: fp, currentStep: clamped },
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (initialLoading) {
    return (
      <div className="learning-path-page lp-page lp-loading animate-fadeIn">
        <LuLoader className="pq-spin lp-spin" aria-hidden />
        <p>Building your path…</p>
      </div>
    );
  }

  return (
    <div className="learning-path-page lp-page animate-fadeIn">
      <div className="lp-hero">
        <div className="lp-hero-glow" aria-hidden />
        <div className="page-header lp-header">
          <div className="page-header-icon lp-icon-bounce">
            <LuRoute />
          </div>
          <div>
            <h1>Your roadmap</h1>
            <p className="lp-sub">
              Type a topic (e.g. <strong>DSA</strong>) — <strong>Gemini 2.5 Flash</strong> (same as your first quiz) builds a <strong>7-day sequence</strong>: what to study each day in order, with YouTube picks.
              The map below is your roadmap: each stop is a day; the car advances when you tap <strong>Next stop</strong>.
            </p>
          </div>
        </div>
      </div>

      {(user?.onboardingQuizSummary || user?.studyKeywords) && (
        <div className="lp-context glass-card">
          {user?.onboardingQuizSummary && (
            <p className="lp-context-line"><LuSparkles /> <strong>First quiz:</strong> {user.onboardingQuizSummary}</p>
          )}
          {user?.studyKeywords && (
            <p className="lp-context-line"><LuTarget /> <strong>Keywords:</strong> {user.studyKeywords}</p>
          )}
        </div>
      )}

      <div className="lp-prompt glass-card">
        <label htmlFor="lp-prompt-input" className="lp-prompt-label">
          <LuSparkles /> What do you want to study? Need a roadmap for…
        </label>
        <textarea
          id="lp-prompt-input"
          className="lp-prompt-input"
          rows={3}
          placeholder="e.g. DSA for interviews — 7 days, or JEE rotation mechanics week, or NEET genetics…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="lp-prompt-actions">
          {domainError && (
            <div className="lp-domain-error">
              <LuShieldAlert /> {domainError}
            </div>
          )}
          <button type="button" className="btn btn-primary lp-btn-magic" onClick={generatePath} disabled={loading}>
            {loading ? <LuLoader className="lp-spin" /> : <LuRocket />}
            {loading ? 'Generating…' : 'Regenerate roadmap'}
          </button>
        </div>
      </div>

      <div className="lp-ai-card glass-card">
        <div className="ai-path-header">
          <div className="ai-path-title">
            <LuSparkles className="lp-star" />
            <h2>Your adaptive plan</h2>
          </div>
        </div>

        {loading && !aiPath ? (
          <div className="ai-loading-full">
            <LuLoader className="pq-spin lp-spin" />
            <p>Gemini is shaping your road from every quiz you&apos;ve taken, weak topics, domains, and keywords…</p>
          </div>
        ) : roadmapStructured ? (
          <div className="lp-structured">
            {roadmapStructured.primaryTopic ? (
              <p className="lp-primary-topic">
                Plan focus: <strong>{roadmapStructured.primaryTopic}</strong>
              </p>
            ) : null}
            {roadmapStructured.summary ? (
              <p className="lp-roadmap-summary">{roadmapStructured.summary}</p>
            ) : null}

            <LearningPathRoadmapFlow phases={roadmapStructured.phases} activeIndex={safeJourneyStep} />

            {(() => {
              const phase = roadmapStructured.phases[safeJourneyStep];
              if (!phase) return null;
              const lastIdx = roadmapStructured.phases.length - 1;
              return (
                <div className="lp-current-stop glass-card">
                  <div className="lp-current-stop-head">
                    <span className="lp-current-stop-label">Stop {safeJourneyStep + 1} of {roadmapStructured.phases.length}</span>
                    <h3 className="lp-current-stop-title">{phase.title}</h3>
                    {phase.timeEstimate ? (
                      <span className="lp-phase-time lp-phase-time--inline">{phase.timeEstimate}</span>
                    ) : null}
                  </div>
                    {phase.overview ? <p className="lp-phase-overview">{phase.overview}</p> : null}

                    {phase.studySequence?.length > 0 ? (
                      <div className="lp-study-sequence-block">
                        <h4 className="lp-study-sequence-title">Study in this order today</h4>
                        <ol className="lp-study-sequence">
                          {phase.studySequence.map((line, si) => (
                            <li key={si}>{line}</li>
                          ))}
                        </ol>
                      </div>
                    ) : null}

                    {phase.subtopics.length > 0 ? (
                    <div className="lp-subtopics-block">
                      <h4 className="lp-subtopics-title">Subtopics &amp; depth</h4>
                      <ul className="lp-subtopics">
                        {phase.subtopics.map((st) => (
                          <li key={st.name} className="lp-subtopic-card">
                            <h5 className="lp-subtopic-name">{st.name}</h5>
                            {st.detail ? <p className="lp-subtopic-detail">{st.detail}</p> : null}
                            <div className="lp-yt-row">
                              {st.youtubeUrl ? (
                                <a
                                  href={st.youtubeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="lp-yt-link lp-yt-link--primary"
                                >
                                  <LuPlay aria-hidden /> Watch on YouTube
                                  <LuExternalLink className="lp-yt-ext" aria-hidden />
                                </a>
                              ) : null}
                              {st.youtubeSearchQuery ? (
                                <a
                                  href={youtubeSearchHref(st.youtubeSearchQuery)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="lp-yt-link lp-yt-link--secondary"
                                >
                                  <LuPlay aria-hidden /> Search: {st.youtubeSearchQuery.slice(0, 48)}
                                  {st.youtubeSearchQuery.length > 48 ? '…' : ''}
                                  <LuExternalLink className="lp-yt-ext" aria-hidden />
                                </a>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {phase.actions?.length > 0 ? (
                    <ul className="lp-phase-actions">
                      {phase.actions.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="lp-journey-nav">
                    <button
                      type="button"
                      className="btn btn-secondary lp-journey-btn"
                      disabled={safeJourneyStep <= 0}
                      onClick={() => persistStep(safeJourneyStep - 1)}
                    >
                      <LuChevronLeft aria-hidden /> Previous stop
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary lp-journey-btn lp-journey-btn--next"
                      disabled={safeJourneyStep >= lastIdx}
                      onClick={() => persistStep(safeJourneyStep + 1)}
                    >
                      Next stop <LuChevronRight aria-hidden />
                    </button>
                  </div>
                  {safeJourneyStep >= lastIdx ? (
                    <p className="lp-journey-done">
                      You&apos;re at the last stop—take a quiz to earn new data, then hit <strong>Regenerate roadmap</strong>.
                    </p>
                  ) : null}
                </div>
              );
            })()}

            {(roadmapStructured.diagramMermaid || roadmapStructured.diagramDescription) ? (
              <details className="lp-map-details glass-card">
                <summary className="lp-map-details-summary">
                  <LuGitBranch aria-hidden /> Concept map (Mermaid diagram)
                </summary>
                {roadmapStructured.diagramDescription ? (
                  <p className="lp-diagram-desc">{roadmapStructured.diagramDescription}</p>
                ) : null}
                <LearningPathMermaid code={roadmapStructured.diagramMermaid} />
              </details>
            ) : null}

            {roadmapStructured.funChallenge ? (
              <div className="lp-footer-callout lp-footer-callout--fun glass-card">
                <strong>Fun challenge:</strong> {roadmapStructured.funChallenge}
              </div>
            ) : null}
            {roadmapStructured.quizReminder ? (
              <div className="lp-footer-callout lp-footer-callout--quiz glass-card">
                <strong>Quizzes:</strong> {roadmapStructured.quizReminder}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="lp-roadmap">
              {legacySteps.length === 0 ? (
                <div className="ai-path-content lp-fallback-text">
                  {(aiPath || '').split('\n').map((line, idx) => (
                    <p key={idx} className={line.includes('**') ? 'ai-path-bold' : ''}>
                      {line.replace(/\*\*/g, '')}
                    </p>
                  ))}
                </div>
              ) : (
                legacySteps.map((step, idx) => (
                  <div key={step.id} className="lp-node" style={{ animationDelay: `${idx * 0.08}s` }}>
                    <div className="lp-node-rail" aria-hidden />
                    <div className="lp-node-badge">{idx + 1}</div>
                    <div className="lp-node-body">
                      <h3>{step.title}</h3>
                      {step.lines?.length > 0 && (
                        <ul>
                          {step.lines.map((line, j) => (
                            <li key={j}>{line}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {weakAreas.length > 0 && (
        <div className="weak-detail-section">
          <h2 className="section-title-small lp-section-title">
            <LuTarget style={{ color: '#E0A546' }} /> Focus areas (from quizzes)
          </h2>
          <div className="weak-detail-grid">
            {weakAreas.map((area, idx) => {
              const resources = getResourcesForTopic(area.subject, area.topic);
              return (
                <div key={idx} className="weak-detail-card glass-card lp-card-pop">
                  <div className="weak-detail-header">
                    <div>
                      <span className="weak-detail-subject">{area.subject}</span>
                      <h3>{area.topic}</h3>
                    </div>
                    <div
                      className="weak-detail-accuracy"
                      style={{
                        color: area.accuracy < 40 ? '#f43f5e' : area.accuracy < 60 ? '#E0A546' : '#3b82f6',
                      }}
                    >
                      {area.accuracy}%
                    </div>
                  </div>

                  <div className="progress-bar" style={{ marginBottom: 'var(--s4)' }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: `${area.accuracy}%`,
                        background: area.accuracy < 40 ? 'var(--gradient-danger)' : 'var(--gradient-warm)',
                      }}
                    />
                  </div>

                  <div className="weak-detail-stats">
                    <span>Correct: {area.correct}/{area.total}</span>
                    <span>Priority: {area.accuracy < 40 ? 'High' : area.accuracy < 60 ? 'Medium' : 'Low'}</span>
                  </div>

                  {resources.length > 0 && (
                    <div className="weak-detail-resources">
                      <h4>Recommended resources</h4>
                      {resources.map((res, ridx) => (
                        <a key={ridx} href={res.url} target="_blank" rel="noopener noreferrer" className="resource-link">
                          <span>{res.type === 'video' ? '🎥' : res.type === 'article' ? '📄' : '💻'} {res.title}</span>
                          <LuExternalLink />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {weakAreas.length === 0 && (
        <div className="all-good-card glass-card lp-all-good">
          <span className="all-good-icon">🎉</span>
          <h3>Looking strong</h3>
          <p>No big weak areas from library quizzes yet. Keep going, or take a quiz to sharpen the roadmap.</p>
          <Link to="/quiz/select" className="btn btn-primary lp-btn-magic">
            <LuBookOpen /> Take a quiz
            <LuArrowRight />
          </Link>
        </div>
      )}
    </div>
  );
}
