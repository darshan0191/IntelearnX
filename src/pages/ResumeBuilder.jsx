import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useResumeData } from '../hooks/useResumeData';
import { analyzeATS } from '../utils/atsAnalyzer';
import {
  LuFileText, LuDownload, LuUser, LuBriefcase, LuGraduationCap,
  LuCode, LuPlus, LuTrash2, LuChevronDown, LuChevronUp, LuSparkles,
  LuCheck, LuPalette, LuZap, LuInfo, LuTriangleAlert, LuShieldCheck
} from 'react-icons/lu';
import './ResumeBuilder.css';

const TEMPLATES = [
  { id: 'executive',  label: 'Harvard Executive', desc: 'Classic single-column serif, corporate standard', accent: '#7F1D1D' },
  { id: 'minimalist', label: 'Tech Minimalist',   desc: 'Modern sans-serif, high tech-readability', accent: '#0F172A' },
  { id: 'compact',    label: 'Compact Corporate', desc: 'Space-saving layout, rich in details', accent: '#1E3A8A' },
  { id: 'ats',        label: 'ATS Ultimate',     desc: '100% compliant standard, maximum readability', accent: '#1E293B' },
  { id: 'classic',    label: 'Classic Split',     desc: 'Elegant two-column, balanced content', accent: '#0D9488' },
  { id: 'creative',   label: 'Modern Creative',   desc: 'Vibrant highlight sidebar, personal touch', accent: '#4F46E5' },
];

function Section({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rb-section">
      <button className="rb-section-header" onClick={() => setOpen(o => !o)}>
        <span className="rb-section-icon">{icon}</span>
        <span className="rb-section-title">{title}</span>
        {open ? <LuChevronUp className="rb-chevron" /> : <LuChevronDown className="rb-chevron" />}
      </button>
      {open && <div className="rb-section-body">{children}</div>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', multiline }) {
  return (
    <div className="rb-field">
      <label className="rb-label">{label}</label>
      {multiline
        ? <textarea className="rb-input rb-textarea" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} />
        : <input className="rb-input" type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      }
    </div>
  );
}

/* ── 1. Harvard Executive Preview (Serif, Single Column Corporate) ── */
function ExecutivePreview({ data, accent }) {
  return (
    <div className="rp-executive" style={{ '--ra': accent }}>
      <div className="rp-exec-header">
        <h1>{data.name || 'Your Name'}</h1>
        <div className="rp-exec-contact">
          {[data.email, data.phone, data.location, data.linkedin, data.github, data.website]
            .filter(Boolean)
            .map((c, i) => <span key={i}>{c}</span>)
          }
        </div>
        {data.title && <div className="rp-exec-subtitle">{data.title}</div>}
      </div>

      <div className="rp-exec-body">
        {data.summary && (
          <div className="rp-exec-block">
            <h3 className="rp-exec-title">Professional Summary</h3>
            <p className="rp-exec-text">{data.summary}</p>
          </div>
        )}

        {data.experience?.length > 0 && (
          <div className="rp-exec-block">
            <h3 className="rp-exec-title">Professional Experience</h3>
            {data.experience.map((e, i) => (
              <div key={i} className="rp-exec-entry">
                <div className="rp-exec-row">
                  <strong>{e.role}</strong>
                  <span className="rp-exec-date">{e.duration}</span>
                </div>
                <div className="rp-exec-row rp-exec-sub">
                  <span>{e.company}{e.location ? ` · ${e.location}` : ''}</span>
                </div>
                {e.description && <p className="rp-exec-text">{e.description}</p>}
              </div>
            ))}
          </div>
        )}

        {data.education?.length > 0 && (
          <div className="rp-exec-block">
            <h3 className="rp-exec-title">Education</h3>
            {data.education.map((e, i) => (
              <div key={i} className="rp-exec-entry">
                <div className="rp-exec-row">
                  <strong>{e.degree}</strong>
                  <span className="rp-exec-date">{e.year}</span>
                </div>
                <div className="rp-exec-row rp-exec-sub">
                  <span>{e.institution}{e.gpa ? ` (GPA: ${e.gpa})` : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {data.projects?.length > 0 && (
          <div className="rp-exec-block">
            <h3 className="rp-exec-title">Key Projects</h3>
            {data.projects.map((p, i) => (
              <div key={i} className="rp-exec-entry">
                <div className="rp-exec-row">
                  <strong>{p.name}</strong>
                  {p.link && <a href={p.link} className="rp-exec-link" target="_blank" rel="noreferrer">{p.link}</a>}
                </div>
                {p.tech && <div className="rp-exec-tech">Technologies: {p.tech}</div>}
                {p.description && <p className="rp-exec-text">{p.description}</p>}
              </div>
            ))}
          </div>
        )}

        {data.skills?.length > 0 && (
          <div className="rp-exec-block">
            <h3 className="rp-exec-title">Technical Competencies</h3>
            <p className="rp-exec-skills-text">{data.skills.join(', ')}</p>
          </div>
        )}

        {data.achievements?.length > 0 && (
          <div className="rp-exec-block">
            <h3 className="rp-exec-title">Achievements & Certifications</h3>
            <ul className="rp-exec-bullets">
              {data.achievements.map((a, i) => (
                <li key={i}>
                  <strong>{a.title}</strong>{a.description ? ` – ${a.description}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 2. Tech Minimalist Preview (Sans-Serif, Premium Modern) ── */
function MinimalistPreview({ data, accent }) {
  return (
    <div className="rp-minimalist" style={{ '--ra': accent }}>
      <div className="rp-mini-header">
        <div className="rp-mini-headline">
          <h1>{data.name || 'Your Name'}</h1>
          <p className="rp-mini-title">{data.title || 'Software Developer'}</p>
        </div>
        <div className="rp-mini-contact">
          {data.email && <div>{data.email}</div>}
          {data.phone && <div>{data.phone}</div>}
          {data.location && <div>{data.location}</div>}
          {data.linkedin && <div className="rp-mini-contact-link">{data.linkedin}</div>}
          {data.github && <div className="rp-mini-contact-link">{data.github}</div>}
        </div>
      </div>

      <div className="rp-mini-body">
        {data.summary && (
          <div className="rp-mini-block">
            <h3 className="rp-mini-section-title">Overview</h3>
            <p className="rp-mini-text">{data.summary}</p>
          </div>
        )}

        {data.experience?.length > 0 && (
          <div className="rp-mini-block">
            <h3 className="rp-mini-section-title">Experience</h3>
            {data.experience.map((e, i) => (
              <div key={i} className="rp-mini-entry">
                <div className="rp-mini-row">
                  <strong>{e.role} <span className="rp-mini-company">@ {e.company}</span></strong>
                  <span className="rp-mini-date">{e.duration}</span>
                </div>
                {e.description && <p className="rp-mini-text">{e.description}</p>}
              </div>
            ))}
          </div>
        )}

        {data.projects?.length > 0 && (
          <div className="rp-mini-block">
            <h3 className="rp-mini-section-title">Projects</h3>
            {data.projects.map((p, i) => (
              <div key={i} className="rp-mini-entry">
                <div className="rp-mini-row">
                  <strong>{p.name} {p.link && <a href={p.link} className="rp-mini-link" target="_blank" rel="noreferrer">↗</a>}</strong>
                  {p.tech && <span className="rp-mini-tech-tag">{p.tech}</span>}
                </div>
                {p.description && <p className="rp-mini-text">{p.description}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="rp-mini-grid-2">
          {data.education?.length > 0 && (
            <div className="rp-mini-block">
              <h3 className="rp-mini-section-title">Education</h3>
              {data.education.map((e, i) => (
                <div key={i} className="rp-mini-sub-entry">
                  <strong>{e.degree}</strong>
                  <div>{e.institution} · {e.year}</div>
                  {e.gpa && <div className="rp-mini-gpa">GPA: {e.gpa}</div>}
                </div>
              ))}
            </div>
          )}

          {data.skills?.length > 0 && (
            <div className="rp-mini-block">
              <h3 className="rp-mini-section-title">Skills</h3>
              <div className="rp-mini-skills-tags">
                {data.skills.map((s, i) => <span key={i} className="rp-mini-tag">{s}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 3. Compact Corporate Preview (High Density space-saving) ── */
function CompactPreview({ data, accent }) {
  return (
    <div className="rp-compact" style={{ '--ra': accent }}>
      <div className="rp-comp-header">
        <h2>{data.name || 'Your Name'}</h2>
        <div className="rp-comp-contact">
          {[data.email, data.phone, data.location, data.linkedin, data.github].filter(Boolean).join('  |  ')}
        </div>
      </div>

      <div className="rp-comp-body">
        {data.summary && <p className="rp-comp-summary">{data.summary}</p>}

        {data.skills?.length > 0 && (
          <div className="rp-comp-block">
            <span className="rp-comp-label">Technical Skills: </span>
            <span className="rp-comp-skills-list">{data.skills.join(', ')}</span>
          </div>
        )}

        {data.experience?.length > 0 && (
          <div className="rp-comp-block">
            <h4 className="rp-comp-section-title">Experience</h4>
            {data.experience.map((e, i) => (
              <div key={i} className="rp-comp-entry">
                <div className="rp-comp-row">
                  <strong>{e.role} – {e.company}</strong>
                  <span>{e.duration}</span>
                </div>
                {e.description && <p className="rp-comp-text">{e.description}</p>}
              </div>
            ))}
          </div>
        )}

        {data.projects?.length > 0 && (
          <div className="rp-comp-block">
            <h4 className="rp-comp-section-title">Selected Projects</h4>
            {data.projects.map((p, i) => (
              <div key={i} className="rp-comp-entry">
                <div className="rp-comp-row">
                  <strong>{p.name} {p.tech && <span className="rp-comp-tech">({p.tech})</span>}</strong>
                  {p.link && <a href={p.link} className="rp-comp-link" target="_blank" rel="noreferrer">{p.link}</a>}
                </div>
                {p.description && <p className="rp-comp-text">{p.description}</p>}
              </div>
            ))}
          </div>
        )}

        {data.education?.length > 0 && (
          <div className="rp-comp-block">
            <h4 className="rp-comp-section-title">Education</h4>
            {data.education.map((e, i) => (
              <div key={i} className="rp-comp-row rp-comp-edu">
                <span><strong>{e.degree}</strong>, {e.institution}</span>
                <span>{e.year} {e.gpa ? `· GPA: ${e.gpa}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 4. ATS Ultimate Preview (Clean Text-based standard) ── */
function AtsPreview({ data, accent }) {
  return (
    <div className="rp-ats" style={{ '--ra': accent }}>
      <div className="rp-ats-header">
        <h1>{data.name || 'Your Name'}</h1>
        <div className="rp-ats-contact">
          {[data.email, data.phone, data.location, data.linkedin, data.github, data.website].filter(Boolean).map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
      </div>

      <div className="rp-ats-body">
        {data.summary && (
          <div className="rp-ats-block">
            <h3 className="rp-ats-title">Professional Summary</h3>
            <p className="rp-ats-text">{data.summary}</p>
          </div>
        )}

        {data.experience?.length > 0 && (
          <div className="rp-ats-block">
            <h3 className="rp-ats-title">Experience</h3>
            {data.experience.map((e, i) => (
              <div key={i} className="rp-ats-entry">
                <div className="rp-ats-row">
                  <strong>{e.role}</strong>
                  <span>{e.duration}</span>
                </div>
                <div className="rp-ats-row rp-ats-sub">
                  <span>{e.company}{e.location ? `, ${e.location}` : ''}</span>
                </div>
                {e.description && <p className="rp-ats-text">{e.description}</p>}
              </div>
            ))}
          </div>
        )}

        {data.education?.length > 0 && (
          <div className="rp-ats-block">
            <h3 className="rp-ats-title">Education</h3>
            {data.education.map((e, i) => (
              <div key={i} className="rp-ats-entry">
                <div className="rp-ats-row">
                  <strong>{e.degree}</strong>
                  <span>{e.year}</span>
                </div>
                <div className="rp-ats-row rp-ats-sub">
                  <span>{e.institution}{e.gpa ? ` | GPA: ${e.gpa}` : ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {data.projects?.length > 0 && (
          <div className="rp-ats-block">
            <h3 className="rp-ats-title">Projects</h3>
            {data.projects.map((p, i) => (
              <div key={i} className="rp-ats-entry">
                <div className="rp-ats-row">
                  <strong>{p.name}</strong>
                  {p.link && <span>{p.link}</span>}
                </div>
                {p.tech && <div className="rp-ats-sub">Technologies: {p.tech}</div>}
                {p.description && <p className="rp-ats-text">{p.description}</p>}
              </div>
            ))}
          </div>
        )}

        {data.skills?.length > 0 && (
          <div className="rp-ats-block">
            <h3 className="rp-ats-title">Skills</h3>
            <p className="rp-ats-text">
              {data.skills.join(', ')}
            </p>
          </div>
        )}

        {data.achievements?.length > 0 && (
          <div className="rp-ats-block">
            <h3 className="rp-ats-title">Achievements & Certifications</h3>
            {data.achievements.map((a, i) => (
              <div key={i} className="rp-ats-entry rp-ats-achieve">
                <strong>{a.title}</strong>
                {a.description && <span> - {a.description}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 5. Classic Split Preview (Two Column Sidebar Layout) ── */
function ClassicPreview({ data, accent }) {
  return (
    <div className="rp-classic" style={{ '--ra': accent }}>
      <div className="rp-classic-header">
        <h1>{data.name || 'Your Name'}</h1>
        <p className="rp-classic-title">{data.title || 'Software Developer'}</p>
        <div className="rp-classic-contact">
          {data.email && <span>{data.email}</span>}
          {data.phone && <span>{data.phone}</span>}
          {data.location && <span>{data.location}</span>}
          {data.linkedin && <span>{data.linkedin}</span>}
          {data.github && <span>{data.github}</span>}
        </div>
      </div>
      <div className="rp-classic-body">
        <div className="rp-classic-main">
          {data.summary && (
            <div className="rp-block">
              <h3 className="rp-block-title">Summary</h3>
              <p className="rp-text">{data.summary}</p>
            </div>
          )}
          {data.experience?.length > 0 && (
            <div className="rp-block">
              <h3 className="rp-block-title">Experience</h3>
              {data.experience.map((e, i) => (
                <div key={i} className="rp-entry">
                  <div className="rp-entry-head">
                    <strong>{e.role}</strong>
                    <span className="rp-entry-date">{e.duration}</span>
                  </div>
                  <div className="rp-entry-sub">{e.company}{e.location ? ` · ${e.location}` : ''}</div>
                  {e.description && <p className="rp-text">{e.description}</p>}
                </div>
              ))}
            </div>
          )}
          {data.projects?.length > 0 && (
            <div className="rp-block">
              <h3 className="rp-block-title">Projects</h3>
              {data.projects.map((p, i) => (
                <div key={i} className="rp-entry">
                  <div className="rp-entry-head">
                    <strong>{p.name}</strong>
                    {p.link && <a href={p.link} className="rp-link">{p.link}</a>}
                  </div>
                  {p.tech && <div className="rp-entry-sub">{p.tech}</div>}
                  {p.description && <p className="rp-text">{p.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rp-classic-side">
          {data.education?.length > 0 && (
            <div className="rp-block">
              <h3 className="rp-block-title">Education</h3>
              {data.education.map((e, i) => (
                <div key={i} className="rp-entry">
                  <strong>{e.degree}</strong>
                  <div className="rp-entry-sub">{e.institution}</div>
                  <div className="rp-entry-date">{e.year}{e.gpa ? ` · GPA ${e.gpa}` : ''}</div>
                </div>
              ))}
            </div>
          )}
          {data.skills?.length > 0 && (
            <div className="rp-block">
              <h3 className="rp-block-title">Skills</h3>
              <div className="rp-skills">
                {data.skills.map((s, i) => <span key={i} className="rp-skill-tag">{s}</span>)}
              </div>
            </div>
          )}
          {data.achievements?.length > 0 && (
            <div className="rp-block">
              <h3 className="rp-block-title">Achievements</h3>
              {data.achievements.map((a, i) => (
                <div key={i} className="rp-entry">
                  <strong>{a.title}</strong>
                  {a.description && <p className="rp-text">{a.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 6. Modern Creative Preview (Sidebar Highlights) ── */
function CreativePreview({ data, accent }) {
  return (
    <div className="rp-creative" style={{ '--ra': accent }}>
      <div className="rp-creative-sidebar">
        <div className="rp-creative-avatar">{(data.name || 'Y').charAt(0)}</div>
        <h2 className="rp-creative-name">{data.name || 'Your Name'}</h2>
        <p className="rp-creative-title">{data.title || 'Developer'}</p>
        <div className="rp-creative-contact">
          {[data.email, data.phone, data.location, data.linkedin, data.github].filter(Boolean).map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
        {data.skills?.length > 0 && (
          <div className="rp-creative-block">
            <h4>Skills</h4>
            <div className="rp-skills">{data.skills.map((s, i) => <span key={i} className="rp-skill-tag rp-skill-light">{s}</span>)}</div>
          </div>
        )}
        {data.education?.length > 0 && (
          <div className="rp-creative-block">
            <h4>Education</h4>
            {data.education.map((e, i) => (
              <div key={i} className="rp-creative-edu">
                <strong>{e.degree}</strong>
                <span>{e.institution}</span>
                <span>{e.year}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rp-creative-main">
        {data.summary && <p className="rp-creative-summary">{data.summary}</p>}
        {data.experience?.length > 0 && (
          <div className="rp-block">
            <h3 className="rp-creative-section-title">Experience</h3>
            {data.experience.map((e, i) => (
              <div key={i} className="rp-entry">
                <div className="rp-entry-head"><strong>{e.role}</strong><span className="rp-entry-date">{e.duration}</span></div>
                <div className="rp-entry-sub">{e.company}</div>
                {e.description && <p className="rp-text">{e.description}</p>}
              </div>
            ))}
          </div>
        )}
        {data.projects?.length > 0 && (
          <div className="rp-block">
            <h3 className="rp-creative-section-title">Projects</h3>
            {data.projects.map((p, i) => (
              <div key={i} className="rp-entry">
                <div className="rp-entry-head"><strong>{p.name}</strong>{p.link && <a href={p.link} className="rp-link">{p.link}</a>}</div>
                {p.tech && <div className="rp-entry-sub">{p.tech}</div>}
                {p.description && <p className="rp-text">{p.description}</p>}
              </div>
            ))}
          </div>
        )}
        {data.achievements?.length > 0 && (
          <div className="rp-block">
            <h3 className="rp-creative-section-title">Achievements</h3>
            {data.achievements.map((a, i) => (
              <div key={i} className="rp-entry">
                <strong>{a.title}</strong>
                {a.description && <p className="rp-text">{a.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResumePreview({ data, template }) {
  const tmpl = TEMPLATES.find(t => t.id === template) || TEMPLATES[0];
  if (template === 'executive') return <ExecutivePreview data={data} accent={tmpl.accent} />;
  if (template === 'minimalist') return <MinimalistPreview data={data} accent={tmpl.accent} />;
  if (template === 'compact') return <CompactPreview data={data} accent={tmpl.accent} />;
  if (template === 'ats') return <AtsPreview data={data} accent={tmpl.accent} />;
  if (template === 'creative') return <CreativePreview data={data} accent={tmpl.accent} />;
  return <ClassicPreview data={data} accent={tmpl.accent} />;
}

export default function ResumeBuilder() {
  const { user } = useAuth();
  const { data, setData, loading } = useResumeData(user);
  const [template, setTemplate] = useState('executive');
  const [activeTab, setActiveTab] = useState('edit');
  const [boostActive, setBoostActive] = useState(false);
  const printRef = useRef();

  // Dynamic ATS Analysis
  const [atsScore, setAtsScore] = useState(0);
  const [atsFeedback, setAtsFeedback] = useState([]);

  useEffect(() => {
    if (data) {
      const analysis = analyzeATS(data, template);
      setAtsScore(analysis.score);
      setAtsFeedback(analysis.feedback);
    }
  }, [data, template]);

  const update = (key, val) => setData(d => ({ ...d, [key]: val }));
  
  const updateArr = (key, idx, field, val) => setData(d => {
    const arr = [...(d[key] || [])];
    arr[idx] = { ...arr[idx], [field]: val };
    return { ...d, [key]: arr };
  });

  const addItem = (key, blank) => setData(d => ({ ...d, [key]: [...(d[key] || []), blank] }));
  const removeItem = (key, idx) => setData(d => ({ ...d, [key]: (d[key] || []).filter((_, i) => i !== idx) }));

  // One-Click Premium ATS Boost
  const handleAtsBoost = () => {
    setData(prev => {
      // 1. Boost Professional Summary with high-impact action verbs and quantitative metrics
      let boostedSummary = prev.summary;
      if (!boostedSummary || boostedSummary.includes('adaptive quizzes') || boostedSummary.trim().length < 50) {
        boostedSummary = `Results-driven software developer with hands-on technical training and specialized knowledge in modern full-stack technologies. Engineered responsive interfaces and structured robust API architectures during course labs. Proven core problem-solving capacity, executing complex backend logic with optimal performance. Eager to deploy scalable codebases and streamline operational pipelines in an agile enterprise framework.`;
      }

      // 2. Boost Experiences by adding standard action verbs and metric placeholders
      const boostedExperience = (prev.experience || []).map(exp => {
        let desc = exp.description || '';
        if (desc && !desc.toLowerCase().includes('engineered') && !desc.toLowerCase().includes('optimized')) {
          desc = `Engineered core responsive client modules using React.js. Structured and optimized backend REST API architectures, reducing server database query latency by 20%. Debugged complex legacy issues, bolstering system runtime reliability.`;
        } else if (!desc) {
          desc = `Collaborated with lead engineers to build, test, and deploy responsive web modules. Developed backend microservices using Node.js and Express, saving 15% in operational response times. Integrated comprehensive JUnit/Jest automated testing pipelines.`;
        }
        return { ...exp, description: desc };
      });

      // 3. Boost Projects
      const boostedProjects = (prev.projects || []).map(proj => {
        let desc = proj.description || '';
        if (desc && !desc.toLowerCase().includes('designed') && !desc.toLowerCase().includes('implemented')) {
          desc = `Designed and implemented this highly scalable, secure solution. Structured robust SQL/NoSQL schemas. Engineered user authentication systems, increasing customer interaction retention rate by 25% and automating file workflows.`;
        } else if (!desc) {
          desc = `Designed, developed, and deployed a high-performance scalable software client. Integrated modern authentication layers and complex relational databases. Streamlined operational efficiency and boosted responsiveness by 30%.`;
        }
        return { ...proj, description: desc };
      });

      // 4. Boost Skills - Ensure at least 8 strong placement-ready skills
      let boostedSkills = [...(prev.skills || [])];
      const techSkills = ['JavaScript (ES6+)', 'React.js', 'Node.js', 'Express.js', 'REST APIs', 'SQL / MongoDB', 'Git Version Control', 'Agile Scrum Methodologies'];
      techSkills.forEach(skill => {
        if (!boostedSkills.some(s => s.toLowerCase() === skill.toLowerCase())) {
          boostedSkills.push(skill);
        }
      });
      boostedSkills = [...new Set(boostedSkills)].slice(0, 10);

      return {
        ...prev,
        summary: boostedSummary,
        experience: boostedExperience.length ? boostedExperience : [{
          role: 'Full Stack Engineer Intern',
          company: 'Nexus Tech Systems Ltd.',
          duration: 'Jan 2025 – Present',
          location: 'Bangalore, India',
          description: 'Engineered clean responsive frontends using React.js and structured RESTful APIs. Automated test cycles, boosting product delivery speed by 15%.'
        }],
        projects: boostedProjects.length ? boostedProjects : [{
          name: 'Cloud Learning Analytics & Drill-Down Dashboard',
          tech: 'React, Node.js, Express, MongoDB, CSS Grid',
          link: 'github.com/student/learning-dashboard',
          description: 'Designed and implemented a scalable learning dashboard metrics engine. Configured interactive data visualizations, reducing dashboard query loads by 35%.'
        }],
        skills: boostedSkills
      };
    });

    // Run animation
    setBoostActive(true);
    setTimeout(() => setBoostActive(false), 2000);
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    
    // Inject custom structural layout to force high-fidelity vector PDF print
    win.document.write(`
      <html>
        <head>
          <title>Resume — ${data.name || 'IntelearnX'}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              background: white; 
              color: black; 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact; 
            }
            
            /* Print CSS templates injected directly */
            .rp-executive { font-family: 'Times New Roman', Times, Georgia, serif; font-size: 10.5pt; color: #111; line-height: 1.4; padding: 0.5in; background: white; }
            .rp-exec-header { text-align: center; margin-bottom: 12pt; border-bottom: 2.5px double #111; padding-bottom: 8pt; }
            .rp-exec-header h1 { font-size: 18pt; font-weight: 700; text-transform: uppercase; margin-bottom: 3pt; color: #111; }
            .rp-exec-contact { display: flex; flex-wrap: wrap; justify-content: center; gap: 8pt; font-size: 9pt; font-style: italic; color: #333; margin-bottom: 3pt; }
            .rp-exec-contact span::after { content: '  •'; margin-left: 8pt; }
            .rp-exec-contact span:last-child::after { content: ''; }
            .rp-exec-subtitle { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #444; }
            .rp-exec-block { margin-bottom: 11pt; }
            .rp-exec-title { font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1.2px solid #222; padding-bottom: 2pt; margin-bottom: 6pt; color: #111; }
            .rp-exec-entry { margin-bottom: 7pt; }
            .rp-exec-row { display: flex; justify-content: space-between; align-items: baseline; }
            .rp-exec-row strong { font-size: 10.5pt; font-weight: 700; color: #111; }
            .rp-exec-date { font-size: 9.5pt; font-weight: 600; color: #111; }
            .rp-exec-sub { font-style: italic; font-size: 9.5pt; color: #333; margin-bottom: 2pt; }
            .rp-exec-text { font-size: 9.5pt; color: #222; text-align: justify; margin-top: 2pt; line-height: 1.4; }
            .rp-exec-skills-text { font-size: 9.5pt; color: #222; line-height: 1.4; }
            .rp-exec-bullets { margin-left: 14pt; font-size: 9.5pt; color: #222; }
            .rp-exec-bullets li { margin-bottom: 3pt; }
            
            .rp-minimalist { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 10pt; color: #1e293b; line-height: 1.45; padding: 0.5in; background: white; }
            .rp-mini-header { border-bottom: 3px solid #0f172a; padding-bottom: 12pt; margin-bottom: 14pt; display: flex; justify-content: space-between; align-items: flex-end; }
            .rp-mini-headline h1 { font-size: 20pt; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
            .rp-mini-title { font-size: 11pt; color: #475569; font-weight: 600; margin-top: 2pt; }
            .rp-mini-contact { text-align: right; font-size: 8.5pt; color: #475569; line-height: 1.3; }
            .rp-mini-block { margin-bottom: 12pt; }
            .rp-mini-section-title { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; margin-bottom: 6pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 2pt; }
            .rp-mini-entry { margin-bottom: 8pt; }
            .rp-mini-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3pt; }
            .rp-mini-row strong { font-size: 10pt; color: #0f172a; }
            .rp-mini-company { font-weight: 600; color: #3b82f6; }
            .rp-mini-date { font-size: 8.5pt; color: #64748b; font-weight: 600; }
            .rp-mini-text { font-size: 9pt; color: #334155; text-align: justify; line-height: 1.4; }
            .rp-mini-tag { font-size: 8pt; display: inline-block; padding: 2px 6px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; color: #1e293b; margin: 2px; }
            .rp-mini-skills-tags { display: flex; flex-wrap: wrap; gap: 4px; }
            .rp-mini-sub-entry { margin-bottom: 5pt; font-size: 9pt; color: #334155; }
            .rp-mini-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16pt; }

            .rp-compact { font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; color: #222; line-height: 1.35; padding: 0.3in; background: white; }
            .rp-comp-header { text-align: center; margin-bottom: 8pt; border-bottom: 1.5px solid #1e3a8a; padding-bottom: 4pt; }
            .rp-comp-header h2 { font-size: 14pt; font-weight: 700; color: #1e3a8a; margin-bottom: 1pt; }
            .rp-comp-contact { font-size: 8pt; color: #444; }
            .rp-comp-summary { font-size: 8pt; margin-bottom: 6pt; font-style: italic; color: #333; text-align: justify; }
            .rp-comp-block { margin-bottom: 8pt; }
            .rp-comp-label { font-weight: 700; font-size: 8pt; color: #1e3a8a; }
            .rp-comp-skills-list { font-size: 8pt; color: #222; }
            .rp-comp-section-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; color: #1e3a8a; border-bottom: 1px solid #94a3b8; padding-bottom: 1px; margin-bottom: 4pt; }
            .rp-comp-entry { margin-bottom: 4pt; }
            .rp-comp-row { display: flex; justify-content: space-between; font-size: 8pt; }
            .rp-comp-text { font-size: 8pt; color: #333; margin-top: 1px; text-align: justify; }

            .rp-ats { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: black; background: white; padding: 0.5in; line-height: 1.4; }
            .rp-ats-header { text-align: center; margin-bottom: 12pt; }
            .rp-ats-header h1 { font-size: 18pt; font-weight: 700; text-transform: uppercase; margin-bottom: 2pt; letter-spacing: 0.2px; }
            .rp-ats-contact { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; font-size: 9pt; }
            .rp-ats-contact span::after { content: ' |'; margin-left: 8px; }
            .rp-ats-contact span:last-child::after { content: ''; }
            .rp-ats-block { margin-bottom: 12pt; }
            .rp-ats-title { font-size: 10pt; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid black; padding-bottom: 1px; margin-bottom: 6pt; letter-spacing: 0.3px; }
            .rp-ats-entry { margin-bottom: 8pt; }
            .rp-ats-row { display: flex; justify-content: space-between; align-items: baseline; }
            .rp-ats-row strong { font-size: 10pt; font-weight: 700; }
            .rp-ats-row span { font-size: 9pt; }
            .rp-ats-sub { font-style: italic; font-size: 9pt; margin-bottom: 1px; }
            .rp-ats-text { font-size: 9pt; margin-top: 1px; color: black; line-height: 1.35; text-align: justify; }

            @media print {
              body { background: white; color: black; }
              @page { size: A4 portrait; margin: 0.4in; }
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  if (loading) return (
    <div className="rb-loading">
      <div className="spinner" />
      <p>Loading your data…</p>
    </div>
  );

  return (
    <div className="rb-page animate-fadeIn">
      {/* Header */}
      <div className="rb-page-header">
        <div className="rb-page-header-icon"><LuFileText /></div>
        <div>
          <h1>Resume Builder</h1>
          <p>Auto-filled from your IntelearnX profile · corporate ready · ATS optimized</p>
        </div>
        <div className="rb-header-actions">
          <button 
            className={`btn btn-secondary rb-boost-btn ${boostActive ? 'boosting' : ''}`}
            onClick={handleAtsBoost}
          >
            <LuZap /> One-Click ATS Boost
          </button>
          <button className="btn btn-primary rb-download-btn" onClick={handlePrint}>
            <LuDownload /> Download PDF
          </button>
        </div>
      </div>

      {/* Template Picker */}
      <div className="rb-templates">
        {TEMPLATES.map(t => (
          <button
            key={t.id}
            className={`rb-template-card ${template === t.id ? 'active' : ''}`}
            style={{ '--ta': t.accent }}
            onClick={() => setTemplate(t.id)}
          >
            <div className="rb-template-swatch" />
            <div className="rb-template-info">
              <span className="rb-template-name">{t.label}</span>
              <span className="rb-template-desc">{t.desc}</span>
            </div>
            {template === t.id && <LuCheck className="rb-template-check" />}
          </button>
        ))}
      </div>

      {/* Layout workspace */}
      <div className="rb-workspace">
        {/* Edit details panel */}
        <div className="rb-editor">
          
          {/* Beautiful Glassmorphic ATS Scoring Panel */}
          <div className="rb-ats-card glass">
            <div className="rb-ats-ring-wrap">
              <div 
                className="rb-ats-radial-meter"
                style={{
                  background: `conic-gradient(from 0deg, ${
                    atsScore >= 90 ? 'var(--success)' : atsScore >= 75 ? 'var(--warning)' : 'var(--danger)'
                  } ${atsScore * 3.6}deg, rgba(255,255,255,0.05) ${atsScore * 3.6}deg)`
                }}
              >
                <div className="rb-ats-radial-inner">
                  <span className="rb-ats-percentage">{atsScore}%</span>
                  <span className="rb-ats-lbl">ATS SCORE</span>
                </div>
              </div>
            </div>

            <div className="rb-ats-eval-info">
              <div className="rb-ats-status-row">
                <h4>ATS Optimization Engine</h4>
                <span className={`rb-ats-pill ${atsScore >= 90 ? 'opt-perfect' : atsScore >= 75 ? 'opt-warning' : 'opt-weak'}`}>
                  {atsScore >= 90 ? 'Excellent Match' : atsScore >= 75 ? 'Good Readability' : 'Action Required'}
                </span>
              </div>
              <p className="rb-ats-summary-desc">
                {atsScore >= 90 
                  ? 'Your resume structures, keywords, and typography conform perfectly to top corporate applicant scanners!'
                  : 'Optimize your formatting, skills, and descriptive verbs using the recommendations below to hit a >90% rating.'
                }
              </p>
            </div>

            <div className="rb-ats-feedback-box">
              <h5>optimization checklist</h5>
              <div className="rb-ats-checks">
                {atsFeedback.map((f, i) => (
                  <div key={i} className={`rb-ats-item ${f.type}`}>
                    <span className="rb-ats-item-icon">
                      {f.type === 'danger' && <LuTriangleAlert />}
                      {f.type === 'warning' && <LuTriangleAlert />}
                      {f.type === 'info' && <LuInfo />}
                    </span>
                    <span className="rb-ats-item-text">{f.text}</span>
                  </div>
                ))}
                {atsFeedback.length === 0 && (
                  <div className="rb-ats-item success">
                    <span className="rb-ats-item-icon"><LuShieldCheck /></span>
                    <span className="rb-ats-item-text">Outstanding! Every check is green. Excellent alignment with placement drives.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form details section list */}
          <Section title="Personal Info" icon={<LuUser />}>
            <div className="rb-grid-2">
              <Field label="Full Name" value={data.name || ''} onChange={v => update('name', v)} placeholder="Jane Doe" />
              <Field label="Job Title" value={data.title || ''} onChange={v => update('title', v)} placeholder="Full Stack Developer" />
              <Field label="Email" value={data.email || ''} onChange={v => update('email', v)} placeholder="jane@email.com" />
              <Field label="Phone" value={data.phone || ''} onChange={v => update('phone', v)} placeholder="+91 98765 43210" />
              <Field label="Location" value={data.location || ''} onChange={v => update('location', v)} placeholder="Bangalore, India" />
              <Field label="Website / Portfolio" value={data.website || ''} onChange={v => update('website', v)} placeholder="janedev.com" />
              <div className="rb-field-span-2">
                <Field label="LinkedIn Profile URL" value={data.linkedin || ''} onChange={v => update('linkedin', v)} placeholder="linkedin.com/in/jane" />
              </div>
              <div className="rb-field-span-2">
                <Field label="GitHub Profile URL" value={data.github || ''} onChange={v => update('github', v)} placeholder="github.com/jane" />
              </div>
              <div className="rb-field-full rb-field-span-2">
                <Field label="Professional Summary (ATS Optimized)" value={data.summary || ''} onChange={v => update('summary', v)} placeholder="Brief, high-impact description of technical qualifications and achievements…" multiline />
              </div>
            </div>
          </Section>

          <Section title="Education" icon={<LuGraduationCap />}>
            {(data.education || []).map((e, i) => (
              <div key={i} className="rb-list-item">
                <div className="rb-grid-2">
                  <Field label="Degree / Course" value={e.degree || ''} onChange={v => updateArr('education', i, 'degree', v)} placeholder="B.Tech Computer Science" />
                  <Field label="Institution" value={e.institution || ''} onChange={v => updateArr('education', i, 'institution', v)} placeholder="RV College of Engineering" />
                  <Field label="Graduation Year" value={e.year || ''} onChange={v => updateArr('education', i, 'year', v)} placeholder="2021 – 2025" />
                  <Field label="GPA / Percentage" value={e.gpa || ''} onChange={v => updateArr('education', i, 'gpa', v)} placeholder="8.5 / 10" />
                </div>
                <button className="rb-remove-btn" onClick={() => removeItem('education', i)}><LuTrash2 /> Remove Education</button>
              </div>
            ))}
            <button className="rb-add-btn" onClick={() => addItem('education', { degree: '', institution: '', year: '', gpa: '' })}>
              <LuPlus /> Add Education
            </button>
          </Section>

          <Section title="Professional Experience" icon={<LuBriefcase />}>
            {(data.experience || []).map((e, i) => (
              <div key={i} className="rb-list-item">
                <div className="rb-grid-2">
                  <Field label="Role / Position" value={e.role || ''} onChange={v => updateArr('experience', i, 'role', v)} placeholder="Frontend Developer Intern" />
                  <Field label="Company / Employer" value={e.company || ''} onChange={v => updateArr('experience', i, 'company', v)} placeholder="Acme Corp" />
                  <Field label="Duration" value={e.duration || ''} onChange={v => updateArr('experience', i, 'duration', v)} placeholder="Jun 2024 – Aug 2024" />
                  <Field label="Location" value={e.location || ''} onChange={v => updateArr('experience', i, 'location', v)} placeholder="Remote" />
                  <div className="rb-field-span-2">
                    <Field label="Key Deliverables (Quantified Metrics)" value={e.description || ''} onChange={v => updateArr('experience', i, 'description', v)} placeholder="Describe exact tasks, action verbs (Engineered, Optimized), and statistics (reduced latency by 20%)..." multiline />
                  </div>
                </div>
                <button className="rb-remove-btn" onClick={() => removeItem('experience', i)}><LuTrash2 /> Remove Experience</button>
              </div>
            ))}
            <button className="rb-add-btn" onClick={() => addItem('experience', { role: '', company: '', duration: '', location: '', description: '' })}>
              <LuPlus /> Add Work Experience
            </button>
          </Section>

          <Section title="Academic & Personal Projects" icon={<LuCode />}>
            {(data.projects || []).map((p, i) => (
              <div key={i} className="rb-list-item">
                <div className="rb-grid-2">
                  <Field label="Project Title" value={p.name || ''} onChange={v => updateArr('projects', i, 'name', v)} placeholder="IntelearnX Platform" />
                  <Field label="Technologies Used" value={p.tech || ''} onChange={v => updateArr('projects', i, 'tech', v)} placeholder="React, Firebase, CSS Modules" />
                  <div className="rb-field-span-2">
                    <Field label="Project URL / Repository" value={p.link || ''} onChange={v => updateArr('projects', i, 'link', v)} placeholder="github.com/jane/intelearnx" />
                  </div>
                  <div className="rb-field-span-2">
                    <Field label="Description (STAR Framework)" value={p.description || ''} onChange={v => updateArr('projects', i, 'description', v)} placeholder="Describe problem solved, technical action taken, and key result..." multiline />
                  </div>
                </div>
                <button className="rb-remove-btn" onClick={() => removeItem('projects', i)}><LuTrash2 /> Remove Project</button>
              </div>
            ))}
            <button className="rb-add-btn" onClick={() => addItem('projects', { name: '', tech: '', link: '', description: '' })}>
              <LuPlus /> Add Academic Project
            </button>
          </Section>

          <Section title="Technical Core Skills" icon={<LuSparkles />}>
            <div className="rb-skills-editor">
              {(data.skills || []).map((s, i) => (
                <div key={i} className="rb-skill-chip animate-scaleIn">
                  <input
                    className="rb-skill-input"
                    value={s}
                    onChange={e => {
                      const arr = [...(data.skills || [])];
                      arr[i] = e.target.value;
                      update('skills', arr);
                    }}
                  />
                  <button onClick={() => removeItem('skills', i)} title="Delete Skill"><LuTrash2 /></button>
                </div>
              ))}
              <button className="rb-add-btn rb-add-skill-inline" onClick={() => addItem('skills', '')}>
                <LuPlus /> Add Skill Keyword
              </button>
            </div>
          </Section>

          <Section title="Achievements & Certifications" icon={<LuGraduationCap />} defaultOpen={false}>
            {(data.achievements || []).map((a, i) => (
              <div key={i} className="rb-list-item">
                <div className="rb-grid-2">
                  <div className="rb-field-span-2">
                    <Field label="Achievement Title" value={a.title || ''} onChange={v => updateArr('achievements', i, 'title', v)} placeholder="First Place — National Hackathon 2024" />
                  </div>
                  <div className="rb-field-span-2">
                    <Field label="Brief Detail / Issuing Authority" value={a.description || ''} onChange={v => updateArr('achievements', i, 'description', v)} placeholder="Issued by Computer Society of India or key milestones achieved…" multiline />
                  </div>
                </div>
                <button className="rb-remove-btn" onClick={() => removeItem('achievements', i)}><LuTrash2 /> Remove Achievement</button>
              </div>
            ))}
            <button className="rb-add-btn" onClick={() => addItem('achievements', { title: '', description: '' })}>
              <LuPlus /> Add Achievement / Badge
            </button>
          </Section>

        </div>

        {/* Live preview panel */}
        <div className="rb-preview-panel">
          <div className="rb-preview-header-bar">
            <span className="rb-preview-dot dot-red"></span>
            <span className="rb-preview-dot dot-yellow"></span>
            <span className="rb-preview-dot dot-green"></span>
            <span className="rb-preview-hdr-title">Placement Resume Live Preview</span>
          </div>
          <div className="rb-preview-wrap" ref={printRef}>
            <ResumePreview data={data} template={template} />
          </div>
        </div>
      </div>
    </div>
  );
}
