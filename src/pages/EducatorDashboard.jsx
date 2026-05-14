import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getClassStudents, getStudentPerformance, getAllUsers } from '../services/storageService';
import { LuUsers, LuTarget, LuTrendingUp, LuTriangleAlert, LuZap, LuLoader, LuBookOpen, LuSparkles, LuFileStack, LuChartColumn, LuChartLine } from 'react-icons/lu';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import './Dashboard.css';

export default function EducatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [students, setStudents] = useState([]);
  const [classData, setClassData] = useState({
    students: [],
    totalStudents: 0,
    avgAccuracy: 0,
    totalQuizzes: 0,
    heatmapData: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        let fetchedStudents = [];
        if (!user?.classCode) {
           const allUsers = await getAllUsers();
           fetchedStudents = allUsers.filter(u => u.role === 'student');
        } else {
           fetchedStudents = await getClassStudents(user.classCode);
        }
        
        setStudents(fetchedStudents);

        const topicHeatmap = {};
        let totalAccuracy = 0;
        let totalQuizzes = 0;

        const studentDetails = await Promise.all(fetchedStudents.map(async (student) => {
          const perf = await getStudentPerformance(student.id);
          totalAccuracy += perf.overallAccuracy;
          totalQuizzes += perf.totalQuizzes;

          // Aggregate topic performance
          (perf.topicPerformance || []).forEach(tp => {
            if (!topicHeatmap[tp.topic]) {
              topicHeatmap[tp.topic] = { totalAccuracy: 0, count: 0 };
            }
            topicHeatmap[tp.topic].totalAccuracy += tp.accuracy;
            topicHeatmap[tp.topic].count += 1;
          });

          return {
            ...student,
            performance: perf,
          };
        }));

        const heatmapData = Object.entries(topicHeatmap).map(([topic, data]) => ({
          topic: topic.split(' > ').pop() || topic,
          avgAccuracy: Math.round(data.totalAccuracy / data.count),
        }));

        setClassData({
          students: studentDetails,
          totalStudents: fetchedStudents.length,
          avgAccuracy: fetchedStudents.length > 0 ? Math.round(totalAccuracy / fetchedStudents.length) : 0,
          totalQuizzes,
          heatmapData,
        });

      } catch (err) {
         console.error("Failed to load educator data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const getHeatmapColor = (accuracy) => {
    if (accuracy >= 80) return { bg: 'rgba(76,175,130,0.1)', color: '#4CAF82' };
    if (accuracy >= 60) return { bg: 'rgba(91,143,185,0.1)', color: '#5B8FB9' };
    if (accuracy >= 40) return { bg: 'rgba(224,165,70,0.1)', color: '#E0A546' };
    return { bg: 'rgba(212,100,92,0.1)', color: '#D4645C' };
  };

  const chartTooltipStyle = {
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: '12px',
    color: '#2E2B27',
    fontSize: '0.8rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  };

  // Per-student chart data — Sorted by accuracy
  const studentChartData = useMemo(() => {
    return classData.students
      .map(s => ({
        name: s.name?.split(' ')[0] || 'Student',
        fullName: s.name,
        accuracy: s.performance.overallAccuracy,
        quizzes: s.performance.totalQuizzes,
      }))
      .sort((a, b) => b.accuracy - a.accuracy);
  }, [classData.students]);

  if (loading) {
    return (
      <div className="dashboard animate-fadeIn" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <LuLoader className="pq-spin" style={{ fontSize: '2rem', color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="dashboard animate-fadeIn">
      <div className="dashboard-welcome">
        <div>
          <h1>Educator Dashboard 🧑‍🏫</h1>
          <p>Class Code: <strong>{user?.classCode || 'All Students'}</strong></p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="educator-actions animate-fadeInUp">
        <h3 className="section-title">
          <LuSparkles /> Quick Actions
        </h3>
        <div className="action-grid">
          <Link to="/theory-bank" className="action-card tb-action-card">
            <div className="action-icon">
              <LuBookOpen />
            </div>
            <div className="action-info">
              <div className="action-name">Theory Bank Generator</div>
              <div className="action-desc">Generate 100 questions from PDFs</div>
            </div>
          </Link>
          <Link to="/question-paper" className="action-card tb-action-card">
            <div className="action-icon">
              <LuFileStack />
            </div>
            <div className="action-info">
              <div className="action-name">Question Paper Set</div>
              <div className="action-desc">Generate 3 sets of exam papers</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="educator-stats">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(212,100,92,0.08)', color: '#D4645C' }}>
            <LuUsers />
          </div>
          <div className="stat-value">{classData.totalStudents}</div>
          <div className="stat-label">Total Students</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(76,175,130,0.08)', color: '#4CAF82' }}>
            <LuTarget />
          </div>
          <div className="stat-value">{classData.avgAccuracy}%</div>
          <div className="stat-label">Average Accuracy</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(224,165,70,0.08)', color: '#E0A546' }}>
            <LuTrendingUp />
          </div>
          <div className="stat-value">{classData.totalQuizzes}</div>
          <div className="stat-label">Total Quizzes Taken</div>
        </div>
      </div>

      {/* Class-wide Heatmap */}
      <div className="chart-card" style={{ marginBottom: 'var(--s8)' }}>
        <h3 className="chart-title">
          <LuTriangleAlert style={{ color: '#E0A546' }} /> Class-Wide Weak Areas Heatmap
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 'var(--s4)' }}>
          Color intensity shows average class accuracy per topic. Red = weak, Green = strong.
        </p>
        {classData.heatmapData.length > 0 ? (
          <div className="heatmap-grid">
            {classData.heatmapData.map((cell, idx) => {
              const colors = getHeatmapColor(cell.avgAccuracy);
              return (
                <div
                  key={idx}
                  className="heatmap-cell"
                  style={{ background: colors.bg }}
                >
                  <div className="heatmap-topic">{cell.topic}</div>
                  <div className="heatmap-value" style={{ color: colors.color }}>{cell.avgAccuracy}%</div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', padding: 'var(--s6) 0', textAlign: 'center' }}>
            No data yet. Students need to take quizzes first.
          </p>
        )}
      </div>

      {/* Per-Student Performance Chart */}
      {studentChartData.length > 0 && (
        <div className="chart-card premium-chart-card" style={{ marginBottom: 'var(--s8)' }}>
          <div className="chart-header">
            <h3 className="chart-title">
              <LuChartColumn /> Student Performance Comparison
            </h3>
            <div className="chart-legend-custom">
              <span className="legend-item"><LuChartColumn style={{ color: '#D4645C' }} /> Accuracy</span>
              <span className="legend-item"><LuChartLine style={{ color: '#a78bfa' }} /> Quizzes Taken</span>
            </div>
          </div>
          <p className="chart-subtitle">Analyzing individual accuracy vs. total engagement (quizzes completed).</p>
          
          <div className="chart-container" style={{ height: '350px', marginTop: 'var(--s6)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={studentChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4645C" stopOpacity={1} />
                    <stop offset="100%" stopColor="#D4645C" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="var(--text-muted)" 
                  fontSize={11} 
                  tickLine={false}
                  axisLine={{ stroke: 'var(--card-border)' }}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="var(--text-muted)" 
                  fontSize={11} 
                  domain={[0, 100]} 
                  tickFormatter={(v) => `${v}%`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#a78bfa" 
                  fontSize={11} 
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v} Qs`}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="custom-chart-tooltip">
                          <p className="tooltip-label">{data.fullName}</p>
                          <div className="tooltip-stats">
                            <div className="t-stat">
                              <span className="t-dot" style={{ background: '#D4645C' }} />
                              <span className="t-name">Accuracy:</span>
                              <strong className="t-val">{data.accuracy}%</strong>
                            </div>
                            <div className="t-stat">
                              <span className="t-dot" style={{ background: '#a78bfa' }} />
                              <span className="t-name">Quizzes:</span>
                              <strong className="t-val">{data.quizzes}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="accuracy" 
                  fill="url(#barGradient)" 
                  radius={[6, 6, 0, 0]} 
                  barSize={32}
                >
                  {studentChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fillOpacity={0.8 + (entry.accuracy / 200)} />
                  ))}
                </Bar>
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="quizzes" 
                  stroke="#a78bfa" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#a78bfa', strokeWidth: 2, stroke: '#1a1a1a' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Student List */}
      <div className="chart-card">
        <h3 className="chart-title">
          <LuUsers /> Student Drill-Down
        </h3>
        {classData.students.length > 0 ? (
          <div className="student-list">
            {classData.students.map(student => (
              <div 
                key={student.id} 
                className="student-row clickable-row"
                onClick={() => navigate(`/educator/student/${student.id}`)}
                title="Click to view detailed insights"
              >
                <div className="student-row-info">
                  <div className="student-row-avatar">{student.avatar}</div>
                  <div>
                    <div className="student-row-name">{student.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Level {student.level || 1}</div>
                  </div>
                </div>
                <div className="student-row-stats">
                  <span><LuTarget /> {student.performance.overallAccuracy}%</span>
                  <span><LuTrendingUp /> {student.performance.totalQuizzes} quizzes</span>
                  <span><LuZap /> {student.xp || 0} XP</span>
                  {student.performance.weakAreas.length > 0 && (
                    <span style={{ color: '#E0A546' }}>
                      <LuTriangleAlert /> {student.performance.weakAreas.length} weak areas
                    </span>
                  )}
                </div>
                <div className="student-row-action">
                  <LuSparkles /> <span>View Insights</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--s8)' }}>
            No students found in this class.
          </p>
        )}
      </div>
    </div>
  );
}
