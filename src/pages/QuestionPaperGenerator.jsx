import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { generateQuestionPaperSets, PAPER_FORMATS } from '../services/questionPaperService';
import {
  LuUpload, LuFileText, LuX, LuLoader, LuCircleCheck,
  LuCircleX, LuSparkles, LuDownload, LuRotateCcw,
  LuPrinter, LuFileStack, LuChevronRight, LuBookOpen
} from 'react-icons/lu';
import './QuestionPaperGenerator.css';

const STEPS = {
  UPLOAD: 'upload',
  GENERATING: 'generating',
  RESULTS: 'results',
};

export default function QuestionPaperGenerator() {
  const { user } = useAuth();
  const [step, setStep] = useState(STEPS.UPLOAD);
  const [files, setFiles] = useState([]);
  const [format, setFormat] = useState(PAPER_FORMATS.FORMAT_30);
  const [error, setError] = useState('');
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [sets, setSets] = useState([]);
  const fileRef = useRef(null);

  const addFiles = (newFiles) => {
    const pdfFiles = Array.from(newFiles).filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      setError('Please upload PDF files only.');
      return;
    }
    setFiles(prev => [...prev, ...pdfFiles].slice(0, 10));
    setError('');
  };

  const handleGenerate = async () => {
    if (files.length === 0) return;
    setStep(STEPS.GENERATING);
    setError('');
    try {
      const data = await generateQuestionPaperSets(files, format, (msg, pct) => {
        setProgressMsg(msg);
        setProgressPct(pct);
      });
      setSets(data);
      setStep(STEPS.RESULTS);
    } catch (err) {
      setError(err.message || 'Generation failed');
      setStep(STEPS.UPLOAD);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="qp-page animate-fadeInUp">
      <div className="qp-header no-print">
        <div className="qp-header-icon"><LuFileStack /></div>
        <div>
          <h1>Question Paper Set Generator</h1>
          <p>Generate 3 sets of formal question papers from your study material</p>
        </div>
      </div>

      {step === STEPS.UPLOAD && (
        <div className="qp-upload-section animate-fadeInUp no-print">
          <div className="qp-format-selector">
            <h3>Select Paper Format</h3>
            <div className="qp-format-options">
              <button 
                className={`qp-format-btn ${format === PAPER_FORMATS.FORMAT_30 ? 'active' : ''}`}
                onClick={() => setFormat(PAPER_FORMATS.FORMAT_30)}
              >
                <strong>30 Marks</strong>
                <span>Q1(8m x 2) + Q2(7m x 2)</span>
              </button>
              <button 
                className={`qp-format-btn ${format === PAPER_FORMATS.FORMAT_50 ? 'active' : ''}`}
                onClick={() => setFormat(PAPER_FORMATS.FORMAT_50)}
              >
                <strong>50 Marks</strong>
                <span>Q1(8m) + Q2(8m) + Q3(6m)</span>
              </button>
            </div>
          </div>

          <div 
            className="qp-dropzone"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          >
            <input ref={fileRef} type="file" accept=".pdf" multiple onChange={e => addFiles(e.target.files)} hidden />
            <LuUpload />
            <p>Drop PDFs here or click to browse (Max 10)</p>
          </div>

          {files.length > 0 && (
            <div className="qp-file-list">
              {files.map((f, i) => (
                <div key={i} className="qp-file-item">
                  <LuFileText /> <span>{f.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, idx) => idx !== i)); }}><LuX /></button>
                </div>
              ))}
            </div>
          )}

          {error && <div className="qp-error"><LuCircleX /> {error}</div>}

          <button className="btn btn-primary btn-lg qp-gen-btn" onClick={handleGenerate} disabled={files.length === 0}>
            <LuSparkles /> Generate 3 Sets Now
          </button>
        </div>
      )}

      {step === STEPS.GENERATING && (
        <div className="qp-generating no-print">
          <LuLoader className="pq-spin" />
          <h3>{progressMsg}</h3>
          <div className="qp-progress-bar"><div style={{ width: `${progressPct}%` }} /></div>
        </div>
      )}

      {step === STEPS.RESULTS && (
        <div className="qp-results animate-fadeInUp">
          <div className="qp-actions no-print">
            <button className="btn btn-primary" onClick={handlePrint}><LuPrinter /> Print / Save as PDF</button>
            <button className="btn btn-secondary" onClick={() => setStep(STEPS.UPLOAD)}><LuRotateCcw /> Restart</button>
          </div>

          <div className="qp-sets-container">
            {sets.map((set, idx) => (
              <div key={idx} className="qp-paper-sheet">
                <div className="qp-paper-header">
                  <div className="qp-university">INTELEARNX ACADEMIC PORTAL</div>
                  <div className="qp-exam-info">
                    <div><strong>Subject:</strong> ____________________</div>
                    <div><strong>Set:</strong> {set.setLabel}</div>
                  </div>
                  <div className="qp-exam-meta">
                    <span><strong>Time:</strong> {format === PAPER_FORMATS.FORMAT_30 ? '1.5 Hours' : '2.5 Hours'}</span>
                    <span><strong>Max Marks:</strong> {format === PAPER_FORMATS.FORMAT_30 ? '30' : '50'}</span>
                  </div>
                  <hr />
                </div>

                <div className="qp-instructions">
                  <strong>Instructions:</strong>
                  <ul>
                    <li>Answer questions as per the internal choice provided in each section.</li>
                    <li>Figures to the right indicate full marks.</li>
                  </ul>
                </div>

                <div className="qp-section">
                  <div className="qp-section-title">SECTION 1 (Q1) — Answer any TWO [2 x 8 = 16 Marks]</div>
                  {set.data.q1.map((q, i) => (
                    <div key={i} className="qp-question">
                      <span className="qp-q-num">1.{i+1}</span>
                      <span className="qp-q-text">{q.question}</span>
                      <span className="qp-q-marks">({q.marks})</span>
                    </div>
                  ))}
                </div>

                <div className="qp-section">
                  <div className="qp-section-title">
                    SECTION 2 (Q2) — Answer any TWO [{format === PAPER_FORMATS.FORMAT_30 ? '2 x 7 = 14' : '2 x 8 = 16'} Marks]
                  </div>
                  {set.data.q2.map((q, i) => (
                    <div key={i} className="qp-question">
                      <span className="qp-q-num">2.{i+1}</span>
                      <span className="qp-q-text">{q.question}</span>
                      <span className="qp-q-marks">({q.marks})</span>
                    </div>
                  ))}
                </div>

                {set.data.q3 && (
                  <div className="qp-section">
                    <div className="qp-section-title">SECTION 3 (Q3) — Answer any THREE [3 x 6 = 18 Marks]</div>
                    {set.data.q3.map((q, i) => (
                      <div key={i} className="qp-question">
                        <span className="qp-q-num">3.{i+1}</span>
                        <span className="qp-q-text">{q.question}</span>
                        <span className="qp-q-marks">({q.marks})</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="qp-paper-footer">--- End of Question Paper (Set {set.setLabel}) ---</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
