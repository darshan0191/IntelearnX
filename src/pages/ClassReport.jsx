import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getClassStudents, getStudentPerformance, getAllUsers } from '../services/storageService';
import {
  LuBookOpen,
  LuTrophy,
  LuDownload,
  LuPresentation,
  LuChevronLeft,
  LuChevronRight,
  LuArrowLeft,
  LuUsers,
  LuSparkles,
  LuPercent,
  LuActivity,
  LuFileText,
  LuGraduationCap,
  LuCalendar,
  LuX
} from 'react-icons/lu';
import './ClassReport.css';

export default function ClassReport() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [classCode, setClassCode] = useState(user?.classCode || '');
  const [institution, setInstitution] = useState(user?.institution || 'Academic Institute');
  const [subjectsTaught, setSubjectsTaught] = useState(user?.studyInterests || 'Global Curriculum');

  // Presentation State
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Statistics State
  const [classData, setClassData] = useState({
    students: [],
    totalStudents: 0,
    avgAccuracy: 0,
    totalQuizzes: 0,
    highlyActiveCount: 0,
    averageActiveCount: 0,
    needsAttentionCount: 0,
    toppers: []
  });

  useEffect(() => {
    async function loadReportData() {
      try {
        let fetchedStudents = [];
        if (!user?.classCode) {
          const allUsers = await getAllUsers();
          fetchedStudents = allUsers.filter(u => u.role === 'student');
        } else {
          fetchedStudents = await getClassStudents(user.classCode);
        }

        let totalAccuracy = 0;
        let totalQuizzes = 0;
        let highlyActive = 0;
        let avgActive = 0;
        let needsAttention = 0;

        const studentDetails = await Promise.all(
          fetchedStudents.map(async (student) => {
            const perf = await getStudentPerformance(student.id);
            totalAccuracy += perf.overallAccuracy;
            totalQuizzes += perf.totalQuizzes;

            // Enforce Activeness Metrics
            let status = 'Consistent';
            if (perf.totalQuizzes >= 8 && perf.overallAccuracy >= 75) {
              status = 'Highly Active';
              highlyActive++;
            } else if (perf.totalQuizzes < 3 || perf.overallAccuracy < 50) {
              status = 'Needs Attention';
              needsAttention++;
            } else {
              avgActive++;
            }

            return {
              ...student,
              accuracy: perf.overallAccuracy,
              quizzes: perf.totalQuizzes,
              status,
            };
          })
        );

        // Sort to get toppers
        const sortedToppers = [...studentDetails]
          .sort((a, b) => b.accuracy - a.accuracy || b.quizzes - a.quizzes)
          .slice(0, 3);

        setClassData({
          students: studentDetails.sort((a, b) => b.accuracy - a.accuracy),
          totalStudents: fetchedStudents.length,
          avgAccuracy: fetchedStudents.length > 0 ? Math.round(totalAccuracy / fetchedStudents.length) : 0,
          totalQuizzes,
          highlyActiveCount: highlyActive,
          averageActiveCount: avgActive,
          needsAttentionCount: needsAttention,
          toppers: sortedToppers
        });

      } catch (err) {
        console.error("Failed to compile academic report data", err);
      } finally {
        setLoading(false);
      }
    }
    loadReportData();
  }, [user]);

  // Dynamic status color maps
  const getStatusBadgeClass = (status) => {
    if (status === 'Highly Active') return 'badge-success-glow';
    if (status === 'Needs Attention') return 'badge-danger-glow';
    return 'badge-warning-glow';
  };

  // PDF Download Print Engine
  const handleDownloadReportPdf = () => {
    const printWindow = window.open('', '_blank');
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const studentRowsHtml = classData.students.map((s, idx) => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 10px; text-align: center; font-weight: bold;">${idx + 1}</td>
        <td style="padding: 10px; font-weight: 600;">${s.name}</td>
        <td style="padding: 10px; text-align: center;">${s.accuracy}%</td>
        <td style="padding: 10px; text-align: center;">${s.quizzes}</td>
        <td style="padding: 10px; text-align: center; font-weight: bold; color: ${
          s.status === 'Highly Active' ? '#10b981' : s.status === 'Needs Attention' ? '#ef4444' : '#f59e0b'
        };">${s.status}</td>
      </tr>
    `).join('');

    const toppersHtml = classData.toppers.map((t, idx) => `
      <div style="flex: 1; border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; background: #fafafa; margin: 0 10px;">
        <div style="font-size: 24px; margin-bottom: 8px;">
          ${idx === 0 ? '🏆 1st Rank' : idx === 1 ? '🥈 2nd Rank' : '🥉 3rd Rank'}
        </div>
        <h4 style="margin: 0 0 5px 0; font-size: 16px;">${t.name}</h4>
        <p style="margin: 0; color: #555; font-size: 14px;">Accuracy: <strong>${t.accuracy}%</strong></p>
        <p style="margin: 0; color: #777; font-size: 12px;">Quizzes Completed: ${t.quizzes}</p>
      </div>
    `).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Academic Performance Report - Class ${classCode || 'General'}</title>
          <style>
            body { font-family: 'Times New Roman', Times, serif; padding: 40px; color: #333; line-height: 1.6; }
            .header-table { width: 100%; border-bottom: 3px double #333; padding-bottom: 20px; margin-bottom: 30px; }
            .header-title { font-size: 26px; text-align: center; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; margin: 0 0 5px 0; }
            .header-subtitle { font-size: 18px; text-align: center; font-style: italic; margin: 0; color: #555; }
            .meta-section { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; }
            .section-title { font-size: 18px; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px; text-transform: uppercase; }
            .metrics-grid { display: flex; justify-content: space-between; margin-bottom: 25px; }
            .metric-card { flex: 1; border: 1px solid #333; padding: 12px; text-align: center; margin: 0 10px; background: #fff; }
            .metric-val { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
            .metric-lbl { font-size: 11px; text-transform: uppercase; color: #666; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            th { background-color: #f2f2f2; border: 1px solid #aaa; padding: 10px; font-weight: bold; text-align: center; }
            td { border: 1px solid #ddd; padding: 8px; }
            .footer-section { margin-top: 60px; display: flex; justify-content: space-between; font-size: 14px; }
            .signature-box { border-top: 1px solid #333; width: 220px; text-align: center; padding-top: 5px; margin-top: 40px; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <div class="header-title">${institution}</div>
                <div class="header-subtitle">Official Student Performance & Activeness Report</div>
              </td>
            </tr>
          </table>

          <div class="meta-section">
            <div>
              <strong>Faculty Name:</strong> ${user?.name} (${user?.yearOfStudy || 'Educator'})<br />
              <strong>Classroom Code:</strong> ${classCode || 'All Enrolled Students'}<br />
              <strong>Subjects Taught:</strong> ${subjectsTaught}
            </div>
            <div style="text-align: right;">
              <strong>Date of Generation:</strong> ${today}<br />
              <strong>Report ID:</strong> INT-REP-${Math.floor(1000 + Math.random() * 9000)}<br />
              <strong>Status:</strong> Official Assessment
            </div>
          </div>

          <div class="section-title">I. Key Performance Indicators</div>
          <div class="metrics-grid" style="margin-left: -10px; margin-right: -10px;">
            <div class="metric-card">
              <div class="metric-val">${classData.totalStudents}</div>
              <div class="metric-lbl">Total Students</div>
            </div>
            <div class="metric-card">
              <div class="metric-val">${classData.avgAccuracy}%</div>
              <div class="metric-lbl">Class Avg Accuracy</div>
            </div>
            <div class="metric-card">
              <div class="metric-val">${classData.highlyActiveCount}</div>
              <div class="metric-lbl">Highly Active Students</div>
            </div>
            <div class="metric-card">
              <div class="metric-val">${classData.needsAttentionCount}</div>
              <div class="metric-lbl">Needs Attention</div>
            </div>
          </div>

          <div class="section-title">II. Academic Class Toppers</div>
          <div style="display: flex; justify-content: space-between; margin-left: -10px; margin-right: -10px; margin-bottom: 25px;">
            ${toppersHtml}
          </div>

          <div class="section-title">III. Detailed Student Analytics Grid</div>
          <table>
            <thead>
              <tr>
                <th style="width: 8%;">Rank</th>
                <th style="text-align: left; padding-left: 15px;">Student Name</th>
                <th style="width: 20%;">Overall Accuracy</th>
                <th style="width: 20%;">Total Quizzes</th>
                <th style="width: 25%;">Engagement Rating</th>
              </tr>
            </thead>
            <tbody>
              ${studentRowsHtml}
            </tbody>
          </table>

          <div class="section-title">IV. Declarations & Institution Seals</div>
          <p style="font-size: 12px; color: #555; text-align: justify;">
            This report represents the cumulative scores, activeness logs, and topper rankings tracked securely via the IntelearnX academic framework. Student engagement indices are updated in real-time based on test completions, timing scores, and topic accuracy ratios. All metrics contained within are official and private.
          </p>

          <div class="footer-section">
            <div>
              <div class="signature-box" style="margin-top: 60px;">
                Institutional Registrar Seal
              </div>
            </div>
            <div>
              <div class="signature-box" style="margin-top: 60px;">
                Educator Signature
              </div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="rep-loading">
        <LuSparkles className="rep-spin" />
        <p>Generating class report analytics...</p>
      </div>
    );
  }

  return (
    <div className="rep-container">
      {/* Dynamic Security Warning Alert */}
      {!user?.classCode && (
        <div className="class-code-warning-banner rep-alert-banner">
          <div className="warning-banner-icon">⚠️</div>
          <div className="warning-banner-body">
            <h4>Global Profile Data Loaded</h4>
            <p>You have not configured a specific Class Code. The report currently aggregates performance metrics globally for all registered student accounts.</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/profile')}>
            Set Class Code
          </button>
        </div>
      )}

      {/* Main Document View */}
      {!isPreviewMode ? (
        <div className="rep-main animate-fadeIn">
          {/* Header */}
          <div className="rep-header">
            <div>
              <button className="rep-back-btn" onClick={() => navigate('/educator-dashboard')}>
                <LuArrowLeft /> Back to Dashboard
              </button>
              <h1 className="rep-title">Class Analytics & Performance Report</h1>
              <p className="rep-sub">
                Professional evaluation matrix for Class <strong>{classCode || 'All Students'}</strong>
              </p>
            </div>
            <div className="rep-actions">
              <button className="btn btn-secondary rep-action-btn" onClick={() => setIsPreviewMode(true)}>
                <LuPresentation /> Present Report
              </button>
              <button className="btn btn-primary rep-action-btn" onClick={handleDownloadReportPdf}>
                <LuDownload /> Download PDF Report
              </button>
            </div>
          </div>

          {/* Institutional Stamp Banner */}
          <div className="rep-institution-card">
            <div className="rep-institution-icon">
              <LuGraduationCap />
            </div>
            <div className="rep-institution-info">
              <h3>{institution}</h3>
              <p>Department: {subjectsTaught} | Teacher: {user?.name}</p>
            </div>
            <div className="rep-meta-chips">
              <span className="rep-chip">
                <LuCalendar /> {new Date().toLocaleDateString()}
              </span>
              <span className="rep-chip">
                ID: INT-{Math.floor(1000 + Math.random() * 9000)}
              </span>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="rep-metrics-grid">
            <div className="rep-metric-card">
              <div className="rep-m-icon bg-blue"><LuUsers /></div>
              <div className="rep-m-info">
                <h3>{classData.totalStudents}</h3>
                <p>Enrolled Students</p>
              </div>
            </div>
            <div className="rep-metric-card">
              <div className="rep-m-icon bg-gold"><LuPercent /></div>
              <div className="rep-m-info">
                <h3>{classData.avgAccuracy}%</h3>
                <p>Average Accuracy</p>
              </div>
            </div>
            <div className="rep-metric-card">
              <div className="rep-m-icon bg-green"><LuActivity /></div>
              <div className="rep-m-info">
                <h3>{classData.highlyActiveCount}</h3>
                <p>Highly Active</p>
              </div>
            </div>
            <div className="rep-metric-card">
              <div className="rep-m-icon bg-red"><LuFileText /></div>
              <div className="rep-m-info">
                <h3>{classData.needsAttentionCount}</h3>
                <p>Needs Attention</p>
              </div>
            </div>
          </div>

          {/* Row 2: Toppers */}
          <div className="rep-toppers-section">
            <h2 className="rep-section-title">
              <LuTrophy /> Class Academic Toppers
            </h2>
            <div className="rep-toppers-grid">
              {classData.toppers.map((t, idx) => (
                <div key={t.id} className={`rep-topper-card rank-${idx + 1}`}>
                  <div className="rep-badge">
                    {idx === 0 ? '🏆 1st' : idx === 1 ? '🥈 2nd' : '🥉 3rd'}
                  </div>
                  <div className="rep-topper-avatar">🧑‍🎓</div>
                  <h3>{t.name}</h3>
                  <div className="rep-topper-score">{t.accuracy}% Accuracy</div>
                  <div className="rep-topper-quizzes">{t.quizzes} Quizzes Solved</div>
                </div>
              ))}
            </div>
          </div>

          {/* Row 3: Table grid */}
          <div className="rep-table-section">
            <h2 className="rep-section-title">
              <LuBookOpen /> Student Performance & Activeness Matrix
            </h2>
            <div className="rep-table-wrapper">
              <table className="rep-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Overall Accuracy</th>
                    <th>Total Quizzes</th>
                    <th>Activeness Status</th>
                  </tr>
                </thead>
                <tbody>
                  {classData.students.map((s, idx) => (
                    <tr key={s.id}>
                      <td className="rep-rank-cell">#{idx + 1}</td>
                      <td className="rep-name-cell">{s.name}</td>
                      <td>
                        <div className="rep-progress-bar-wrap">
                          <span className="rep-progress-text">{s.accuracy}%</span>
                          <div className="rep-progress-bar">
                            <div className="rep-progress-fill" style={{ width: `${s.accuracy}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="rep-quiz-cell">{s.quizzes}</td>
                      <td>
                        <span className={`rep-status-badge ${getStatusBadgeClass(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Fullscreen Presentation Mode */
        <div className="rep-presentation-view animate-fadeIn">
          {/* Top Panel */}
          <div className="rep-pres-top">
            <div className="rep-pres-meta">
              <span className="rep-pres-badge">Presentation Mode</span>
              <h2>{institution} - Class Performance Report</h2>
            </div>
            <button className="rep-exit-btn" onClick={() => setIsPreviewMode(false)}>
              <LuX /> Exit
            </button>
          </div>

          {/* Slides Content */}
          <div className="rep-slide-container">
            {currentSlide === 0 && (
              <div className="rep-slide animate-fadeIn">
                <div className="rep-slide-welcome">
                  <div className="slide-academic-icon">🏫</div>
                  <h1>Executive Performance Summary</h1>
                  <p className="slide-academic-sub">Class Code: {classCode || 'All Classes'} | Date: {new Date().toLocaleDateString()}</p>
                  
                  <div className="slide-stats-banner">
                    <div className="slide-stat-item">
                      <h2>{classData.totalStudents}</h2>
                      <p>Total Evaluated</p>
                    </div>
                    <div className="slide-stat-item divider">
                      <h2>{classData.avgAccuracy}%</h2>
                      <p>Class Avg Accuracy</p>
                    </div>
                    <div className="slide-stat-item">
                      <h2>{classData.highlyActiveCount}</h2>
                      <p>Highly Active</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentSlide === 1 && (
              <div className="rep-slide animate-fadeIn">
                <div className="slide-title-wrap">
                  <LuTrophy className="slide-icon gold" />
                  <h2>Class Academic Toppers</h2>
                </div>
                <div className="rep-toppers-grid pres-toppers">
                  {classData.toppers.map((t, idx) => (
                    <div key={t.id} className={`rep-topper-card rank-${idx + 1} pres-card`}>
                      <div className="rep-badge">Rank {idx + 1}</div>
                      <div className="rep-topper-avatar pres-avatar">
                        {idx === 0 ? '👑' : idx === 1 ? '🥈' : '🥉'}
                      </div>
                      <h3>{t.name}</h3>
                      <div className="rep-topper-score">{t.accuracy}% Accuracy</div>
                      <div className="rep-topper-quizzes">{t.quizzes} Assessments Completed</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentSlide === 2 && (
              <div className="rep-slide animate-fadeIn">
                <div className="slide-title-wrap">
                  <LuActivity className="slide-icon green" />
                  <h2>Activeness & Engagement Metrics</h2>
                </div>
                <div className="pres-engagement-grid">
                  <div className="pres-eng-card eng-highly">
                    <h3>Highly Active</h3>
                    <div className="pres-eng-num">{classData.highlyActiveCount}</div>
                    <p>Students exhibiting supreme engagement (&gt; 8 tests submitted with consistent high accuracy)</p>
                  </div>
                  <div className="pres-eng-card eng-consistent">
                    <h3>Consistent</h3>
                    <div className="pres-eng-num">{classData.averageActiveCount}</div>
                    <p>Students regularly solving quizzes and maintaining robust performance levels</p>
                  </div>
                  <div className="pres-eng-card eng-needs">
                    <h3>Needs Attention</h3>
                    <div className="pres-eng-num">{classData.needsAttentionCount}</div>
                    <p>Students requiring direct academic intervention due to low scores or inactivity</p>
                  </div>
                </div>
              </div>
            )}

            {currentSlide === 3 && (
              <div className="rep-slide animate-fadeIn">
                <div className="slide-title-wrap">
                  <LuBookOpen className="slide-icon blue" />
                  <h2>Detailed Score Performance Matrix</h2>
                </div>
                <div className="pres-table-wrap">
                  <table className="rep-table pres-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Student Name</th>
                        <th>Accuracy Ratio</th>
                        <th>Quizzes Completed</th>
                        <th>Standing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classData.students.slice(0, 5).map((s, idx) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 'bold', color: 'var(--accent)' }}>#{idx + 1}</td>
                          <td style={{ fontWeight: '600' }}>{s.name}</td>
                          <td>
                            <div className="rep-progress-bar-wrap">
                              <span className="rep-progress-text">{s.accuracy}%</span>
                              <div className="rep-progress-bar">
                                <div className="rep-progress-fill" style={{ width: `${s.accuracy}%` }}></div>
                              </div>
                            </div>
                          </td>
                          <td>{s.quizzes}</td>
                          <td>
                            <span className={`rep-status-badge ${getStatusBadgeClass(s.status)}`}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {classData.students.length > 5 && (
                    <p className="pres-more-hint">+ {classData.students.length - 5} more students recorded</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Panel controls */}
          <div className="rep-pres-bottom">
            <button
              className="pres-nav-btn"
              disabled={currentSlide === 0}
              onClick={() => setCurrentSlide(prev => prev - 1)}
            >
              <LuChevronLeft /> Previous
            </button>
            <div className="pres-indicator">
              Slide {currentSlide + 1} of 4
            </div>
            <button
              className="pres-nav-btn"
              disabled={currentSlide === 3}
              onClick={() => setCurrentSlide(prev => prev + 1)}
            >
              Next <LuChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
