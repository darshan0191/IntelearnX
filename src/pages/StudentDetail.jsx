import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getUserProfile, getPerformanceData, getQuizHistory } from '../services/storageService';
import {
  ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts';
import {
  LuTarget, LuTrophy, LuZap, LuFlame, LuBookOpen, LuTriangleAlert,
  LuLoader, LuSparkles, LuRoute, LuStar, LuTrendingUp, 
  LuChartNoAxesColumn, LuSignal, LuChevronLeft, LuCalendar, LuClock
} from 'react-icons/lu';
import './StudentDetail.css';

const DIFFICULTY_COLORS = { Easy: '#4CAF82', Medium: '#E0A546', Hard: '#D4645C' };
const SUBJECT_COLORS = ['#a78bfa', '#5B9BD5', '#4CAF82', '#E0A546', '#D4645C', '#22d3ee', '#f472b6'];

export default function StudentDetail() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!studentId) return;
      try {
        const [prof, perf, hist] = await Promise.all([
          getUserProfile(studentId),
          getPerformanceData(studentId),
          getQuizHistory(studentId),
        ]);
        setProfile(prof);
        setPerformance(perf);
        setHistory(hist);
      } catch (err) {
        console.error('Failed to load student detail:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [studentId]);

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
      return {
        name: `Q${idx + 1}`,
        date: new Date(quiz.timestamp).toLocaleDateString(),
        accuracy,
        cumulative: cumAccuracy,
        subject: quiz.subject || quiz.topic || '',
      };
    });
  }, [history]);

  const subjectChartData = useMemo(() => {
    const sa = performance?.subjectAccuracy || {};
    return Object.entries(sa)
      .filter(([, v]) => v && v.total > 0)
      .map(([name, v]) => ({
        name: name.length > 15 ? name.slice(0, 13) + '…' : name,
        fullName: name,
        accuracy: Math.round((v.correct / v.total) * 100),
        quizzes: v.total,
      }))
      .sort((a, b) => b.accuracy - a.accuracy);
  }, [performance?.subjectAccuracy]);

  if (loading) {
    return (
      <div className="sd-detail-loading">
        <LuLoader className="pq-spin" />
        <p>Loading student analytics…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="sd-detail-error">
        <h2>Student not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/educator-dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="sd-detail-page animate-fadeInUp">
      <header className="sd-detail-header">
        <button className="sd-back-btn" onClick={() => navigate('/educator-dashboard')}>
          <LuChevronLeft /> Back to Dashboard
        </button>
        <div className="sd-profile-summary">
          <div className="sd-avatar">{profile.avatar || '🧑‍🎓'}</div>
          <div className="sd-name-wrap">
            <h1>{profile.name}</h1>
            <div className="sd-meta-badges">
              <span className="sd-badge-pill"><LuCalendar /> Joined {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}</span>
              <span className="sd-badge-pill"><LuClock /> Active {profile.lastLogin ? new Date(profile.lastLogin).toLocaleTimeString() : 'Recently'}</span>
            </div>
          </div>
          <div className="sd-header-stats">
            <div className="sd-h-stat">
              <LuZap /> <span>{profile.xp || 0} XP</span>
            </div>
            <div className="sd-h-stat">
              <LuStar /> <span>Level {profile.level || 1}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="sd-detail-grid">
        {/* Metric Cards */}
        <div className="sd-metric-cards">
          <div className="sd-metric-card">
            <div className="sd-m-icon" style={{ background: 'rgba(212,100,92,0.1)', color: '#D4645C' }}><LuTarget /></div>
            <div className="sd-m-info">
              <h3>Overall Accuracy</h3>
              <p>{performance.overallAccuracy}%</p>
            </div>
          </div>
          <div className="sd-metric-card">
            <div className="sd-m-icon" style={{ background: 'rgba(76,175,130,0.1)', color: '#4CAF82' }}><LuTrophy /></div>
            <div className="sd-m-info">
              <h3>Quizzes Done</h3>
              <p>{performance.totalQuizzes}</p>
            </div>
          </div>
          <div className="sd-metric-card">
            <div className="sd-m-icon" style={{ background: 'rgba(224,165,70,0.1)', color: '#E0A546' }}><LuFlame /></div>
            <div className="sd-m-info">
              <h3>Login Streak</h3>
              <p>{profile.loginStreak || 0} Days</p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <section className="sd-charts-section">
          <div className="sd-chart-box">
            <h3 className="sd-chart-title"><LuTrendingUp /> Accuracy Trend</h3>
            <div className="sd-chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={accuracyTrendData}>
                  <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#666" fontSize={11} tickFormatter={v => `${v}%`} />
                  <Tooltip 
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                    itemStyle={{ color: '#a78bfa' }}
                  />
                  <Area type="monotone" dataKey="accuracy" stroke="#a78bfa" fill="rgba(167,139,250,0.1)" strokeWidth={2} />
                  <Area type="monotone" dataKey="cumulative" stroke="#22d3ee" fill="transparent" strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="sd-chart-box">
            <h3 className="sd-chart-title"><LuChartNoAxesColumn /> Subject Mastery</h3>
            <div className="sd-chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={subjectChartData} layout="vertical" margin={{ left: -20 }}>
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis type="category" dataKey="name" stroke="#666" fontSize={11} width={100} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }} />
                  <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} barSize={20}>
                    {subjectChartData.map((_, i) => <Cell key={i} fill={SUBJECT_COLORS[i % SUBJECT_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Quiz History Table */}
        <section className="sd-history-section">
          <h3 className="sd-section-title"><LuBookOpen /> Detailed Quiz History</h3>
          <div className="sd-table-wrap">
            <table className="sd-history-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Date</th>
                  <th>Difficulty</th>
                  <th>Score</th>
                  <th>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {history.map((quiz, i) => (
                  <tr key={i}>
                    <td><strong>{quiz.topic}</strong></td>
                    <td>{new Date(quiz.timestamp).toLocaleDateString()}</td>
                    <td><span className={`sd-diff-tag ${quiz.difficulty}`}>{quiz.difficulty}</span></td>
                    <td>{quiz.correctAnswers} / {quiz.totalQuestions}</td>
                    <td className={quiz.correctAnswers / quiz.totalQuestions >= 0.7 ? 'text-success' : 'text-danger'}>
                      {Math.round((quiz.correctAnswers / quiz.totalQuestions) * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Areas of Improvement */}
        <section className="sd-insights-section">
          <div className="sd-insight-card">
            <h3 className="sd-chart-title"><LuTriangleAlert /> Weak Areas</h3>
            <div className="sd-pill-grid">
              {performance.weakAreas.slice(0, 5).map((area, i) => (
                <div key={i} className="sd-pill-red">{area.topic} ({area.accuracy}%)</div>
              ))}
              {performance.weakAreas.length === 0 && <p className="sd-empty">No critical weak areas identified.</p>}
            </div>
          </div>
          <div className="sd-insight-card">
            <h3 className="sd-chart-title"><LuSparkles /> Top Performing Topics</h3>
            <div className="sd-pill-grid">
              {performance.strongAreas.slice(0, 5).map((area, i) => (
                <div key={i} className="sd-pill-gold">{area.topic} ({area.accuracy}%)</div>
              ))}
              {performance.strongAreas.length === 0 && <p className="sd-empty">Insufficient data for top topics.</p>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
