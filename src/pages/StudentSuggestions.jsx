import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  aggregateStudentData,
  generateSuggestions,
  getYouTubeSearchEmbedUrl,
  youtubeSearchUrl,
  getCourseSearchUrl,
  getPlatformIcon,
} from '../services/suggestionService';
import LearningPathMermaid from '../components/LearningPathMermaid';
import {
  LuSparkles, LuLoader, LuBookOpen, LuPlay, LuMonitor,
  LuGitBranch, LuLightbulb, LuTarget, LuTrophy, LuChevronDown,
  LuExternalLink, LuCalendar, LuTriangleAlert, LuRocket,
  LuClock, LuFileText, LuZap, LuStar, LuGraduationCap,
} from 'react-icons/lu';
import './StudentSuggestions.css';

/* ── Accuracy ring SVG ── */
function AccuracyRing({ value, color }) {
  const r = 18, circ = 2 * Math.PI * r;
  const offset = circ - (circ * (value || 0)) / 100;
  return (
    <svg className="ss-accuracy-ring" viewBox="0 0 44 44">
      <circle className="ring-bg" cx="22" cy="22" r={r} />
      <circle className="ring-fill" cx="22" cy="22" r={r}
        stroke={color} strokeDasharray={circ} strokeDashoffset={offset} />
      <text x="22" y="26" textAnchor="middle" fill={color}
        fontSize="11" fontWeight="700">{value}%</text>
    </svg>
  );
}

/* ── Canvas Conclusion Video Generator ── */
function ConclusionVideo({ script }) {
  const canvasRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const animRef = useRef(null);

  const totalDuration = (script?.scenes || []).reduce((s, sc) => s + (sc.duration || 4), 0);

  const drawScene = useCallback((ctx, w, h, sceneIdx, sceneProgress) => {
    const scene = script?.scenes?.[sceneIdx];
    if (!scene) return;
    const total = script.scenes.length;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    const hue = 35 + sceneIdx * 20;
    grad.addColorStop(0, `hsl(${hue}, 30%, 6%)`);
    grad.addColorStop(1, `hsl(${hue + 40}, 25%, 10%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Animated particles
    for (let i = 0; i < 12; i++) {
      const px = (Math.sin(Date.now() * 0.001 + i * 1.8) * 0.4 + 0.5) * w;
      const py = (Math.cos(Date.now() * 0.0008 + i * 2.1) * 0.4 + 0.5) * h;
      ctx.beginPath();
      ctx.arc(px, py, 2 + Math.sin(Date.now() * 0.002 + i) * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201,168,76,${0.15 + Math.sin(Date.now() * 0.003 + i) * 0.1})`;
      ctx.fill();
    }

    // Scene counter
    ctx.fillStyle = 'rgba(201,168,76,0.7)';
    ctx.font = '600 14px Lato, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${sceneIdx + 1} / ${total}`, 30, 40);

    // Title
    ctx.fillStyle = '#c9a84c';
    ctx.font = '700 16px Lato, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(script.title || 'Study Summary', w / 2, 50);

    // Scene text with word wrap
    const alpha = Math.min(sceneProgress * 3, 1);
    ctx.fillStyle = `rgba(232,228,221,${alpha})`;
    ctx.font = '500 18px Lato, sans-serif';
    ctx.textAlign = 'center';

    const words = (scene.text || '').split(' ');
    const lines = []; let line = '';
    const maxW = w - 80;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line.trim());
        line = word + ' ';
      } else { line = test; }
    }
    if (line.trim()) lines.push(line.trim());

    const lineH = 28;
    const startY = h / 2 - (lines.length * lineH) / 2 + 10;
    lines.forEach((l, i) => ctx.fillText(l, w / 2, startY + i * lineH));

    // Progress bar
    const barY = h - 25, barW = w - 60;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(30, barY, barW, 4);
    const overallProg = (sceneIdx + sceneProgress) / total;
    ctx.fillStyle = '#c9a84c';
    ctx.fillRect(30, barY, barW * overallProg, 4);

    // IntelearnX branding
    ctx.fillStyle = 'rgba(201,168,76,0.4)';
    ctx.font = '600 11px Lato, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('IntelearnX AI', w - 20, h - 12);
  }, [script]);

  const playVideo = useCallback(() => {
    if (!canvasRef.current || !script?.scenes?.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    setPlaying(true);
    setProgress(0);
    let startTime = performance.now();
    const totalMs = totalDuration * 1000;

    const animate = (now) => {
      const elapsed = now - startTime;
      const pct = Math.min(elapsed / totalMs, 1);
      setProgress(pct * 100);

      // Find current scene
      let accum = 0, sceneIdx = 0, sceneProg = 0;
      for (let i = 0; i < script.scenes.length; i++) {
        const dur = (script.scenes[i].duration || 4) * 1000;
        if (elapsed < accum + dur) {
          sceneIdx = i;
          sceneProg = (elapsed - accum) / dur;
          break;
        }
        accum += dur;
        if (i === script.scenes.length - 1) {
          sceneIdx = i; sceneProg = 1;
        }
      }

      drawScene(ctx, w, h, sceneIdx, sceneProg);

      if (pct < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setPlaying(false);
      }
    };
    animRef.current = requestAnimationFrame(animate);
  }, [script, totalDuration, drawScene]);

  useEffect(() => {
    // Draw initial frame
    if (canvasRef.current && script?.scenes?.length) {
      const ctx = canvasRef.current.getContext('2d');
      drawScene(ctx, canvasRef.current.width, canvasRef.current.height, 0, 0);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [script, drawScene]);

  if (!script?.scenes?.length) return null;

  return (
    <div className="ss-conclusion-section">
      <div className="ss-conclusion-card">
        <h2><LuMonitor /> AI-Generated Conclusion Video</h2>
        <p className="ss-conclusion-sub">
          A personalized video summary generated from your performance analysis
        </p>
        <div className="ss-video-canvas-wrap">
          <canvas ref={canvasRef} className="ss-video-canvas"
            width={720} height={405} />
        </div>
        <div className="ss-video-progress" style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="ss-video-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="ss-video-controls">
          <button className="ss-video-play-btn" onClick={playVideo} disabled={playing}>
            {playing ? <><LuLoader className="pq-spin" /> Playing...</>
              : <><LuPlay /> Play Summary Video</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Suggestion Card ── */
function SuggestionCard({ item, isNew }) {
  const [expanded, setExpanded] = useState(false);
  const [activeFormat, setActiveFormat] = useState('notes');

  const accuracy = item.currentAccuracy ?? 0;
  const accColor = accuracy < 40 ? '#D4645C' : accuracy < 65 ? '#E0A546' : '#4CAF82';
  const severityClass = item.severity === 'critical' ? 'critical' : item.severity === 'moderate' ? 'moderate' : 'minor';

  return (
    <div className="ss-card">
      <div className="ss-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="ss-card-header-left">
          {!isNew && <AccuracyRing value={accuracy} color={accColor} />}
          {isNew && (
            <div style={{ width: 44, height: 44, borderRadius: 'var(--r-lg)',
              background: 'rgba(76,175,130,0.12)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#4CAF82' }}>
              <LuRocket />
            </div>
          )}
          <div>
            <h3>{item.topic}</h3>
            <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center', marginTop: 4 }}>
              {!isNew && (
                <span className={`ss-severity-badge ss-severity-badge--${severityClass}`}>
                  {item.severity}
                </span>
              )}
              {isNew && <span className="ss-severity-badge ss-severity-badge--minor">New Topic</span>}
              {!isNew && item.targetAccuracy && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Target: {item.targetAccuracy}%
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
          {!isNew && (
            <div className={`ss-card-accuracy ss-card-accuracy--${accuracy < 40 ? 'low' : accuracy < 65 ? 'mid' : 'high'}`}>
              {accuracy}%
            </div>
          )}
          <span className={`ss-card-toggle ${expanded ? 'open' : ''}`}><LuChevronDown /></span>
        </div>
      </div>

      {expanded && (
        <div className="ss-card-body">
          {isNew && item.reason && (
            <p className="ss-new-topic-reason">💡 {item.reason}</p>
          )}

          {/* Format Tabs */}
          <div className="ss-format-tabs">
            <button className={`ss-format-tab ${activeFormat === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveFormat('notes')}>
              <LuFileText /> Notes
            </button>
            <button className={`ss-format-tab ${activeFormat === 'video' ? 'active' : ''}`}
              onClick={() => setActiveFormat('video')}>
              <LuPlay /> Video
            </button>
            <button className={`ss-format-tab ${activeFormat === 'diagram' ? 'active' : ''}`}
              onClick={() => setActiveFormat('diagram')}>
              <LuGitBranch /> Diagram
            </button>
            <button className={`ss-format-tab ${activeFormat === 'courses' ? 'active' : ''}`}
              onClick={() => setActiveFormat('courses')}>
              <LuGraduationCap /> Courses
            </button>
          </div>

          {/* Notes */}
          {activeFormat === 'notes' && item.notesSuggestion && (
            <div className="ss-notes">
              <div className="ss-notes-title"><LuBookOpen /> {item.notesSuggestion.title}</div>
              <ul className="ss-key-points">
                {(item.notesSuggestion.keyPoints || []).map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
              {item.notesSuggestion.quickTip && (
                <div className="ss-quick-tip">
                  <LuLightbulb />
                  <p><strong>Quick Tip:</strong> {item.notesSuggestion.quickTip}</p>
                </div>
              )}
              {item.notesSuggestion.commonMistakes?.length > 0 && (
                <div className="ss-mistakes">
                  <h5><LuTriangleAlert /> Common Mistakes</h5>
                  <ul>{item.notesSuggestion.commonMistakes.map((m, i) => <li key={i}>{m}</li>)}</ul>
                </div>
              )}
              {item.notesSuggestion.practiceStrategy && (
                <div className="ss-practice-strategy">
                  <strong>📋 Strategy:</strong> {item.notesSuggestion.practiceStrategy}
                </div>
              )}
            </div>
          )}

          {/* Video */}
          {activeFormat === 'video' && item.videoSuggestion && (
            <div className="ss-video-section">
              <div className="ss-video-section-title"><LuPlay /> {item.videoSuggestion.videoTitle}</div>

              {/* Embedded YouTube player with search query */}
              <div className="ss-video-embed-wrap">
                <iframe
                  src={getYouTubeSearchEmbedUrl(item.videoSuggestion.youtubeSearchQuery)}
                  title={item.videoSuggestion.videoTitle}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              <div className="ss-video-meta">
                {item.videoSuggestion.watchDuration && (
                  <span className="ss-video-meta-item">
                    <LuClock /> {item.videoSuggestion.watchDuration}
                  </span>
                )}
                <span className="ss-video-meta-item">
                  <LuLightbulb /> {item.videoSuggestion.whyWatch}
                </span>
              </div>

              <div style={{ marginTop: 'var(--s3)' }}>
                <a href={youtubeSearchUrl(item.videoSuggestion.youtubeSearchQuery)}
                  target="_blank" rel="noopener noreferrer" className="ss-yt-search-link">
                  <LuExternalLink /> Browse more videos on YouTube
                </a>
              </div>
            </div>
          )}

          {/* Diagram */}
          {activeFormat === 'diagram' && item.diagramSuggestion && (
            <div className="ss-diagram-section">
              <div className="ss-diagram-title"><LuGitBranch /> {item.diagramSuggestion.title}</div>
              <div className="ss-diagram-wrap">
                <LearningPathMermaid code={item.diagramSuggestion.mermaidCode} />
              </div>
              {item.diagramSuggestion.description && (
                <p className="ss-diagram-desc">{item.diagramSuggestion.description}</p>
              )}
            </div>
          )}

          {/* Courses */}
          {activeFormat === 'courses' && (
            <div className="ss-courses-section">
              <div className="ss-courses-title"><LuGraduationCap /> Recommended Courses</div>
              <div className="ss-courses-grid">
                {(item.courseSuggestions || []).map((course, ci) => (
                  <a key={ci}
                    href={getCourseSearchUrl(course.platform, course.searchQuery)}
                    target="_blank" rel="noopener noreferrer"
                    className="ss-course-card">
                    <div className="ss-course-card-header">
                      <span className="ss-course-platform-icon">{getPlatformIcon(course.platform)}</span>
                      <span className="ss-course-platform-name">{course.platform}</span>
                      {course.isFree && <span className="ss-course-free-badge">Free</span>}
                      {!course.isFree && <span className="ss-course-paid-badge">Paid</span>}
                    </div>
                    <h4 className="ss-course-title">{course.title}</h4>
                    {course.instructor && (
                      <p className="ss-course-instructor">{course.instructor}</p>
                    )}
                    <p className="ss-course-why">{course.why}</p>
                    <div className="ss-course-footer">
                      <span className={`ss-course-level ss-course-level--${(course.level || 'beginner').toLowerCase()}`}>
                        {course.level}
                      </span>
                      <span className="ss-course-link-label">
                        Open on {course.platform} <LuExternalLink />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
              {(!item.courseSuggestions || item.courseSuggestions.length === 0) && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 'var(--s6)' }}>
                  No specific courses recommended for this topic yet.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function StudentSuggestions() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user?.id) return;
      setLoading(true);
      try {
        const data = await aggregateStudentData(user.id);
        const result = await generateSuggestions(data);
        if (!cancelled) setSuggestions(result);
      } catch (e) {
        console.error('Suggestion load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const t = setTimeout(load, 300);
    return () => { clearTimeout(t); cancelled = true; };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="ss-page ss-loading animate-fadeIn">
        <LuLoader className="pq-spin" />
        <p>Analyzing your performance across all modules...</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Reviewing quizzes, gamification, and learning path data
        </p>
      </div>
    );
  }

  if (!suggestions) {
    return (
      <div className="ss-page ss-loading animate-fadeIn">
        <LuTarget style={{ fontSize: '2.5rem', color: 'var(--accent)' }} />
        <p>Complete some quizzes to unlock personalized suggestions!</p>
      </div>
    );
  }

  const improvements = suggestions.improvementAreas || [];
  const newTopics = suggestions.newTopicSuggestions || [];

  const filteredImprovements = activeTab === 'all' ? improvements
    : activeTab === 'critical' ? improvements.filter(i => i.severity === 'critical')
    : activeTab === 'moderate' ? improvements.filter(i => i.severity === 'moderate')
    : improvements.filter(i => i.severity === 'minor');

  return (
    <div className="ss-page animate-fadeIn">
      {/* Hero */}
      <section className="ss-hero">
        <p className="ss-hero-eyebrow"><LuSparkles /> AI-Powered Study Suggestions</p>
        <h1>Your Personalized Improvement Plan</h1>
        <p className="ss-hero-sub">
          Analyzed from your onboarding quizzes, PDF quizzes, teacher quizzes, library quizzes,
          gamification data, and learning path — here are tailored suggestions to help you grow.
        </p>
      </section>

      {/* Analysis Banner */}
      <div className="ss-analysis-banner">
        <div className="ss-analysis-text">
          <h3><LuTarget /> Overall Analysis</h3>
          <p>{suggestions.overallAnalysis}</p>
          {suggestions.strengthSummary && (
            <p style={{ marginTop: 'var(--s2)', color: '#4CAF82' }}>
              <LuTrophy style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {suggestions.strengthSummary}
            </p>
          )}
        </div>
        {suggestions.gamificationInsight && (
          <div className="ss-gamification-insight">
            <LuZap />
            <p>{suggestions.gamificationInsight}</p>
          </div>
        )}
      </div>

      {/* Severity Filter Tabs */}
      <div className="ss-tabs">
        {[
          { id: 'all', label: 'All Suggestions', icon: <LuSparkles /> },
          { id: 'critical', label: 'Critical', icon: <LuTriangleAlert /> },
          { id: 'moderate', label: 'Moderate', icon: <LuTarget /> },
          { id: 'minor', label: 'Minor', icon: <LuStar /> },
        ].map(tab => (
          <button key={tab.id}
            className={`ss-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}>
            {tab.icon} {tab.label}
            {tab.id !== 'all' && (
              <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                ({improvements.filter(i => tab.id === 'all' || i.severity === tab.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Improvement Areas */}
      <div className="ss-section-header">
        <h2><LuTarget /> Weak Topics to Improve</h2>
      </div>

      <div className="ss-cards-grid">
        {filteredImprovements.length > 0 ? (
          filteredImprovements.map((item, idx) => (
            <SuggestionCard key={`imp-${idx}`} item={item} isNew={false} />
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: 'var(--s8)', color: 'var(--text-muted)' }}>
            {activeTab !== 'all'
              ? `No ${activeTab} severity items found.`
              : 'Great job! No weak areas detected.'}
          </div>
        )}
      </div>

      {/* New Topics */}
      {newTopics.length > 0 && (
        <>
          <div className="ss-new-topics-header">
            <h2><LuRocket /> Recommended New Topics</h2>
          </div>
          <div className="ss-cards-grid">
            {newTopics.map((item, idx) => (
              <SuggestionCard key={`new-${idx}`} item={item} isNew={true} />
            ))}
          </div>
        </>
      )}

      {/* Weekly Plan */}
      {suggestions.weeklyPlan && (
        <div className="ss-weekly-plan">
          <h3><LuCalendar /> Weekly Study Plan</h3>
          <p>{suggestions.weeklyPlan.summary}</p>
          <div className="ss-plan-grid">
            {(suggestions.weeklyPlan.days || []).map((d, i) => (
              <div key={i} className="ss-plan-day">
                <strong>{d.day}</strong>
                <p>{d.focus}</p>
                <span>{d.duration}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Conclusion Video */}
      <ConclusionVideo script={suggestions.conclusionVideoScript} />

      {/* Source badge */}
      <div style={{ textAlign: 'center', marginTop: 'var(--s6)', marginBottom: 'var(--s4)' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {suggestions.source === 'gemini'
            ? '✨ Suggestions personalized with Gemini AI'
            : '📊 Suggestions generated from your quiz data'}
        </span>
      </div>
    </div>
  );
}
