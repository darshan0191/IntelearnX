import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useResumeData } from '../hooks/useResumeData';
import {
  LuFileText, LuDownload, LuUser, LuBriefcase, LuGraduationCap,
  LuCode, LuPlus, LuTrash2, LuChevronDown, LuChevronUp, LuSparkles,
  LuCheck, LuPalette,
} from 'react-icons/lu';
import './ResumeBuilder.css';

const TEMPLATES = [
  { id: 'classic',    label: 'Classic',    desc: 'Clean two-column layout',        accent: '#D4645C' },
  { id: 'modern',     label: 'Modern',     desc: 'Bold header, minimal body',       accent: '#5B8FB9' },
  { id: 'elegant',    label: 'Elegant',    desc: 'Serif typography, refined look',  accent: '#4CAF82' },
  { id: 'compact',    label: 'Compact',    desc: 'Dense, fits more on one page',    accent: '#E0A546' },
  { id: 'creative',   label: 'Creative',   desc: 'Sidebar accent, modern feel',     accent: '#a78bfa' },
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

/* ── Resume Preview Components ── */
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

function ModernPreview({ data, accent }) {
  return (
    <div className="rp-modern" style={{ '--ra': accent }}>
      <div className="rp-modern-header">
        <div>
          <h1>{data.name || 'Your Name'}</h1>
          <p className="rp-modern-title">{data.title || 'Software Developer'}</p>
        </div>
        <div className="rp-modern-contact">
          {[data.email, data.phone, data.location, data.linkedin, data.github].filter(Boolean).map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
      </div>
      <div className="rp-modern-body">
        {data.summary && <p className="rp-modern-summary">{data.summary}</p>}
        {data.skills?.length > 0 && (
          <div className="rp-block">
            <h3 className="rp-modern-section-title">Skills</h3>
            <div className="rp-skills">{data.skills.map((s, i) => <span key={i} className="rp-skill-tag">{s}</span>)}</div>
          </div>
        )}
        {data.experience?.length > 0 && (
          <div className="rp-block">
            <h3 className="rp-modern-section-title">Experience</h3>
            {data.experience.map((e, i) => (
              <div key={i} className="rp-entry">
                <div className="rp-entry-head"><strong>{e.role}</strong><span className="rp-entry-date">{e.duration}</span></div>
                <div className="rp-entry-sub">{e.company}</div>
                {e.description && <p className="rp-text">{e.description}</p>}
              </div>
            ))}
          </div>
        )}
        {data.education?.length > 0 && (
          <div className="rp-block">
            <h3 className="rp-modern-section-title">Education</h3>
            {data.education.map((e, i) => (
              <div key={i} className="rp-entry">
                <div className="rp-entry-head"><strong>{e.degree}</strong><span className="rp-entry-date">{e.year}</span></div>
                <div className="rp-entry-sub">{e.institution}{e.gpa ? ` · GPA ${e.gpa}` : ''}</div>
              </div>
            ))}
          </div>
        )}
        {data.projects?.length > 0 && (
          <div className="rp-block">
            <h3 className="rp-modern-section-title">Projects</h3>
            {data.projects.map((p, i) => (
              <div key={i} className="rp-entry">
                <div className="rp-entry-head"><strong>{p.name}</strong>{p.link && <a href={p.link} className="rp-link">{p.link}</a>}</div>
                {p.tech && <div className="rp-entry-sub">{p.tech}</div>}
                {p.description && <p className="rp-text">{p.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
              <div key={i} className="rp-entry"><strong>{a.title}</strong>{a.description && <p className="rp-text">{a.description}</p>}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResumePreview({ data, template }) {
  const tmpl = TEMPLATES.find(t => t.id === template) || TEMPLATES[0];
  if (template === 'modern' || template === 'compact' || template === 'elegant') return <ModernPreview data={data} accent={tmpl.accent} />;
  if (template === 'creative') return <CreativePreview data={data} accent={tmpl.accent} />;
  return <ClassicPreview data={data} accent={tmpl.accent} />;
}

export default function ResumeBuilder() {
  const { user } = useAuth();
  const { data, setData, loading } = useResumeData(user);
  const [template, setTemplate] = useState('classic');
  const [activeTab, setActiveTab] = useState('edit');
  const printRef = useRef();

  const update = (key, val) => setData(d => ({ ...d, [key]: val }));
  const updateArr = (key, idx, field, val) => setData(d => {
    const arr = [...(d[key] || [])];
    arr[idx] = { ...arr[idx], [field]: val };
    return { ...d, [key]: arr };
  });
  const addItem = (key, blank) => setData(d => ({ ...d, [key]: [...(d[key] || []), blank] }));
  const removeItem = (key, idx) => setData(d => ({ ...d, [key]: (d[key] || []).filter((_, i) => i !== idx) }));

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Resume — ${data.name || 'IntelearnX'}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #2E2B27; }
        ${document.querySelector('style[data-resume]')?.textContent || ''}
      </style></head>
      <body>${content}</body></html>
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
          <p>Auto-filled from your IntelearnX profile · choose a template · download</p>
        </div>
        <button className="btn btn-primary rb-download-btn" onClick={handlePrint}>
          <LuDownload /> Download PDF
        </button>
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

      {/* Tabs */}
      <div className="rb-tabs">
        <button className={`rb-tab ${activeTab === 'edit' ? 'active' : ''}`} onClick={() => setActiveTab('edit')}>
          <LuUser /> Edit Details
        </button>
        <button className={`rb-tab ${activeTab === 'preview' ? 'active' : ''}`} onClick={() => setActiveTab('preview')}>
          <LuFileText /> Preview
        </button>
      </div>

      <div className="rb-workspace">
        {/* ── Edit Panel ── */}
        <div className={`rb-editor ${activeTab !== 'edit' ? 'rb-mobile-hidden' : ''}`}>

            <Section title="Personal Info" icon={<LuUser />}>
              <div className="rb-grid-2">
                <Field label="Full Name" value={data.name || ''} onChange={v => update('name', v)} placeholder="Jane Doe" />
                <Field label="Job Title" value={data.title || ''} onChange={v => update('title', v)} placeholder="Full Stack Developer" />
                <Field label="Email" value={data.email || ''} onChange={v => update('email', v)} placeholder="jane@email.com" />
                <Field label="Phone" value={data.phone || ''} onChange={v => update('phone', v)} placeholder="+91 98765 43210" />
                <Field label="Location" value={data.location || ''} onChange={v => update('location', v)} placeholder="Bangalore, India" />
                <Field label="Website" value={data.website || ''} onChange={v => update('website', v)} placeholder="janedev.com" />
                <div className="rb-field-span-2">
                  <Field label="LinkedIn" value={data.linkedin || ''} onChange={v => update('linkedin', v)} placeholder="linkedin.com/in/jane" />
                </div>
                <div className="rb-field-span-2">
                  <Field label="GitHub" value={data.github || ''} onChange={v => update('github', v)} placeholder="github.com/jane" />
                </div>
                <div className="rb-field-full rb-field-span-2">
                  <Field label="Professional Summary" value={data.summary || ''} onChange={v => update('summary', v)} placeholder="Brief overview of your skills and goals…" multiline />
                </div>
              </div>
            </Section>

            <Section title="Education" icon={<LuGraduationCap />}>
              {(data.education || []).map((e, i) => (
                <div key={i} className="rb-list-item">
                  <div className="rb-grid-2">
                    <Field label="Degree / Course" value={e.degree || ''} onChange={v => updateArr('education', i, 'degree', v)} placeholder="B.Tech Computer Science" />
                    <Field label="Institution" value={e.institution || ''} onChange={v => updateArr('education', i, 'institution', v)} placeholder="RV College of Engineering" />
                    <Field label="Year" value={e.year || ''} onChange={v => updateArr('education', i, 'year', v)} placeholder="2021 – 2025" />
                    <Field label="GPA / Percentage" value={e.gpa || ''} onChange={v => updateArr('education', i, 'gpa', v)} placeholder="8.5 / 10" />
                  </div>
                  <button className="rb-remove-btn" onClick={() => removeItem('education', i)}><LuTrash2 /> Remove</button>
                </div>
              ))}
              <button className="rb-add-btn" onClick={() => addItem('education', { degree: '', institution: '', year: '', gpa: '' })}>
                <LuPlus /> Add Education
              </button>
            </Section>

            <Section title="Experience" icon={<LuBriefcase />}>
              {(data.experience || []).map((e, i) => (
                <div key={i} className="rb-list-item">
                  <div className="rb-grid-2">
                    <Field label="Role / Position" value={e.role || ''} onChange={v => updateArr('experience', i, 'role', v)} placeholder="Frontend Developer Intern" />
                    <Field label="Company" value={e.company || ''} onChange={v => updateArr('experience', i, 'company', v)} placeholder="Acme Corp" />
                    <Field label="Duration" value={e.duration || ''} onChange={v => updateArr('experience', i, 'duration', v)} placeholder="Jun 2024 – Aug 2024" />
                    <Field label="Location" value={e.location || ''} onChange={v => updateArr('experience', i, 'location', v)} placeholder="Remote" />
                    <div className="rb-field-span-2">
                      <Field label="Description" value={e.description || ''} onChange={v => updateArr('experience', i, 'description', v)} placeholder="Key responsibilities and achievements…" multiline />
                    </div>
                  </div>
                  <button className="rb-remove-btn" onClick={() => removeItem('experience', i)}><LuTrash2 /> Remove</button>
                </div>
              ))}
              <button className="rb-add-btn" onClick={() => addItem('experience', { role: '', company: '', duration: '', location: '', description: '' })}>
                <LuPlus /> Add Experience
              </button>
            </Section>

            <Section title="Projects" icon={<LuCode />}>
              {(data.projects || []).map((p, i) => (
                <div key={i} className="rb-list-item">
                  <div className="rb-grid-2">
                    <Field label="Project Name" value={p.name || ''} onChange={v => updateArr('projects', i, 'name', v)} placeholder="IntelearnX" />
                    <Field label="Tech Stack" value={p.tech || ''} onChange={v => updateArr('projects', i, 'tech', v)} placeholder="React, Firebase, Node.js" />
                    <div className="rb-field-span-2">
                      <Field label="Link" value={p.link || ''} onChange={v => updateArr('projects', i, 'link', v)} placeholder="github.com/jane/project" />
                    </div>
                    <div className="rb-field-span-2">
                      <Field label="Description" value={p.description || ''} onChange={v => updateArr('projects', i, 'description', v)} placeholder="What it does and your role…" multiline />
                    </div>
                  </div>
                  <button className="rb-remove-btn" onClick={() => removeItem('projects', i)}><LuTrash2 /> Remove</button>
                </div>
              ))}
              <button className="rb-add-btn" onClick={() => addItem('projects', { name: '', tech: '', link: '', description: '' })}>
                <LuPlus /> Add Project
              </button>
            </Section>

            <Section title="Skills" icon={<LuSparkles />}>
              <div className="rb-skills-editor">
                {(data.skills || []).map((s, i) => (
                  <div key={i} className="rb-skill-chip">
                    <input
                      className="rb-skill-input"
                      value={s}
                      onChange={e => {
                        const arr = [...(data.skills || [])];
                        arr[i] = e.target.value;
                        update('skills', arr);
                      }}
                    />
                    <button onClick={() => removeItem('skills', i)}><LuTrash2 /></button>
                  </div>
                ))}
                <button className="rb-add-btn" onClick={() => addItem('skills', '')}>
                  <LuPlus /> Add Skill
                </button>
              </div>
            </Section>

            <Section title="Achievements & Certifications" icon={<LuGraduationCap />} defaultOpen={false}>
              {(data.achievements || []).map((a, i) => (
                <div key={i} className="rb-list-item">
                  <div className="rb-grid-2">
                    <div className="rb-field-span-2">
                      <Field label="Title" value={a.title || ''} onChange={v => updateArr('achievements', i, 'title', v)} placeholder="Winner — Hackathon 2024" />
                    </div>
                    <div className="rb-field-span-2">
                      <Field label="Description" value={a.description || ''} onChange={v => updateArr('achievements', i, 'description', v)} placeholder="Brief detail…" multiline />
                    </div>
                  </div>
                  <button className="rb-remove-btn" onClick={() => removeItem('achievements', i)}><LuTrash2 /> Remove</button>
                </div>
              ))}
              <button className="rb-add-btn" onClick={() => addItem('achievements', { title: '', description: '' })}>
                <LuPlus /> Add Achievement
              </button>
            </Section>

        </div>

        {/* ── Preview Panel ── */}
        <div className={`rb-preview-panel ${activeTab !== 'preview' ? 'rb-mobile-hidden' : ''}`}>
          <div className="rb-preview-wrap" ref={printRef}>
            <ResumePreview data={data} template={template} />
          </div>
        </div>
      </div>
    </div>
  );
}
