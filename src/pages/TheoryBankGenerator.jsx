import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { generateTheoryBank, formatQuestionsAsText } from '../services/theoryBankService';
import {
  LuUpload, LuFileText, LuX, LuLoader, LuCircleCheck,
  LuCircleX, LuSparkles, LuClipboard, LuDownload,
  LuRotateCcw, LuChevronDown, LuPlus, LuHash,
  LuBookOpen, LuCheck, LuArrowUp,
} from 'react-icons/lu';
import './TheoryBankGenerator.css';

const STEPS = {
  UPLOAD: 'upload',
  GENERATING: 'generating',
  RESULTS: 'results',
};

const MAX_FILES = 10;

export default function TheoryBankGenerator() {
  const { user } = useAuth();
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [result, setResult] = useState(null);
  const [expandedAnswers, setExpandedAnswers] = useState({});
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);

  // ── File Handlers ──
  const addFiles = (newFiles) => {
    const pdfFiles = Array.from(newFiles).filter((f) => f.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      setError('Please upload PDF files only.');
      return;
    }

    const oversized = pdfFiles.find((f) => f.size > 10 * 1024 * 1024);
    if (oversized) {
      setError(`"${oversized.name}" exceeds 10 MB limit.`);
      return;
    }

    setFiles((prev) => {
      const combined = [...prev, ...pdfFiles];
      if (combined.length > MAX_FILES) {
        setError(`Maximum ${MAX_FILES} PDFs allowed. Extra files were not added.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
    setError('');
  };

  const handleFileSelect = (e) => {
    if (e.target.files) addFiles(e.target.files);
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setError('');
  };

  // ── Generate ──
  const handleGenerate = async () => {
    if (files.length === 0) return;
    setStep(STEPS.GENERATING);
    setError('');
    setProgressMsg('Preparing PDFs…');
    setProgressPct(0);

    try {
      const data = await generateTheoryBank(files, (msg, pct) => {
        setProgressMsg(msg);
        setProgressPct(pct);
      });
      setResult(data);
      setExpandedAnswers({});
      setStep(STEPS.RESULTS);
    } catch (err) {
      setError(err.message || 'Failed to generate question bank.');
      setStep(STEPS.UPLOAD);
    }
  };

  // ── Answer Toggle ──
  const toggleAnswer = (id) => {
    setExpandedAnswers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Copy All ──
  const handleCopyAll = async () => {
    if (!result) return;
    const text = formatQuestionsAsText(result.questions, result.sourceFiles);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // ── Download as PDF ──
  const handleDownloadPdf = (includeAnswers = false) => {
    if (!result) return;
    const printWindow = window.open('', '_blank');
    const title = includeAnswers ? 'Theory Question Bank (Solution Key)' : 'Theory Question Bank (Examination)';
    
    // Construct HTML questions
    const questionsHtml = result.questions.map((q) => `
      <div class="q-item">
        <div class="q-header">
          <span class="q-number">Question ${q.id}</span>
          <span class="q-meta">[Topic: ${q.topic} | Difficulty: ${q.difficulty.toUpperCase()} | Marks: ${q.marks}]</span>
        </div>
        <p class="q-text">${q.question}</p>
        ${includeAnswers ? `
          <div class="ans-block">
            <strong>Expected Answer / Solution Key:</strong>
            <p>${q.expectedAnswer}</p>
          </div>
        ` : ''}
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Times New Roman', Georgia, serif; line-height: 1.5; color: black; padding: 0.5in; background: white; }
            
            /* Educational Header */
            .exam-header { text-align: center; border-bottom: 3px double black; padding-bottom: 12px; margin-bottom: 20pt; }
            .exam-header h1 { font-size: 18pt; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
            .exam-header h2 { font-size: 12pt; font-weight: 600; color: #333; margin-bottom: 6px; }
            .exam-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 10pt; text-align: left; margin-top: 10px; border-top: 1px solid #ddd; padding-top: 8px; }
            
            /* Questions */
            .q-item { margin-bottom: 18pt; page-break-inside: avoid; }
            .q-header { display: flex; justify-content: space-between; font-weight: bold; border-bottom: 0.5px solid #bbb; padding-bottom: 2px; margin-bottom: 6px; font-size: 10pt; }
            .q-number { font-size: 10.5pt; }
            .q-meta { font-size: 8.5pt; font-style: italic; color: #444; }
            .q-text { font-size: 11pt; text-align: justify; margin-top: 4px; }
            
            /* Answers Solution block */
            .ans-block { margin-top: 8px; padding: 10px; border-left: 3px solid black; background: #f9f9f9; font-size: 10pt; }
            .ans-block strong { font-size: 9pt; text-transform: uppercase; color: #111; display: block; margin-bottom: 4px; }
            .ans-block p { text-align: justify; line-height: 1.4; color: #222; }
            
            @media print {
              body { padding: 0; }
              @page { size: A4 portrait; margin: 0.5in; }
            }
          </style>
        </head>
        <body>
          <div class="exam-header">
            <h1>IntelearnX Assessment Platform</h1>
            <h2>${includeAnswers ? 'Theory Question Bank (Official Solution Key)' : 'Theory Assessment (Examination Paper)'}</h2>
            <div class="exam-meta-grid">
              <div><strong>Generated From:</strong> ${result.sourceFiles.map(f => f.name).join(', ')}</div>
              <div><strong>Total Questions:</strong> ${result.totalGenerated}</div>
              <div><strong>Subject Category:</strong> Theory Question Bank</div>
              <div><strong>Date Generated:</strong> ${new Date().toLocaleDateString()}</div>
            </div>
          </div>
          <div class="question-container">
            ${questionsHtml}
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

  // ── Download as Text ──
  const handleDownloadTxt = () => {
    if (!result) return;
    const text = formatQuestionsAsText(result.questions, result.sourceFiles);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IntelearnX_Theory_Bank_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Download as JSON ──
  const handleDownloadJson = () => {
    if (!result) return;
    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IntelearnX_Theory_Bank_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Restart ──
  const restart = () => {
    setStep(STEPS.UPLOAD);
    setFiles([]);
    setResult(null);
    setExpandedAnswers({});
    setError('');
    setProgressMsg('');
    setProgressPct(0);
  };

  // ── Counts ──
  const getCounts = () => {
    if (!result) return { easy: 0, medium: 0, hard: 0 };
    return {
      easy: result.questions.filter((q) => q.difficulty === 'easy').length,
      medium: result.questions.filter((q) => q.difficulty === 'medium').length,
      hard: result.questions.filter((q) => q.difficulty === 'hard').length,
    };
  };

  return (
    <div className="tb-page animate-fadeInUp">
      {/* Header */}
      <div className="tb-header">
        <div className="tb-header-icon"><LuBookOpen /></div>
        <div>
          <h1>Theory Bank Generator</h1>
          <p>Upload PDFs and let AI generate 100 theory questions for your question bank</p>
        </div>
      </div>

      {/* ──── UPLOAD STEP ──── */}
      {step === STEPS.UPLOAD && (
        <div className="tb-upload-section animate-fadeInUp">
          {/* Dropzone */}
          <div
            className={`tb-dropzone ${files.length > 0 ? 'has-files' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => files.length === 0 && fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileSelect}
              hidden
            />

            {files.length === 0 ? (
              <>
                <div className="tb-dropzone-icon"><LuUpload /></div>
                <p className="tb-dropzone-title">Drop your PDFs here</p>
                <p className="tb-dropzone-sub">or click to browse · Up to 10 PDFs · Max 10 MB each</p>
              </>
            ) : (
              <div className="tb-file-list">
                {files.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="tb-file-item">
                    <LuFileText className="tb-file-item-icon" />
                    <div className="tb-file-item-info">
                      <span className="tb-file-item-name">{file.name}</span>
                      <span className="tb-file-item-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <button
                      className="tb-file-item-remove"
                      onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                    >
                      <LuX />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File count & add more */}
          {files.length > 0 && (
            <>
              <div className="tb-file-count">
                <strong>{files.length}</strong> / {MAX_FILES} PDFs selected
              </div>
              {files.length < MAX_FILES && (
                <button
                  className="tb-add-more-btn"
                  onClick={() => fileRef.current?.click()}
                >
                  <LuPlus /> Add More PDFs
                </button>
              )}
            </>
          )}

          {error && <div className="tb-error"><LuCircleX /> {error}</div>}

          {/* Generate Button */}
          <button
            className="btn btn-primary btn-lg tb-generate-btn"
            onClick={handleGenerate}
            disabled={files.length === 0}
          >
            <LuSparkles />
            Generate 100 Theory Questions
            <span className="tb-btn-sub">· AI-powered</span>
          </button>
        </div>
      )}

      {/* ──── GENERATING STEP ──── */}
      {step === STEPS.GENERATING && (
        <div className="tb-generating animate-fadeInUp">
          <div className="tb-generating-card">
            <div className="spinner" />
            <h3>{progressMsg}</h3>
            <p>Generating your theory question bank — this may take 1–2 minutes</p>

            <div className="tb-progress-bar">
              <div className="tb-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>

            <div className="tb-gen-steps">
              <div className={`tb-gen-step ${progressPct >= 20 ? 'done' : progressPct > 0 ? 'active' : ''}`}>
                {progressPct >= 20 ? <LuCircleCheck /> : progressPct > 0 ? <LuLoader className="pq-spin" /> : <span>○</span>}
                Extracting text from PDFs
              </div>
              <div className={`tb-gen-step ${progressPct >= 90 ? 'done' : progressPct >= 25 ? 'active' : ''}`}>
                {progressPct >= 90 ? <LuCircleCheck /> : progressPct >= 25 ? <LuLoader className="pq-spin" /> : <span>○</span>}
                AI generating theory questions
              </div>
              <div className={`tb-gen-step ${progressPct >= 100 ? 'done' : progressPct >= 92 ? 'active' : ''}`}>
                {progressPct >= 100 ? <LuCircleCheck /> : progressPct >= 92 ? <LuLoader className="pq-spin" /> : <span>○</span>}
                Finalizing question bank
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──── RESULTS STEP ──── */}
      {step === STEPS.RESULTS && result && (
        <div className="tb-results animate-fadeInUp">
          {/* Results Header */}
          <div className="tb-results-header">
            <div className="tb-results-info">
              <h2>📝 Theory Question Bank</h2>
              <p>{result.totalGenerated} questions generated from {result.sourceFiles.length} PDF{result.sourceFiles.length > 1 ? 's' : ''}</p>
            </div>
            <div className="tb-results-stats">
              <span className="tb-stat-pill easy"><LuHash /> {getCounts().easy} Easy</span>
              <span className="tb-stat-pill medium"><LuHash /> {getCounts().medium} Medium</span>
              <span className="tb-stat-pill hard"><LuHash /> {getCounts().hard} Hard</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="tb-actions">
            <button className="btn btn-primary" onClick={handleCopyAll}>
              {copied ? <><LuCheck /> Copied!</> : <><LuClipboard /> Copy All</>}
            </button>
            <button className="btn btn-secondary" onClick={() => handleDownloadPdf(false)}>
              <LuDownload /> Download PDF (Exam)
            </button>
            <button className="btn btn-secondary" onClick={() => handleDownloadPdf(true)}>
              <LuDownload /> Download PDF (Solution Key)
            </button>
            <button className="btn btn-secondary" onClick={handleDownloadTxt}>
              <LuDownload /> Download .txt
            </button>
            <button className="btn btn-secondary" onClick={handleDownloadJson}>
              <LuDownload /> Download .json
            </button>
          </div>

          {/* Question List */}
          <div className="tb-question-list">
            {result.questions.map((q) => (
              <div key={q.id} className="tb-q-card" style={{ animationDelay: `${Math.min(q.id * 20, 400)}ms` }}>
                <div className="tb-q-card-header">
                  <span className="tb-q-num">{q.id}</span>
                  <div className="tb-q-badges">
                    <span className="tb-q-badge topic">{q.topic}</span>
                    <span className={`tb-q-badge ${q.difficulty}`}>
                      {q.difficulty === 'easy' ? '★ Easy' : q.difficulty === 'hard' ? '★★★ Hard' : '★★ Medium'}
                    </span>
                  </div>
                  <span className="tb-q-marks">{q.marks} marks</span>
                </div>

                <p className="tb-q-text">{q.question}</p>

                <button
                  className={`tb-answer-toggle ${expandedAnswers[q.id] ? 'open' : ''}`}
                  onClick={() => toggleAnswer(q.id)}
                >
                  <LuChevronDown />
                  {expandedAnswers[q.id] ? 'Hide Expected Answer' : 'Show Expected Answer'}
                </button>

                {expandedAnswers[q.id] && (
                  <div className="tb-answer-content">
                    {q.expectedAnswer}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="tb-result-footer">
            <button className="btn btn-primary btn-lg" onClick={restart}>
              <LuRotateCcw /> Generate New Bank
            </button>
            <button 
              className="btn btn-secondary btn-lg tb-top-btn" 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <LuArrowUp /> Back to Top
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
