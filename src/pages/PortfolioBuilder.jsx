import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPerformanceData, getUserBadges } from '../services/storageService';
import { badgeDefinitions } from '../data/quizData';
import {
  LuLayoutDashboard, LuPlus, LuTrash2, LuUpload, LuLink,
  LuGithub, LuGlobe, LuMail, LuPhone, LuMapPin,
  LuTrophy, LuTarget, LuZap, LuFlame, LuStar,
  LuCode, LuBriefcase, LuGraduationCap, LuAward,
  LuExternalLink, LuCheck, LuLoader, LuEye,
  LuSparkles, LuDownload, LuShare2, LuX, LuPalette,
  LuActivity, LuArrowRight
} from 'react-icons/lu';
import './PortfolioBuilder.css';

/* ── Form Field Helper ── */
function Field({ label, value, onChange, placeholder, multiline, type = 'text' }) {
  return (
    <div className="pf-field">
      <label className="pf-label">{label}</label>
      {multiline
        ? <textarea className="pf-input pf-textarea" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} />
        : <input className="pf-input" type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      }
    </div>
  );
}

/* ── Section Container Helper ── */
function Section({ title, icon, children, accent }) {
  return (
    <div className="pfb-section" style={{ '--sa': accent || 'var(--accent)' }}>
      <div className="pfb-section-head">
        <span className="pfb-section-icon">{icon}</span>
        <h3 className="pfb-section-title">{title}</h3>
      </div>
      <div className="pfb-section-body">{children}</div>
    </div>
  );
}

/* ── Premium Live Portfolio Preview Showcase ── */
function PortfolioPreview({ data, perf, badges, earnedIds, theme, onPrint, onFullscreen }) {
  const strongSubjects = Object.entries(perf?.subjectAccuracy || {})
    .filter(([, v]) => v.total > 0)
    .map(([s, v]) => ({ subject: s, accuracy: Math.round((v.correct / v.total) * 100) }))
    .sort((a, b) => b.accuracy - a.accuracy);

  const earnedBadges = (earnedIds || [])
    .map(id => badgeDefinitions.find(b => b.id === id))
    .filter(Boolean);

  // Return the main preview body styled with the theme class
  return (
    <div className={`pfp-root pfp-theme-${theme}`}>
      {/* Dynamic Theme Banner / Accent Bar */}
      <div className="pfp-banner-accent" />

      {/* Modern Split Sidebar Desktop Layout */}
      <div className="pfp-container-layout">
        
        {/* Profile Sidebar */}
        <aside className="pfp-sidebar">
          <div className="pfp-sticky-side">
            <div className="pfp-avatar">{(data.name || 'S').charAt(0)}</div>
            <h1 className="pfp-name">{data.name || 'Your Name'}</h1>
            <p className="pfp-tagline">{data.tagline || 'Software Developer · Lifelong Learner'}</p>

            {/* Profile Contacts */}
            <div className="pfp-contact-box">
              {data.email && (
                <a href={`mailto:${data.email}`} className="pfp-contact-link">
                  <LuMail className="pfp-contact-icon" />
                  <span className="pfp-contact-text">{data.email}</span>
                </a>
              )}
              {data.phone && (
                <div className="pfp-contact-link">
                  <LuPhone className="pfp-contact-icon" />
                  <span className="pfp-contact-text">{data.phone}</span>
                </div>
              )}
              {data.location && (
                <div className="pfp-contact-link">
                  <LuMapPin className="pfp-contact-icon" />
                  <span className="pfp-contact-text">{data.location}</span>
                </div>
              )}
            </div>

            {/* Profile Action Social Icons */}
            <div className="pfp-social-links">
              {data.github && <a href={data.github} target="_blank" rel="noreferrer" title="GitHub" className="pfp-social-btn"><LuGithub /></a>}
              {data.linkedin && <a href={data.linkedin} target="_blank" rel="noreferrer" title="LinkedIn" className="pfp-social-btn"><LuLink /></a>}
              {data.website && <a href={data.website} target="_blank" rel="noreferrer" title="Personal Website" className="pfp-social-btn"><LuGlobe /></a>}
            </div>

            {/* Glowing IntelearnX Live Stats Panel */}
            {perf && perf.totalQuizzes > 0 && (
              <div className="pfp-stats-card-premium">
                <div className="pfp-stats-card-header">
                  <LuActivity className="pfp-activity-glow" />
                  <span>IntelearnX Learning Stats</span>
                </div>
                <div className="pfp-side-stats-grid">
                  <div className="pfp-side-stat-item">
                    <span className="val" style={{ color: 'var(--success)' }}>{perf.overallAccuracy}%</span>
                    <span className="lbl">Accuracy</span>
                  </div>
                  <div className="pfp-side-stat-item">
                    <span className="val" style={{ color: 'var(--info)' }}>{perf.totalQuizzes}</span>
                    <span className="lbl">Quizzes</span>
                  </div>
                  <div className="pfp-side-stat-item">
                    <span className="val" style={{ color: '#fbbf24' }}>{data.xp || 0}</span>
                    <span className="lbl">XP Earned</span>
                  </div>
                  <div className="pfp-side-stat-item">
                    <span className="val" style={{ color: '#f87171' }}>{data.loginStreak || 0}d</span>
                    <span className="lbl">Streak</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Content Panel */}
        <main className="pfp-content-panel">
          {/* About Me Section */}
          {data.about && (
            <section className="pfp-section-block">
              <h2 className="pfp-sec-title">About Me</h2>
              <p className="pfp-about-text">{data.about}</p>
            </section>
          )}

          {/* Technical Skills Block */}
          {data.skills?.length > 0 && (
            <section className="pfp-section-block">
              <h2 className="pfp-sec-title">Core Skills</h2>
              <div className="pfp-skills-cloud">
                {data.skills.map((s, i) => s && <span key={i} className="pfp-skill-tag">{s}</span>)}
              </div>
            </section>
          )}

          {/* Dynamic Subject Accuracy Proficiency */}
          {strongSubjects.length > 0 && (
            <section className="pfp-section-block">
              <h2 className="pfp-sec-title">Subject Proficiencies</h2>
              <div className="pfp-proficiencies-list">
                {strongSubjects.map((s, i) => (
                  <div key={i} className="pfp-prof-bar-row">
                    <div className="pfp-prof-label-wrap">
                      <span className="name">{s.subject}</span>
                      <span className="pct">{s.accuracy}%</span>
                    </div>
                    <div className="pfp-prof-track">
                      <div 
                        className="pfp-prof-thumb" 
                        style={{ 
                          width: `${s.accuracy}%`,
                          background: `linear-gradient(90deg, var(--pfp-accent) 0%, rgba(201, 168, 76, 0.85) 100%)` 
                        }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Industry Grade Projects Showcase */}
          {data.projects?.length > 0 && (
            <section className="pfp-section-block">
              <h2 className="pfp-sec-title">Highlighted Projects</h2>
              <div className="pfp-projects-stack">
                {data.projects.map((p, i) => (
                  <div key={i} className="pfp-project-card-premium">
                    <div className="pfp-project-card-top">
                      <h3>{p.name || 'Untitled Enterprise Project'}</h3>
                      <div className="pfp-project-actions">
                        {p.github && <a href={p.github} target="_blank" rel="noreferrer" title="GitHub Source" className="pfp-proj-link"><LuGithub /></a>}
                        {p.link && <a href={p.link} target="_blank" rel="noreferrer" title="Live Preview" className="pfp-proj-link"><LuExternalLink /></a>}
                      </div>
                    </div>
                    {p.tech && <div className="pfp-project-tech-chips">{p.tech}</div>}
                    {p.description && <p className="pfp-project-card-desc">{p.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Academic / Industrial Certifications */}
          {data.certifications?.length > 0 && (
            <section className="pfp-section-block">
              <h2 className="pfp-sec-title">Professional Credentials</h2>
              <div className="pfp-certs-column">
                {data.certifications.map((c, i) => (
                  <div key={i} className="pfp-cert-row-premium">
                    <div className="pfp-cert-medal">
                      <LuAward />
                    </div>
                    <div className="pfp-cert-details">
                      <h4>{c.name || 'Professional Certification'}</h4>
                      <span className="issuer">{c.issuer}{c.year ? ` · Issued ${c.year}` : ''}</span>
                      {c.link && (
                        <a href={c.link} target="_blank" rel="noreferrer" className="pfp-cert-verify-link">
                          Verify Credential <LuExternalLink />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Gamified Achievement Badges */}
          {earnedBadges.length > 0 && (
            <section className="pfp-section-block">
              <h2 className="pfp-sec-title">Earned Subject Milestones</h2>
              <div className="pfp-badge-grid-premium">
                {earnedBadges.map(b => (
                  <div key={b.id} className="pfp-badge-bubble" title={b.description}>
                    <span className="icon">{b.icon}</span>
                    <span className="name">{b.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Education timeline */}
          {data.education?.length > 0 && (
            <section className="pfp-section-block">
              <h2 className="pfp-sec-title">Education</h2>
              <div className="pfp-timeline">
                {data.education.map((e, i) => (
                  <div key={i} className="pfp-timeline-node">
                    <div className="pfp-timeline-marker">
                      <LuGraduationCap />
                    </div>
                    <div className="pfp-timeline-info">
                      <h4>{e.degree}</h4>
                      <span className="institution">{e.institution}</span>
                      <div className="meta">
                        <span className="year">{e.year}</span>
                        {e.gpa && <span className="divider">·</span>}
                        {e.gpa && <span className="gpa">GPA {e.gpa}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Experience timeline */}
          {data.experience?.length > 0 && (
            <section className="pfp-section-block">
              <h2 className="pfp-sec-title">Professional Experience</h2>
              <div className="pfp-timeline">
                {data.experience.map((e, i) => (
                  <div key={i} className="pfp-timeline-node">
                    <div className="pfp-timeline-marker">
                      <LuBriefcase />
                    </div>
                    <div className="pfp-timeline-info">
                      <h4>{e.role}</h4>
                      <span className="company">{e.company}</span>
                      <div className="meta">
                        <span className="duration">{e.duration}</span>
                        {e.location && <span className="divider">·</span>}
                        {e.location && <span className="loc">{e.location}</span>}
                      </div>
                      {e.description && <p className="desc">{e.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default function PortfolioBuilder() {
  const { user } = useAuth();
  const [perf, setPerf] = useState(null);
  const [earnedIds, setEarnedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [saved, setSaved] = useState(false);
  const [theme, setTheme] = useState('executive');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  const previewFrameRef = useRef(null);

  const [data, setData] = useState({
    name: '', tagline: '', email: '', phone: '', location: '',
    github: '', linkedin: '', website: '', about: '',
    skills: [], projects: [], certifications: [],
    education: [], experience: [],
    xp: 0, loginStreak: 0,
  });

  useEffect(() => {
    if (!user?.id) return;
    async function load() {
      try {
        const [p, ids] = await Promise.all([getPerformanceData(user.id), getUserBadges(user.id)]);
        setPerf(p);
        setEarnedIds(ids || []);
        // Pre-fill from user profile
        setData(d => ({
          ...d,
          name: user.name || '',
          email: user.email || '',
          tagline: user.selectedSubject ? `${user.selectedSubject} Specialist · IntelearnX Level ${user.level || 1}` : 'Software Engineer | Lifelong Learner',
          xp: user.xp || 0,
          loginStreak: user.loginStreak || 0,
          skills: user.studyKeywords
            ? user.studyKeywords.split(/[,;]+/).map(s => s.trim()).filter(Boolean).slice(0, 10)
            : [],
        }));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [user?.id]);

  const update = (key, val) => setData(d => ({ ...d, [key]: val }));
  const updateArr = (key, idx, field, val) => setData(d => {
    const arr = [...(d[key] || [])];
    arr[idx] = { ...arr[idx], [field]: val };
    return { ...d, [key]: arr };
  });
  const addItem = (key, blank) => setData(d => ({ ...d, [key]: [...(d[key] || []), blank] }));
  const removeItem = (key, idx) => setData(d => ({ ...d, [key]: (d[key] || []).filter((_, i) => i !== idx) }));

  /* ── One-Click AI Portfolio Boost Engine ── */
  const handleBoost = () => {
    setData(prev => {
      // 1. Tagline boost
      let boostedTagline = prev.tagline;
      if (!prev.tagline || prev.tagline.toLowerCase().includes('specialist') || prev.tagline.toLowerCase().includes('student')) {
        boostedTagline = `${user?.selectedSubject || 'Computer Science'} Systems Architect | Specialized in Full-Stack Implementations & Algorithmic Computations`;
      }

      // 2. About Me boost
      let boostedAbout = prev.about;
      if (!prev.about || prev.about.length < 30) {
        boostedAbout = `Analytical and achievement-driven Developer specializing in scalable application structures and low-level algorithmic optimizations. Leverages a background in IntelearnX curriculum topics to engineer clean, modular interfaces. Experienced in deploying responsive client applications, RESTful services, and localized data caching mechanisms.`;
      }

      // 3. Projects boost
      const boostedProjects = (prev.projects || []).map(p => {
        let name = p.name || "Enterprise Automation Engine";
        let tech = p.tech || "React, Node.js, Express, SQL, Redux State Containers";
        let desc = p.description || "Designed and implemented a high-performance web platform utilizing microservice architectures. Spearheaded state container restructuring to optimize frontend reactivity, reducing interface rendering delay by 35% and increasing overall core application load velocity.";
        
        if (p.description && p.description.length > 5) {
          if (!p.description.includes('%') && !p.description.match(/(Engineered|Spearheaded|Optimized|Architected)/)) {
            desc = `Engineered and architected the full-lifecycle implementation of ${p.name}. Optimized system SQL database query cycles to improve retrieval performance by 40%, integrated modular React layouts, and established robust API protocols to safeguard information layers.`;
          }
        }
        return { ...p, name, tech, description: desc };
      });

      // If no projects exist, add a gorgeous prefilled demo
      if (boostedProjects.length === 0) {
        boostedProjects.push({
          name: "IntelearnX Learner Core",
          tech: "React, LocalStorage APIs, Glassmorphic CSS Engine, Algorithmic Scoring Systems",
          link: "https://intelearnx.dev",
          github: "https://github.com/intelearnx/core",
          description: "Architected a state-of-the-art interactive student learning portal. Built real-time ATS scoring widgets, modular styling wrappers, and persistent local state synchronization systems sustaining 100% data fidelity across offline sessions."
        });
      }

      // 4. Skills boost
      let boostedSkills = [...(prev.skills || [])];
      const industryKeywords = ["Data Structures", "Algorithms", "System Architecture", "RESTful APIs", "React & Redux", "TypeScript", "CI/CD Pipelines", "Git Automation", "SQL & NoSQL", "CSS Variables"];
      industryKeywords.forEach(keyword => {
        if (!boostedSkills.some(s => s.toLowerCase() === keyword.toLowerCase())) {
          boostedSkills.push(keyword);
        }
      });
      boostedSkills = boostedSkills.filter(Boolean).slice(0, 10);

      // 5. Experience boost
      const boostedExperience = (prev.experience || []).map(exp => {
        let desc = exp.description || "Spearheaded design and validation patterns for student metrics platforms. Optimized client-facing page latency by 28% and collaborated on core architectural enhancements.";
        if (exp.description && exp.description.length > 5) {
          if (!exp.description.includes('%')) {
            desc = `Spearheaded software modularization and functional component design at ${exp.company || 'IntelearnX Internships'}. Restructured layout trees to decrease overall client-facing latency by 28% and integrated test pipelines.`;
          }
        }
        return { ...exp, description: desc };
      });

      return {
        ...prev,
        tagline: boostedTagline,
        about: boostedAbout,
        projects: boostedProjects,
        skills: boostedSkills,
        experience: boostedExperience
      };
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handlePrint = () => {
    // Print the isolated preview pane
    const content = previewFrameRef.current?.innerHTML;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>${data.name || 'Student'} - Portfolio</title>
          <style>
            /* Base reset */
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: system-ui, -apple-system, sans-serif; background: white; color: black; padding: 0.4in; }
            
            /* High fidelity print structures */
            .pfp-root { max-width: 800px; margin: 0 auto; color: #1a1a1a; }
            .pfp-banner-accent { display: none; }
            .pfp-avatar { width: 60px; height: 60px; border-radius: 50%; border: 2px solid black; font-size: 1.8rem; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
            .pfp-name { font-size: 22pt; font-weight: 700; color: black; margin-bottom: 2pt; }
            .pfp-tagline { font-size: 11pt; color: #333; margin-bottom: 10pt; font-style: italic; }
            .pfp-contact-box { margin-bottom: 10pt; font-size: 9.5pt; display: flex; flex-wrap: wrap; gap: 12px; }
            .pfp-contact-link { text-decoration: none; color: black; font-weight: 500; }
            .pfp-social-links { display: none; }
            
            .pfp-stats-card-premium { border: 1px solid #ccc; padding: 10px; border-radius: 8px; margin-bottom: 15pt; }
            .pfp-stats-card-header { font-weight: 700; text-transform: uppercase; font-size: 8.5pt; margin-bottom: 6px; }
            .pfp-side-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); text-align: center; }
            .pfp-side-stat-item .val { font-size: 13pt; font-weight: 700; display: block; }
            .pfp-side-stat-item .lbl { font-size: 7.5pt; text-transform: uppercase; color: #555; }
            
            .pfp-section-block { margin-bottom: 15pt; page-break-inside: avoid; }
            .pfp-sec-title { font-size: 11pt; font-weight: 750; text-transform: uppercase; color: black; border-bottom: 1.5px solid black; padding-bottom: 2px; margin-bottom: 8pt; letter-spacing: 0.5px; }
            .pfp-about-text { font-size: 9.5pt; line-height: 1.45; text-align: justify; color: #222; }
            
            .pfp-skills-cloud { display: flex; flex-wrap: wrap; gap: 6px; }
            .pfp-skill-tag { font-size: 8.5pt; padding: 3px 8px; border: 1px solid #777; border-radius: 4px; font-weight: 550; }
            
            .pfp-proficiencies-list { display: flex; flex-direction: column; gap: 6px; }
            .pfp-prof-bar-row { display: flex; flex-direction: column; gap: 2px; }
            .pfp-prof-label-wrap { display: flex; justify-content: space-between; font-size: 9pt; font-weight: 600; }
            .pfp-prof-track { width: 100%; height: 5px; background: #eee; border-radius: 3px; overflow: hidden; border: 0.5px solid #bbb; }
            .pfp-prof-thumb { height: 100%; background: #333 !important; }
            
            .pfp-projects-stack { display: flex; flex-direction: column; gap: 10pt; }
            .pfp-project-card-premium { border-bottom: 0.5px solid #ddd; padding-bottom: 8pt; }
            .pfp-project-card-premium:last-child { border-bottom: none; }
            .pfp-project-card-top h3 { font-size: 10.5pt; font-weight: 700; color: black; }
            .pfp-project-actions { display: none; }
            .pfp-project-tech-chips { font-size: 8pt; color: #555; font-style: italic; margin-bottom: 4px; }
            .pfp-project-card-desc { font-size: 9pt; color: #333; line-height: 1.4; text-align: justify; }
            
            .pfp-certs-column { display: flex; flex-direction: column; gap: 6px; }
            .pfp-cert-row-premium { display: flex; gap: 8px; align-items: center; }
            .pfp-cert-medal { display: none; }
            .pfp-cert-details h4 { font-size: 9.5pt; font-weight: 700; color: black; }
            .pfp-cert-details .issuer { font-size: 8.5pt; color: #444; }
            .pfp-cert-verify-link { display: none; }
            
            .pfp-badge-grid-premium { display: flex; flex-wrap: wrap; gap: 6px; }
            .pfp-badge-bubble { font-size: 8.5pt; padding: 3px 8px; border: 1px dashed #666; border-radius: 4px; display: flex; align-items: center; gap: 4px; }
            
            .pfp-timeline { display: flex; flex-direction: column; gap: 8pt; }
            .pfp-timeline-node { display: flex; gap: 10px; }
            .pfp-timeline-marker { display: none; }
            .pfp-timeline-info h4 { font-size: 10pt; font-weight: 700; }
            .pfp-timeline-info .company, .pfp-timeline-info .institution { font-size: 9pt; font-weight: 600; color: #333; display: block; }
            .pfp-timeline-info .meta { font-size: 8.5pt; color: #555; margin-bottom: 2px; }
            .pfp-timeline-info .desc { font-size: 9pt; color: #333; text-align: justify; line-height: 1.35; margin-top: 2px; }
            
            @media print {
              body { padding: 0.3in; background: white; }
              @page { size: A4 portrait; margin: 0.4in; }
              .pfp-sticky-side { position: relative; top: 0; }
              .pfp-container-layout { display: flex; flex-direction: column; gap: 15pt; }
              .pfp-sidebar { width: 100%; border: none; padding: 0; margin-bottom: 10pt; }
              .pfp-content-panel { width: 100%; }
            }
          </style>
        </head>
        <body>
          <div class="pfp-root pfp-theme-${theme}">
            ${content}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://intelearnx.dev/portfolio/showcase/${user?.id || 'demo'}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const TABS = [
    { id: 'info',     label: 'Basic Info',      icon: <LuLayoutDashboard /> },
    { id: 'skills',   label: 'Skills & Tech',   icon: <LuCode /> },
    { id: 'projects', label: 'Projects Stack',  icon: <LuBriefcase /> },
    { id: 'certs',    label: 'Credentials',     icon: <LuAward /> },
    { id: 'edu',      label: 'Education',       icon: <LuGraduationCap /> },
    { id: 'exp',      label: 'Experience',      icon: <LuBriefcase /> },
    { id: 'preview',  label: 'Live Preview',    icon: <LuEye /> },
  ];

  if (loading) return (
    <div className="pfb-loading">
      <LuLoader className="pq-spin" style={{ fontSize: '2rem', color: 'var(--accent)' }} />
      <p>Loading your portfolio details…</p>
    </div>
  );

  return (
    <div className="pfb-page animate-fadeIn">
      {/* Header Panel */}
      <div className="pfb-page-header">
        <div className="pfb-page-header-icon"><LuLayoutDashboard /></div>
        <div className="pfb-title-block">
          <h1>Student Portfolio Builder</h1>
          <p>Design a stunning developer-grade showcase linked to your active quiz achievements</p>
        </div>
        
        <div className="pfb-global-actions">
          {/* Smart Boost Button */}
          <button 
            type="button" 
            className="btn btn-secondary pfb-boost-btn"
            onClick={handleBoost}
            title="Automatically rewrite summaries and projects with industry verbs and metrics"
          >
            <LuSparkles className="pfb-boost-icon-glow" /> One-Click ATS Boost
          </button>
          
          <button className={`btn ${saved ? 'btn-secondary' : 'btn-primary'} pfb-save-btn`} onClick={handleSave}>
            {saved ? <><LuCheck /> Saved!</> : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Tab Nav Grid */}
      <div className="pfb-tab-nav">
        {TABS.map(t => (
          <button key={t.id} className={`pfb-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Forms & Preview Split Layout */}
      <div className="pfb-content">

        {activeTab === 'info' && (
          <Section title="Personal Information" icon={<LuLayoutDashboard />} accent="#D4645C">
            <div className="pfb-grid-2">
              <Field label="Full Name"  value={data.name}     onChange={v => update('name', v)}     placeholder="Jane Doe" />
              <Field label="Professional Tagline" value={data.tagline}  onChange={v => update('tagline', v)}  placeholder="Full Stack Engineer | Specialized in Distributed Systems" />
              <Field label="Contact Email" value={data.email}    onChange={v => update('email', v)}    placeholder="jane@email.com" />
              <Field label="Contact Phone" value={data.phone}    onChange={v => update('phone', v)}    placeholder="+91 98765 43210" />
              <Field label="Current Location" value={data.location} onChange={v => update('location', v)} placeholder="Bangalore, India" />
              <Field label="GitHub Profile URL" value={data.github}   onChange={v => update('github', v)}   placeholder="https://github.com/jane" />
              <Field label="LinkedIn Profile URL" value={data.linkedin} onChange={v => update('linkedin', v)} placeholder="https://linkedin.com/in/jane" />
              <Field label="Personal Website URL" value={data.website}  onChange={v => update('website', v)}  placeholder="https://janedev.com" />
            </div>
            <Field label="Professional Summary (About Me)" value={data.about} onChange={v => update('about', v)} placeholder="Write an engaging bio of your technical trajectory, core interests, and development objectives…" multiline />
          </Section>
        )}

        {activeTab === 'skills' && (
          <Section title="Skills & Core Competencies" icon={<LuCode />} accent="#5B8FB9">
            <p className="pfb-hint">These skills map to your placement tags. Feel free to supplement and rephrase them as desired.</p>
            <div className="pfb-skills-editor">
              {(data.skills || []).map((s, i) => (
                <div key={i} className="pfb-skill-chip">
                  <input className="pfb-skill-input" value={s} onChange={e => {
                    const arr = [...(data.skills || [])]; arr[i] = e.target.value; update('skills', arr);
                  }} />
                  <button onClick={() => removeItem('skills', i)}><LuTrash2 /></button>
                </div>
              ))}
              <button className="pfb-add-btn" onClick={() => addItem('skills', '')}>
                <LuPlus /> Add Skill
              </button>
            </div>
          </Section>
        )}

        {activeTab === 'projects' && (
          <Section title="Projects & Implementations" icon={<LuBriefcase />} accent="#4CAF82">
            {(data.projects || []).map((p, i) => (
              <div key={i} className="pfb-list-item">
                <div className="pfb-grid-2">
                  <Field label="Project Title" value={p.name || ''} onChange={v => updateArr('projects', i, 'name', v)} placeholder="My Enterprise Webapp" />
                  <Field label="Tech Stack Utilized" value={p.tech || ''} onChange={v => updateArr('projects', i, 'tech', v)} placeholder="React, Node.js, Express, MongoDB" />
                  <Field label="Live Hosting Link" value={p.link || ''} onChange={v => updateArr('projects', i, 'link', v)} placeholder="https://myapp.com" />
                  <Field label="GitHub Repository Link" value={p.github || ''} onChange={v => updateArr('projects', i, 'github', v)} placeholder="https://github.com/jane/app" />
                </div>
                <Field label="Achievement-Oriented Description" value={p.description || ''} onChange={v => updateArr('projects', i, 'description', v)} placeholder="Highlight what you built, what algorithms were solved, and standard numerical achievements (e.g. Optimized rendering by 35%)" multiline />
                <button className="pfb-remove-btn" onClick={() => removeItem('projects', i)}><LuTrash2 /> Remove Project</button>
              </div>
            ))}
            <button className="pfb-add-btn" onClick={() => addItem('projects', { name: '', tech: '', link: '', github: '', description: '' })}>
              <LuPlus /> Add Professional Project
            </button>
          </Section>
        )}

        {activeTab === 'certs' && (
          <Section title="Certifications & Course Credentials" icon={<LuAward />} accent="#E0A546">
            <p className="pfb-hint">Integrate your active external qualifications, course completions, and official technical validations.</p>
            {(data.certifications || []).map((c, i) => (
              <div key={i} className="pfb-list-item">
                <div className="pfb-grid-2">
                  <Field label="Credential Name" value={c.name || ''}   onChange={v => updateArr('certifications', i, 'name', v)}   placeholder="AWS Certified Developer" />
                  <Field label="Issuing Authority" value={c.issuer || ''} onChange={v => updateArr('certifications', i, 'issuer', v)} placeholder="Amazon Web Services" />
                  <Field label="Year Issued" value={c.year || ''}   onChange={v => updateArr('certifications', i, 'year', v)}   placeholder="2024" />
                  <Field label="Verification URL" value={c.link || ''}   onChange={v => updateArr('certifications', i, 'link', v)}   placeholder="https://verify.credential.com/..." />
                </div>
                <button className="pfb-remove-btn" onClick={() => removeItem('certifications', i)}><LuTrash2 /> Remove Certificate</button>
              </div>
            ))}
            <button className="pfb-add-btn" onClick={() => addItem('certifications', { name: '', issuer: '', year: '', link: '' })}>
              <LuPlus /> Add Certificate
            </button>
          </Section>
        )}

        {activeTab === 'edu' && (
          <Section title="Academic Background" icon={<LuGraduationCap />} accent="#a78bfa">
            {(data.education || []).map((e, i) => (
              <div key={i} className="pfb-list-item">
                <div className="pfb-grid-2">
                  <Field label="Degree & Specialization" value={e.degree || ''}      onChange={v => updateArr('education', i, 'degree', v)}      placeholder="B.Tech Computer Science" />
                  <Field label="School / University" value={e.institution || ''} onChange={v => updateArr('education', i, 'institution', v)} placeholder="University of Technology" />
                  <Field label="Graduation Timeline" value={e.year || ''}        onChange={v => updateArr('education', i, 'year', v)}        placeholder="2021 – 2025" />
                  <Field label="GPA / Final Score" value={e.gpa || ''}         onChange={v => updateArr('education', i, 'gpa', v)}         placeholder="8.5 / 10" />
                </div>
                <button className="pfb-remove-btn" onClick={() => removeItem('education', i)}><LuTrash2 /> Remove Education</button>
              </div>
            ))}
            <button className="pfb-add-btn" onClick={() => addItem('education', { degree: '', institution: '', year: '', gpa: '' })}>
              <LuPlus /> Add Education Block
            </button>
          </Section>
        )}

        {activeTab === 'exp' && (
          <Section title="Professional Experience" icon={<LuBriefcase />} accent="#06b6d4">
            {(data.experience || []).map((e, i) => (
              <div key={i} className="pfb-list-item">
                <div className="pfb-grid-2">
                  <Field label="Role / Title" value={e.role || ''}     onChange={v => updateArr('experience', i, 'role', v)}     placeholder="Software Engineer Intern" />
                  <Field label="Employer / Company" value={e.company || ''}  onChange={v => updateArr('experience', i, 'company', v)}  placeholder="Tech Labs Ltd" />
                  <Field label="Duration Timeline" value={e.duration || ''} onChange={v => updateArr('experience', i, 'duration', v)} placeholder="Jun 2024 – Aug 2024" />
                  <Field label="Location / Setting" value={e.location || ''} onChange={v => updateArr('experience', i, 'location', v)} placeholder="Bangalore (Hybrid)" />
                </div>
                <Field label="Responsibilities & Metrics" value={e.description || ''} onChange={v => updateArr('experience', i, 'description', v)} placeholder="Specify exactly what tasks you led and what efficiency gains you brought to the team." multiline />
                <button className="pfb-remove-btn" onClick={() => removeItem('experience', i)}><LuTrash2 /> Remove Experience</button>
              </div>
            ))}
            <button className="pfb-add-btn" onClick={() => addItem('experience', { role: '', company: '', duration: '', location: '', description: '' })}>
              <LuPlus /> Add Work Experience
            </button>
          </Section>
        )}

        {activeTab === 'preview' && (
          <div className="pfb-preview-card-wrap">
            {/* Template Selector Tool bar */}
            <div className="pfb-preview-toolbar">
              <div className="pfb-toolbar-title">
                <LuPalette /> Theme Showcase
              </div>
              <div className="pfb-theme-selector-chips">
                {[
                  { id: 'executive',  label: 'Obsidian Slate' },
                  { id: 'minimalist', label: 'Tech Minimalist' },
                  { id: 'academic',   label: 'Academic Scholar' }
                ].map(th => (
                  <button 
                    key={th.id} 
                    type="button"
                    className={`pfb-theme-btn ${theme === th.id ? 'active' : ''}`}
                    onClick={() => setTheme(th.id)}
                  >
                    {th.label}
                  </button>
                ))}
              </div>

              <div className="pfb-toolbar-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint}>
                  <LuDownload /> Print / Export PDF
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsFullscreen(true)}>
                  <LuShare2 /> isolated Presentation
                </button>
              </div>
            </div>

            {/* Preview Frame Area */}
            <div className="pfb-preview-frame" ref={previewFrameRef}>
              <PortfolioPreview 
                data={data} 
                perf={perf} 
                badges={badgeDefinitions} 
                earnedIds={earnedIds} 
                theme={theme}
              />
            </div>
          </div>
        )}
      </div>

      {/* Immersive Isolated Full Screen Presentation Modal */}
      {isFullscreen && (
        <div className="pfb-fullscreen-portal">
          <div className="pfb-fullscreen-bar">
            <div className="pfb-fs-meta">
              <span className="pfb-live-dot" />
              <strong>{data.name || 'Student'} Showcase</strong>
              <span className="pfb-fs-theme-pill">{theme} Template</span>
            </div>
            
            <div className="pfb-fs-controls">
              <div className="pfb-fs-theme-group">
                {['executive', 'minimalist', 'academic'].map(t => (
                  <button 
                    key={t}
                    type="button" 
                    className={`pfb-fs-theme-option ${theme === t ? 'active' : ''}`}
                    onClick={() => setTheme(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyLink}>
                {copied ? <><LuCheck /> Copied!</> : <><LuLink /> Copy Shareable URL</>}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint}>
                <LuDownload /> Download PDF
              </button>
              <button type="button" className="pfb-fs-close" onClick={() => setIsFullscreen(false)}>
                <LuX />
              </button>
            </div>
          </div>
          
          <div className="pfb-fullscreen-body-scroll">
            <div className="pfb-fs-inner-wrapper">
              <PortfolioPreview 
                data={data} 
                perf={perf} 
                badges={badgeDefinitions} 
                earnedIds={earnedIds} 
                theme={theme}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
