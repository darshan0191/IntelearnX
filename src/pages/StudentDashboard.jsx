import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPerformanceData, getQuizHistory } from '../services/storageService';
import {
  ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts';
import {
  LuTarget, LuTrophy, LuZap, LuFlame, LuBookOpen, LuTriangleAlert,
  LuLoader, LuSparkles, LuCompass, LuLightbulb, LuRoute, LuStar,
  LuTrendingUp, LuChartNoAxesColumn, LuSignal,
} from 'react-icons/lu';
import {
  getKeywordRadarRows,
  buildFallbackReviewTopics,
} from '../utils/dashboardInsights';
import { generateReviewSuggestionsFromQuiz, domainIdToLabel } from '../services/personalizedQuizService';
import SemanticSearch from '../components/SemanticSearch';
import './Dashboard.css';

function RadarSkillTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const title = row.fullLabel || row.skill;
  let detail = 'Add library quizzes that match this keyword for a sharper score';
  if (row.baselineOnly) detail = `${row.accuracy}% · baseline from your first quiz`;
  else if (row.practiced) detail = `${row.accuracy}% · blended from your activity`;
  return (
    <div className="sd-chart-tooltip">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="sd-chart-tooltip">
      <strong>{d.name} · {d.date}</strong>
      <span>Accuracy: {d.accuracy}%</span>
      <span>Cumulative: {d.cumulative}%</span>
      {d.subject && <span style={{ opacity: 0.6 }}>{d.subject}</span>}
    </div>
  );
}

function SubjectTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="sd-chart-tooltip">
      <strong>{d.fullName}</strong>
      <span>Accuracy: {d.accuracy}%</span>
      <span>Questions: {d.quizzes}</span>
    </div>
  );
}

function DifficultyTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="sd-chart-tooltip">
      <strong>{d.name} Difficulty</strong>
      <span>Accuracy: {d.accuracy}%</span>
      <span>Correct: {d.correct} / {d.total}</span>
    </div>
  );
}


const defaultPerformance = {
  totalQuizzes: 0,
  totalQuestions: 0,
  totalCorrect: 0,
  overallAccuracy: 0,
  topicAccuracy: {},
  subjectAccuracy: {},
  difficultyBreakdown: {
    easy: { correct: 0, total: 0 },
    medium: { correct: 0, total: 0 },
    hard: { correct: 0, total: 0 },
  },
  recentTrend: [],
  weakAreas: [],
  strongAreas: [],
  topicPerformance: [],
  domainAccuracy: {},
  domainWeakAreas: [],
  domainPerformance: [],
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const [performance, setPerformance] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewPack, setReviewPack] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!user?.id) return;
      try {
        const [perf, hist] = await Promise.all([
          getPerformanceData(user.id),
          getQuizHistory(user.id),
        ]);
        setPerformance(perf);
        setHistory(hist);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setPerformance(defaultPerformance);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user?.id, user?.introQuizCompleted, user?.studyDomainIds, user?.studyKeywords, user?.onboardingQuizSummary, user?.onboardingDomainScores, user?.onboardingIntroAccuracy]);

  const keywordRadarRows = useMemo(
    () => getKeywordRadarRows(user, performance) ?? [],
    [user, performance],
  );
  const showKeywordRadar = keywordRadarRows.length > 0;

  const keywordSignals = useMemo(
    () => keywordRadarRows.filter((r) => r.practiced || r.baselineOnly).length,
    [keywordRadarRows],
  );

  useEffect(() => {
    if (!user || !performance) return;
    let cancelled = false;

    const subjectAccuracyCompact = Object.fromEntries(
      Object.entries(performance.subjectAccuracy || {})
        .filter(([, v]) => v && v.total > 0)
        .map(([k, v]) => [k, { pct: Math.round((v.correct / v.total) * 100), n: v.total }]),
    );

    const context = {
      studyDomains: (user.studyDomainIds || []).map(domainIdToLabel),
      studyKeywords: user.studyKeywords || '',
      onboardingQuizSummary: user.onboardingQuizSummary || '',
      onboardingDomainScores: user.onboardingDomainScores || {},
      overallAccuracy: performance.overallAccuracy,
      totalQuizzes: performance.totalQuizzes,
      domainWeakAreas: (performance.domainWeakAreas || []).slice(0, 4),
      weakAreas: (performance.weakAreas || []).slice(0, 5),
      subjectAccuracy: subjectAccuracyCompact,
    };

    async function run() {
      setReviewLoading(true);
      try {
        const ai = await generateReviewSuggestionsFromQuiz(context);
        if (cancelled) return;
        if (ai) {
          setReviewPack(ai);
        } else {
          setReviewPack(buildFallbackReviewTopics(performance));
        }
      } catch (e) {
        if (!cancelled) setReviewPack(buildFallbackReviewTopics(performance));
      } finally {
        if (!cancelled) setReviewLoading(false);
      }
    }
    const timeoutId = setTimeout(() => {
      run();
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      cancelled = true;
    };
  }, [user, performance]);

  // ── Chart data: Accuracy Trend ──
  const accuracyTrendData = useMemo(() => {
    if (!history || history.length === 0) return [];
    const sorted = [...history].reverse();
    let cumulativeCorrect = 0;
    let cumulativeTotal = 0;
    return sorted.map((quiz, idx) => {
      const accuracy = quiz.totalQuestions > 0
        ? Math.round((quiz.correctAnswers / quiz.totalQuestions) * 100)
        : 0;
      cumulativeCorrect += quiz.correctAnswers || 0;
      cumulativeTotal += quiz.totalQuestions || 0;
      const cumAccuracy = cumulativeTotal > 0
        ? Math.round((cumulativeCorrect / cumulativeTotal) * 100)
        : 0;
      const dateStr = new Date(quiz.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        name: `Q${idx + 1}`,
        date: dateStr,
        accuracy,
        cumulative: cumAccuracy,
        subject: quiz.subject || quiz.topic || '',
      };
    });
  }, [history]);

  // ── Chart data: Subject Performance ──
  const subjectChartData = useMemo(() => {
    const sa = performance?.subjectAccuracy || {};
    return Object.entries(sa)
      .filter(([, v]) => v && v.total > 0)
      .map(([name, v]) => ({
        name: name.length > 18 ? name.slice(0, 16) + '…' : name,
        fullName: name,
        accuracy: Math.round((v.correct / v.total) * 100),
        quizzes: v.total,
      }))
      .sort((a, b) => b.accuracy - a.accuracy);
  }, [performance?.subjectAccuracy]);

  // ── Chart data: Difficulty Breakdown ──
  const difficultyChartData = useMemo(() => {
    const db = performance?.difficultyBreakdown || {};
    return ['easy', 'medium', 'hard']
      .filter(d => db[d] && db[d].total > 0)
      .map(d => ({
        name: d.charAt(0).toUpperCase() + d.slice(1),
        accuracy: Math.round((db[d].correct / db[d].total) * 100),
        correct: db[d].correct,
        total: db[d].total,
      }));
  }, [performance?.difficultyBreakdown]);

  const DIFFICULTY_COLORS = { Easy: '#4CAF82', Medium: '#E0A546', Hard: '#D4645C' };
  const SUBJECT_COLORS = ['#a78bfa', '#5B9BD5', '#4CAF82', '#E0A546', '#D4645C', '#22d3ee', '#f472b6'];

  if (loading || !performance) {
    return (
      <div className="dashboard sd-dashboard sd-dashboard--loading animate-fadeIn">
        <LuLoader className="pq-spin sd-loader" aria-hidden />
        <p className="sd-loader-text">Loading your insights…</p>
      </div>
    );
  }

  const hasQuizActivity = performance.totalQuizzes > 0;
  const firstName = user?.name?.split(' ')[0] || 'Student';
  const displayReview = reviewPack || buildFallbackReviewTopics(performance);

  return (
    <div className="dashboard sd-dashboard sd-dashboard--genz animate-fadeIn">
      <section className="sd-hero">
        <div className="sd-hero-bg" aria-hidden />
        <div className="sd-hero-inner">
          <div className="sd-hero-copy">
            <p className="sd-hero-eyebrow">
              <LuSparkles aria-hidden /> Your learning cockpit
            </p>
            <h1>Welcome back, {firstName} 👋</h1>
            <p className="sd-hero-sub">
              {user?.studyKeywords
                ? <>Your focus: <em className="sd-kw-chip">{user.studyKeywords.slice(0, 120)}{user.studyKeywords.length > 120 ? '…' : ''}</em></>
                : hasQuizActivity
                  ? 'Track your skills, spot gaps, and follow AI-generated next steps from your quizzes.'
                  : 'Complete onboarding to see your domain radar and tailored guidance.'}
            </p>
          </div>
          <div className="sd-hero-actions">
            <Link to="/quiz/select" className="btn-fold" id="dashboard-take-quiz">
              <LuBookOpen /> {hasQuizActivity ? 'Take a quiz' : 'Start first quiz'}
            </Link>
            {hasQuizActivity && (
              <Link to="/learning-path" className="btn btn-secondary sd-hero-secondary">
                <LuRoute /> Learning path
              </Link>
            )}
          </div>
        </div>
        {/* stat pills strip */}
        <div className="sd-hero-stats">
          <span className="sd-hero-stat-pill">
            <LuZap style={{ color: '#D4645C' }} /> {user?.xp || 0} XP
          </span>
          <span className="sd-hero-stat-pill">
            <LuStar style={{ color: '#10b981' }} /> Level {user?.level || 1}
          </span>
          <span className="sd-hero-stat-pill">
            <LuTarget style={{ color: '#5B8FB9' }} /> {performance.overallAccuracy}% accuracy
          </span>
          <span className="sd-hero-stat-pill">
            <LuFlame style={{ color: '#E0A546' }} /> {user?.loginStreak || 0} day streak
          </span>
          <span className="sd-hero-stat-pill">
            <LuTrophy style={{ color: '#fbbf24' }} /> {performance.totalQuizzes} quizzes
          </span>
        </div>
      </section>

      {!hasQuizActivity && (
        <div className="sd-empty-banner glass-card">
          <LuCompass className="sd-empty-banner-icon" aria-hidden />
          <div>
            <strong>No quiz history yet</strong>
            <p>Your radar uses your first-quiz score on each keyword until library quizzes add more detail.</p>
          </div>
          <Link to="/quiz/select" className="btn btn-primary btn-sm">Browse quizzes</Link>
        </div>
      )}

      {/* ── Semantic Search Bar ── */}
      <section className="sd-search-section">
        <SemanticSearch
          userId={user?.id || ''}
          placeholder="Search your PDFs, quizzes, and study notes semantically…"
          maxResults={5}
        />
      </section>

      <div className="dashboard-stats sd-stats">

        {/* Flip Card 1 — Overall Accuracy */}
        <div className="flip-stat-card">
          <div className="flip-stat-inner">
            <div className="flip-stat-front">
              <div className="flip-stat-icon" style={{ background: 'rgba(212,100,92,0.12)', color: '#D4645C' }}>
                <LuTarget />
              </div>
              <p className="flip-stat-label-front">Overall Accuracy</p>
            </div>
            <div className="flip-stat-back" style={{ '--fc': '#D4645C', '--fb': 'linear-gradient(135deg, rgba(212,100,92,0.12) 0%, rgba(245,158,11,0.08) 100%)' }}>
              <div className="flip-stat-icon-back" style={{ color: '#D4645C' }}><LuTarget /></div>
              <div className="flip-stat-value">{performance.overallAccuracy}%</div>
              <div className="flip-stat-label-back">Overall Accuracy</div>
            </div>
          </div>
        </div>

        {/* Flip Card 2 — Quizzes Completed */}
        <div className="flip-stat-card">
          <div className="flip-stat-inner">
            <div className="flip-stat-front">
              <div className="flip-stat-icon" style={{ background: 'rgba(76,175,130,0.12)', color: '#4CAF82' }}>
                <LuTrophy />
              </div>
              <p className="flip-stat-label-front">Quizzes Completed</p>
            </div>
            <div className="flip-stat-back" style={{ '--fc': '#4CAF82', '--fb': 'linear-gradient(135deg, rgba(76,175,130,0.12) 0%, rgba(5,150,105,0.08) 100%)' }}>
              <div className="flip-stat-icon-back" style={{ color: '#4CAF82' }}><LuTrophy /></div>
              <div className="flip-stat-value">{performance.totalQuizzes}</div>
              <div className="flip-stat-label-back">Quizzes Completed</div>
            </div>
          </div>
        </div>

        {/* Flip Card 3 — Total XP */}
        <div className="flip-stat-card">
          <div className="flip-stat-inner">
            <div className="flip-stat-front">
              <div className="flip-stat-icon" style={{ background: 'rgba(224,165,70,0.12)', color: '#E0A546' }}>
                <LuZap />
              </div>
              <p className="flip-stat-label-front">Total XP</p>
            </div>
            <div className="flip-stat-back" style={{ '--fc': '#E0A546', '--fb': 'linear-gradient(135deg, rgba(224,165,70,0.12) 0%, rgba(217,119,6,0.08) 100%)' }}>
              <div className="flip-stat-icon-back" style={{ color: '#E0A546' }}><LuZap /></div>
              <div className="flip-stat-value">{user?.xp || 0}</div>
              <div className="flip-stat-label-back">Total XP</div>
            </div>
          </div>
        </div>

        {/* Flip Card 4 — Correct Answers */}
        <div className="flip-stat-card">
          <div className="flip-stat-inner">
            <div className="flip-stat-front">
              <div className="flip-stat-icon" style={{ background: 'rgba(91,143,185,0.12)', color: '#5B8FB9' }}>
                <LuFlame />
              </div>
              <p className="flip-stat-label-front">Correct Answers</p>
            </div>
            <div className="flip-stat-back" style={{ '--fc': '#5B8FB9', '--fb': 'linear-gradient(135deg, rgba(91,143,185,0.12) 0%, rgba(59,130,246,0.08) 100%)' }}>
              <div className="flip-stat-icon-back" style={{ color: '#5B8FB9' }}><LuFlame /></div>
              <div className="flip-stat-value">{performance.totalCorrect}/{performance.totalQuestions}</div>
              <div className="flip-stat-label-back">Correct Answers</div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Growth & Activity Charts ── */}
      {hasQuizActivity && (
        <section className="sd-growth-section">
          <h2 className="sd-growth-title">
            <LuTrendingUp /> Growth & Activity
          </h2>

          <div className="sd-growth-grid">
            {/* ─ Accuracy Trend Chart ─ */}
            <div className="chart-card sd-growth-chart sd-growth-chart--trend">
              <h3 className="chart-title">
                <LuTrendingUp /> Accuracy Trend
              </h3>
              <p className="sd-growth-caption">Quiz-by-quiz accuracy with your cumulative average.</p>
              <div className="sd-growth-chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={accuracyTrendData} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="sdAccGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="sdCumGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'var(--border)' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={v => `${v}%`}
                    />
                    <Tooltip content={<TrendTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="accuracy"
                      stroke="#a78bfa"
                      strokeWidth={2.5}
                      fill="url(#sdAccGrad)"
                      dot={{ r: 3.5, fill: '#a78bfa', strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: '#a78bfa', stroke: '#1a1a1a', strokeWidth: 2 }}
                      name="Quiz Accuracy"
                      isAnimationActive
                      animationDuration={800}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#22d3ee"
                      strokeWidth={1.8}
                      strokeDasharray="5 3"
                      fill="url(#sdCumGrad)"
                      dot={false}
                      name="Cumulative Avg"
                      isAnimationActive
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="sd-growth-legend">
                <span className="sd-growth-legend-item"><span className="sd-legend-dot" style={{ background: '#a78bfa' }} /> Quiz Accuracy</span>
                <span className="sd-growth-legend-item"><span className="sd-legend-dot sd-legend-dot--dashed" style={{ background: '#22d3ee' }} /> Cumulative Avg</span>
              </div>
            </div>

            {/* ─ Subject Performance ─ */}
            <div className="chart-card sd-growth-chart sd-growth-chart--subjects">
              <h3 className="chart-title">
                <LuChartNoAxesColumn /> Subject Performance
              </h3>
              <p className="sd-growth-caption">Accuracy by subject across all your quizzes.</p>
              {subjectChartData.length > 0 ? (
                <div className="sd-growth-chart-wrap">
                  <ResponsiveContainer width="100%" height={Math.max(180, subjectChartData.length * 48 + 30)}>
                    <BarChart data={subjectChartData} layout="vertical" margin={{ top: 4, right: 30, bottom: 4, left: 8 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border)' }}
                        tickFormatter={v => `${v}%`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 500 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<SubjectTooltip />} cursor={{ fill: 'rgba(201,168,76,0.06)' }} />
                      <Bar dataKey="accuracy" radius={[0, 6, 6, 0]} barSize={22} isAnimationActive animationDuration={800}>
                        {subjectChartData.map((entry, idx) => (
                          <Cell key={entry.name} fill={SUBJECT_COLORS[idx % SUBJECT_COLORS.length]} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="sd-muted">Complete quizzes across different subjects to see your breakdown.</p>
              )}
            </div>

            {/* ─ Difficulty Breakdown ─ */}
            <div className="chart-card sd-growth-chart sd-growth-chart--difficulty">
              <h3 className="chart-title">
                <LuSignal /> Difficulty Breakdown
              </h3>
              <p className="sd-growth-caption">How you perform at each difficulty level.</p>
              {difficultyChartData.length > 0 ? (
                <div className="sd-growth-chart-wrap">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={difficultyChartData} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border)' }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={v => `${v}%`}
                      />
                      <Tooltip content={<DifficultyTooltip />} cursor={{ fill: 'rgba(201,168,76,0.06)' }} />
                      <Bar dataKey="accuracy" radius={[6, 6, 0, 0]} barSize={48} isAnimationActive animationDuration={800}>
                        {difficultyChartData.map(entry => (
                          <Cell key={entry.name} fill={DIFFICULTY_COLORS[entry.name] || '#a78bfa'} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="sd-muted">No difficulty data available yet.</p>
              )}
              {difficultyChartData.length > 0 && (
                <div className="sd-difficulty-summary">
                  {difficultyChartData.map(d => (
                    <div key={d.name} className="sd-diff-pill" style={{ '--dc': DIFFICULTY_COLORS[d.name] }}>
                      <span className="sd-diff-pill-dot" />
                      <span>{d.name}</span>
                      <strong>{d.correct}/{d.total}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="sd-suggestions-section">
          <div className="glass-card sd-suggestions-card sd-suggestions-card--single">
            <h3 className="card-title sd-card-title">
              <LuLightbulb /> Suggestions
              {reviewLoading && <LuLoader className="sd-inline-loader pq-spin" aria-hidden />}
            </h3>
            <p className="sd-review-summary">{displayReview.summary}</p>
            <p className="sd-review-meta sd-muted">
              {displayReview.source === 'gemini' ? 'Personalized with Gemini from your quiz data.' : 'Suggestions from your scores (add VITE_GEMINI_API_KEY for AI wording).'}
            </p>
            <ul className="sd-suggestion-list sd-review-topic-list">
              {displayReview.topics.map((t, idx) => (
                <li key={`${t.name}-${idx}`} className="sd-suggestion sd-suggestion--focus">
                  <span className="sd-suggestion-icon" aria-hidden>
                    <LuTriangleAlert />
                  </span>
                  <div>
                    <strong>{t.name}</strong>
                    <p>{t.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
      </section>

      <div className="dashboard-bottom sd-bottom sd-bottom--single">
        <div className="glass-card recent-quizzes-card sd-panel sd-panel--wide">
          <h3 className="card-title">Recent quizzes</h3>
          {history.length > 0 ? (
            <div className="recent-quizzes-list">
              {history.slice(-5).reverse().map((quiz, idx) => (
                <div key={idx} className="recent-quiz-item">
                  <div className="recent-quiz-info">
                    <span className="recent-quiz-topic">{quiz.topic}</span>
                    <span className="recent-quiz-date">{new Date(quiz.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div className={`recent-quiz-score ${quiz.correctAnswers / quiz.totalQuestions >= 0.7 ? 'good' : 'needs-work'}`}>
                    {Math.round((quiz.correctAnswers / quiz.totalQuestions) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="sd-muted">Your completed quizzes will appear here.</p>
          )}
        </div>
      </div>
    </div>
  );
}
