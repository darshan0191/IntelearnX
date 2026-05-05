import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPerformanceData, getUserBadges } from '../services/storageService';
import { badgeDefinitions } from '../data/quizData';
import {
  LuLayoutDashboard, LuPlus, LuTrash2, LuUpload, LuLink,
  LuGithub, LuGlobe, LuMail, LuPhone, LuMapPin,
  LuTrophy, LuTarget, LuZap, LuFlame, LuStar,
  LuCode, LuBriefcase, LuGraduationCap, LuAward,
  LuExternalLink, LuCheck, LuLoader, LuEye,
} from 'react-icons/lu';
import './PortfolioBuilder.css';

/* ── small helpers ── */
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

/* ── Portfolio Live Preview ── */
function PortfolioPreview({ data, perf, badges, earnedIds }) {
  const strongSubjects = Object.entries(perf?.subjectAccuracy || {})
    .filter(([, v]) => v.total > 0)
    .map(([s, v]) => ({ subject: s, accuracy: Math.round((v.correct / v.total) * 100) }))
    .sort((a, b) => b.accuracy - a.accuracy);

  const earnedBadges = (earnedIds || [])
    .map(id => badgeDefinitions.find(b => b.id === id))
    .filter(Boolean);

  return (
    <div className="pfp-root">
      {/* Hero */}
      <div className="pfp-hero">
        <div className="pfp-hero-bg" />
        <div className="pfp-avatar">{(data.name || 'S').charAt(0)}</div>
        <h1 className="pfp-name">{data.name || 'Your Name'}</h1>
        <p className="pfp-tagline">{data.tagline || 'Software Developer · Lifelong Learner'}</p>
        <div className="pfp-contact-row">
          {data.email    && <a href={`mailto:${data.email}`}    className="pfp-contact-chip"><LuMail />    {data.email}</a>}
          {data.phone    && <span className="pfp-contact-chip"><LuPhone />   {data.phone}</span>}
          {data.location && <span className="pfp-contact-chip"><LuMapPin />  {data.location}</span>}
          {data.github   && <a href={data.github}   target="_blank" rel="noreferrer" className="pfp-contact-chip"><LuGithub />  GitHub</a>}
          {data.linkedin && <a href={data.linkedin} target="_blank" rel="noreferrer" className="pfp-contact-chip"><LuLink />    LinkedIn</a>}
          {data.website  && <a href={data.website}  target="_blank" rel="noreferrer" className="pfp-contact-chip"><LuGlobe />   Website</a>}
        </div>
      </div>

      {/* About */}
      {data.about && (
        <div className="pfp-section">
          <h2 className="pfp-section-title">About Me</h2>
          <p className="pfp-about">{data.about}</p>
        </div>
      )}

      {/* IntelearnX Stats */}
      {perf && perf.totalQuizzes > 0 && (
        <div className="pfp-section">
          <h2 className="pfp-section-title">Learning Stats</h2>
          <div className="pfp-stats-grid">
            {[
              { icon: <LuTarget />, value: `${perf.overallAccuracy}%`, label: 'Accuracy',    color: '#D4645C' },
              { icon: <LuTrophy />, value: perf.totalQuizzes,          label: 'Quizzes',     color: '#10b981' },
              { icon: <LuZap />,    value: data.xp || 0,               label: 'XP Earned',   color: '#f59e0b' },
              { icon: <LuFlame />,  value: data.loginStreak || 0,      label: 'Day Streak',  color: '#E0A546' },
            ].map((s, i) => (
              <div key={i} className="pfp-stat-card" style={{ '--sc': s.color }}>
                <span className="pfp-stat-icon">{s.icon}</span>
                <span className="pfp-stat-value">{s.value}</span>
                <span className="pfp-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {data.skills?.length > 0 && (
        <div className="pfp-section">
          <h2 className="pfp-section-title">Skills</h2>
          <div className="pfp-skills-wrap">
            {data.skills.map((s, i) => <span key={i} className="pfp-skill-chip">{s}</span>)}
          </div>
        </div>
      )}

      {/* Subject Proficiency */}
      {strongSubjects.length > 0 && (
        <div className="pfp-section">
          <h2 className="pfp-section-title">Subject Proficiency</h2>
          <div className="pfp-proficiency">
            {strongSubjects.map((s, i) => (
              <div key={i} className="pfp-prof-row">
                <span className="pfp-prof-label">{s.subject}</span>
                <div className="pfp-prof-bar-wrap">
                  <div className="pfp-prof-bar" style={{ width: `${s.accuracy}%` }} />
                </div>
                <span className="pfp-prof-pct">{s.accuracy}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {data.projects?.length > 0 && (
        <div className="pfp-section">
          <h2 className="pfp-section-title">Projects</h2>
          <div className="pfp-projects-grid">
            {data.projects.map((p, i) => (
              <div key={i} className="pfp-project-card">
                <div className="pfp-project-head">
                  <h3>{p.name}</h3>
                  {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="pfp-project-link"><LuExternalLink /></a>}
                </div>
                {p.tech && <div className="pfp-project-tech">{p.tech}</div>}
                {p.description && <p className="pfp-project-desc">{p.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {data.certifications?.length > 0 && (
        <div className="pfp-section">
          <h2 className="pfp-section-title">Certifications</h2>
          <div className="pfp-certs-grid">
            {data.certifications.map((c, i) => (
              <div key={i} className="pfp-cert-card">
                <LuAward className="pfp-cert-icon" />
                <div>
                  <div className="pfp-cert-name">{c.name}</div>
                  <div className="pfp-cert-issuer">{c.issuer}{c.year ? ` · ${c.year}` : ''}</div>
                  {c.link && <a href={c.link} target="_blank" rel="noreferrer" className="pfp-cert-link">View Certificate <LuExternalLink /></a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Badges */}
      {earnedBadges.length > 0 && (
        <div className="pfp-section">
          <h2 className="pfp-section-title">Badges Earned</h2>
          <div className="pfp-badges-wrap">
            {earnedBadges.map(b => (
              <div key={b.id} className="pfp-badge-chip" title={b.description}>
                <span>{b.icon}</span>
                <span>{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {data.education?.length > 0 && (
        <div className="pfp-section">
          <h2 className="pfp-section-title">Education</h2>
          {data.education.map((e, i) => (
            <div key={i} className="pfp-edu-row">
              <LuGraduationCap className="pfp-edu-icon" />
              <div>
                <div className="pfp-edu-degree">{e.degree}</div>
                <div className="pfp-edu-inst">{e.institution}{e.year ? ` · ${e.year}` : ''}{e.gpa ? ` · GPA ${e.gpa}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Experience */}
      {data.experience?.length > 0 && (
        <div className="pfp-section">
          <h2 className="pfp-section-title">Experience</h2>
          {data.experience.map((e, i) => (
            <div key={i} className="pfp-exp-row">
              <div className="pfp-exp-head">
                <strong>{e.role}</strong>
                <span className="pfp-exp-date">{e.duration}</span>
              </div>
              <div className="pfp-exp-company">{e.company}{e.location ? ` · ${e.location}` : ''}</div>
              {e.description && <p className="pfp-exp-desc">{e.description}</p>}
            </div>
          ))}
        </div>
      )}
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
          tagline: user.selectedSubject ? `${user.selectedSubject} Enthusiast · IntelearnX Level ${user.level || 1}` : '',
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

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const TABS = [
    { id: 'info',   label: 'Basic Info',      icon: <LuLayoutDashboard /> },
    { id: 'skills', label: 'Skills',           icon: <LuCode /> },
    { id: 'projects', label: 'Projects',       icon: <LuBriefcase /> },
    { id: 'certs',  label: 'Certifications',   icon: <LuAward /> },
    { id: 'edu',    label: 'Education',        icon: <LuGraduationCap /> },
    { id: 'exp',    label: 'Experience',       icon: <LuBriefcase /> },
    { id: 'preview', label: 'Preview',         icon: <LuEye /> },
  ];

  if (loading) return (
    <div className="pfb-loading">
      <LuLoader className="pq-spin" style={{ fontSize: '2rem', color: 'var(--accent)' }} />
      <p>Loading your portfolio data…</p>
    </div>
  );

  return (
    <div className="pfb-page animate-fadeIn">
      {/* Header */}
      <div className="pfb-page-header">
        <div className="pfb-page-header-icon"><LuLayoutDashboard /></div>
        <div>
          <h1>Portfolio Builder</h1>
          <p>Build your developer portfolio — powered by your IntelearnX data</p>
        </div>
        <button className={`btn ${saved ? 'btn-secondary' : 'btn-primary'} pfb-save-btn`} onClick={handleSave}>
          {saved ? <><LuCheck /> Saved!</> : 'Save Portfolio'}
        </button>
      </div>

      {/* Tab Nav */}
      <div className="pfb-tab-nav">
        {TABS.map(t => (
          <button key={t.id} className={`pfb-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="pfb-content">

        {activeTab === 'info' && (
          <Section title="Personal Information" icon={<LuLayoutDashboard />} accent="#D4645C">
            <div className="pfb-grid-2">
              <Field label="Full Name"  value={data.name}     onChange={v => update('name', v)}     placeholder="Jane Doe" />
              <Field label="Tagline"    value={data.tagline}  onChange={v => update('tagline', v)}  placeholder="Full Stack Developer · Open Source Enthusiast" />
              <Field label="Email"      value={data.email}    onChange={v => update('email', v)}    placeholder="jane@email.com" />
              <Field label="Phone"      value={data.phone}    onChange={v => update('phone', v)}    placeholder="+91 98765 43210" />
              <Field label="Location"   value={data.location} onChange={v => update('location', v)} placeholder="Bangalore, India" />
              <Field label="GitHub URL" value={data.github}   onChange={v => update('github', v)}   placeholder="https://github.com/jane" />
              <Field label="LinkedIn"   value={data.linkedin} onChange={v => update('linkedin', v)} placeholder="https://linkedin.com/in/jane" />
              <Field label="Website"    value={data.website}  onChange={v => update('website', v)}  placeholder="https://janedev.com" />
            </div>
            <Field label="About Me" value={data.about} onChange={v => update('about', v)} placeholder="Write a short bio about yourself, your interests, and what you're working on…" multiline />
          </Section>
        )}

        {activeTab === 'skills' && (
          <Section title="Skills & Technologies" icon={<LuCode />} accent="#5B8FB9">
            <p className="pfb-hint">These are auto-filled from your IntelearnX study keywords. Add or remove as needed.</p>
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
          <Section title="Projects" icon={<LuBriefcase />} accent="#4CAF82">
            {(data.projects || []).map((p, i) => (
              <div key={i} className="pfb-list-item">
                <div className="pfb-grid-2">
                  <Field label="Project Name" value={p.name || ''} onChange={v => updateArr('projects', i, 'name', v)} placeholder="My Awesome App" />
                  <Field label="Tech Stack"   value={p.tech || ''} onChange={v => updateArr('projects', i, 'tech', v)} placeholder="React, Node.js, MongoDB" />
                  <Field label="Live Link"    value={p.link || ''} onChange={v => updateArr('projects', i, 'link', v)} placeholder="https://myapp.com" />
                  <Field label="GitHub Link"  value={p.github || ''} onChange={v => updateArr('projects', i, 'github', v)} placeholder="https://github.com/jane/app" />
                </div>
                <Field label="Description" value={p.description || ''} onChange={v => updateArr('projects', i, 'description', v)} placeholder="What does this project do? What problem does it solve?" multiline />
                <button className="pfb-remove-btn" onClick={() => removeItem('projects', i)}><LuTrash2 /> Remove</button>
              </div>
            ))}
            <button className="pfb-add-btn" onClick={() => addItem('projects', { name: '', tech: '', link: '', github: '', description: '' })}>
              <LuPlus /> Add Project
            </button>
          </Section>
        )}

        {activeTab === 'certs' && (
          <Section title="Certifications & Courses" icon={<LuAward />} accent="#E0A546">
            <p className="pfb-hint">Add your certifications, online courses, and other credentials here.</p>
            {(data.certifications || []).map((c, i) => (
              <div key={i} className="pfb-list-item">
                <div className="pfb-grid-2">
                  <Field label="Certificate Name" value={c.name || ''}   onChange={v => updateArr('certifications', i, 'name', v)}   placeholder="AWS Cloud Practitioner" />
                  <Field label="Issuing Body"      value={c.issuer || ''} onChange={v => updateArr('certifications', i, 'issuer', v)} placeholder="Amazon Web Services" />
                  <Field label="Year"              value={c.year || ''}   onChange={v => updateArr('certifications', i, 'year', v)}   placeholder="2024" />
                  <Field label="Certificate Link"  value={c.link || ''}   onChange={v => updateArr('certifications', i, 'link', v)}   placeholder="https://verify.cert.com/..." />
                </div>
                <button className="pfb-remove-btn" onClick={() => removeItem('certifications', i)}><LuTrash2 /> Remove</button>
              </div>
            ))}
            <button className="pfb-add-btn" onClick={() => addItem('certifications', { name: '', issuer: '', year: '', link: '' })}>
              <LuPlus /> Add Certification
            </button>
          </Section>
        )}

        {activeTab === 'edu' && (
          <Section title="Education" icon={<LuGraduationCap />} accent="#a78bfa">
            {(data.education || []).map((e, i) => (
              <div key={i} className="pfb-list-item">
                <div className="pfb-grid-2">
                  <Field label="Degree / Course"   value={e.degree || ''}      onChange={v => updateArr('education', i, 'degree', v)}      placeholder="B.Tech Computer Science" />
                  <Field label="Institution"        value={e.institution || ''} onChange={v => updateArr('education', i, 'institution', v)} placeholder="RV College of Engineering" />
                  <Field label="Year"               value={e.year || ''}        onChange={v => updateArr('education', i, 'year', v)}        placeholder="2021 – 2025" />
                  <Field label="GPA / Percentage"   value={e.gpa || ''}         onChange={v => updateArr('education', i, 'gpa', v)}         placeholder="8.5 / 10" />
                </div>
                <button className="pfb-remove-btn" onClick={() => removeItem('education', i)}><LuTrash2 /> Remove</button>
              </div>
            ))}
            <button className="pfb-add-btn" onClick={() => addItem('education', { degree: '', institution: '', year: '', gpa: '' })}>
              <LuPlus /> Add Education
            </button>
          </Section>
        )}

        {activeTab === 'exp' && (
          <Section title="Work Experience" icon={<LuBriefcase />} accent="#06b6d4">
            {(data.experience || []).map((e, i) => (
              <div key={i} className="pfb-list-item">
                <div className="pfb-grid-2">
                  <Field label="Role / Position" value={e.role || ''}     onChange={v => updateArr('experience', i, 'role', v)}     placeholder="Frontend Developer Intern" />
                  <Field label="Company"         value={e.company || ''}  onChange={v => updateArr('experience', i, 'company', v)}  placeholder="Acme Corp" />
                  <Field label="Duration"        value={e.duration || ''} onChange={v => updateArr('experience', i, 'duration', v)} placeholder="Jun 2024 – Aug 2024" />
                  <Field label="Location"        value={e.location || ''} onChange={v => updateArr('experience', i, 'location', v)} placeholder="Remote / Bangalore" />
                </div>
                <Field label="Description" value={e.description || ''} onChange={v => updateArr('experience', i, 'description', v)} placeholder="Key responsibilities and achievements…" multiline />
                <button className="pfb-remove-btn" onClick={() => removeItem('experience', i)}><LuTrash2 /> Remove</button>
              </div>
            ))}
            <button className="pfb-add-btn" onClick={() => addItem('experience', { role: '', company: '', duration: '', location: '', description: '' })}>
              <LuPlus /> Add Experience
            </button>
          </Section>
        )}

        {activeTab === 'preview' && (
          <div className="pfb-preview-wrap">
            <PortfolioPreview data={data} perf={perf} badges={badgeDefinitions} earnedIds={earnedIds} />
          </div>
        )}
      </div>
    </div>
  );
}
