import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../context/QuizContext';
import { LuBookOpen, LuArrowRight, LuBrain, LuMonitor, LuCode, LuCpu, LuBriefcase, LuStar, LuGauge } from 'react-icons/lu';
import './QuizSelect.css';

const SUBJECT_ICONS = {
  'Full Stack Web Development': <LuMonitor />,
  'DSA': <LuBrain />,
  'OOPs using Java': <LuCode />,
  'Software Engineering': <LuCpu />,
  'Finance': <LuBriefcase />,
};

const SUBJECT_COLORS = {
  'Full Stack Web Development': { bg: 'rgba(91,143,185,0.06)', border: 'rgba(91,143,185,0.15)', color: '#5B8FB9' },
  'DSA': { bg: 'rgba(224,165,70,0.06)', border: 'rgba(224,165,70,0.15)', color: '#E0A546' },
  'OOPs using Java': { bg: 'rgba(212,100,92,0.06)', border: 'rgba(212,100,92,0.15)', color: '#D4645C' },
  'Software Engineering': { bg: 'rgba(76,175,130,0.06)', border: 'rgba(76,175,130,0.15)', color: '#4CAF82' },
  'Finance': { bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
};

const DIFFICULTY_INFO = {
  easy: { label: 'Easy', desc: 'Basic concepts, great for revision', color: '#4CAF82', xpMult: '1x XP' },
  medium: { label: 'Medium', desc: 'Standard difficulty, good challenge', color: '#E0A546', xpMult: '1.2x XP' },
  hard: { label: 'Hard', desc: 'Advanced problems, maximum challenge', color: '#D4645C', xpMult: '1.5x XP' },
};

export default function QuizSelect() {
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [numQuestions, setNumQuestions] = useState(5);
  const { getSubjects, getTopics, startQuiz } = useQuiz();
  const navigate = useNavigate();

  const subjects = getSubjects();

  const handleStartQuiz = () => {
    if (!selectedSubject || !selectedTopic) return;
    const success = startQuiz(selectedSubject, selectedTopic, selectedDifficulty, numQuestions);
    if (success) navigate('/quiz/play');
  };

  return (
    <div className="quiz-select animate-fadeIn">
      <div className="page-header">
        <div className="page-header-icon">
          <LuBookOpen />
        </div>
        <div>
          <h1>Take a Quiz</h1>
          <p>Choose your subject, topic, and difficulty to start learning</p>
        </div>
      </div>

      {/* Step 1: Subject Selection */}
      <div className="select-section">
        <h2 className="select-section-title">
          <span className="step-badge">1</span>
          Choose Subject
        </h2>
        <div className="subject-grid">
          {subjects.map(subject => {
            const colors = SUBJECT_COLORS[subject];
            return (
              <button
                key={subject}
                className={`subject-card ${selectedSubject === subject ? 'active' : ''}`}
                onClick={() => { setSelectedSubject(subject); setSelectedTopic(null); }}
                style={{
                  '--card-bg': colors.bg,
                  '--card-border': colors.border,
                  '--card-color': colors.color,
                }}
                id={`subject-${subject.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="subject-icon">{SUBJECT_ICONS[subject]}</div>
                <span className="subject-name">{subject}</span>
                <span className="subject-topics-count">{getTopics(subject).length} topics</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Topic Selection */}
      {selectedSubject && (
        <div className="select-section animate-fadeInUp">
          <h2 className="select-section-title">
            <span className="step-badge">2</span>
            Choose Topic
          </h2>
          <div className="topic-grid">
            {getTopics(selectedSubject).map(topic => (
              <button
                key={topic}
                className={`topic-card ${selectedTopic === topic ? 'active' : ''}`}
                onClick={() => setSelectedTopic(topic)}
                id={`topic-${topic.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <LuStar className="topic-icon" />
                <span>{topic}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Difficulty & Settings */}
      {selectedTopic && (
        <div className="select-section animate-fadeInUp">
          <h2 className="select-section-title">
            <span className="step-badge">3</span>
            Settings
          </h2>

          <div className="settings-grid">
            <div className="difficulty-section">
              <label className="settings-label">
                <LuGauge /> Difficulty
              </label>
              <div className="difficulty-options">
                {Object.entries(DIFFICULTY_INFO).map(([key, info]) => (
                  <button
                    key={key}
                    className={`difficulty-btn ${selectedDifficulty === key ? 'active' : ''}`}
                    onClick={() => setSelectedDifficulty(key)}
                    style={{ '--diff-color': info.color }}
                    id={`difficulty-${key}`}
                  >
                    <span className="diff-label">{info.label}</span>
                    <span className="diff-desc">{info.desc}</span>
                    <span className="diff-xp">{info.xpMult}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="questions-section">
              <label className="settings-label">Number of Questions</label>
              <div className="questions-selector">
                {[3, 5, 8, 10].map(num => (
                  <button
                    key={num}
                    className={`question-count-btn ${numQuestions === num ? 'active' : ''}`}
                    onClick={() => setNumQuestions(num)}
                    id={`questions-${num}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="quiz-summary">
            <div className="summary-item">
              <span>Subject:</span>
              <strong>{selectedSubject}</strong>
            </div>
            <div className="summary-item">
              <span>Topic:</span>
              <strong>{selectedTopic}</strong>
            </div>
            <div className="summary-item">
              <span>Difficulty:</span>
              <strong style={{ color: DIFFICULTY_INFO[selectedDifficulty].color }}>
                {DIFFICULTY_INFO[selectedDifficulty].label}
              </strong>
            </div>
            <div className="summary-item">
              <span>Questions:</span>
              <strong>{numQuestions}</strong>
            </div>
          </div>

          <button className="btn btn-primary btn-lg start-quiz-btn" onClick={handleStartQuiz} id="start-quiz-btn">
            Start Quiz
            <LuArrowRight />
          </button>
        </div>
      )}
    </div>
  );
}
