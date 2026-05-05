import { useState, useEffect, useRef, useCallback } from 'react';
import { RACE_QUESTIONS } from '../data/gameQuestions';
import './AlgorithmRace.css';

const TOTAL_Q  = RACE_QUESTIONS.length;
const BOOST    = 100 / TOTAL_Q;       // % per correct answer
const PENALTY  = BOOST * 0.35;        // % penalty for wrong
const AI_SPEED = 7.5;                 // % per second — tuned so player can win

export default function AlgorithmRace({ onBack }) {
  const [phase,     setPhase]     = useState('idle');
  const [qIdx,      setQIdx]      = useState(0);
  const [score,     setScore]     = useState(0);
  const [playerPos, setPlayerPos] = useState(0);
  const [aiPos,     setAiPos]     = useState(0);
  const [feedback,  setFeedback]  = useState(null);
  const [winner,    setWinner]    = useState(null);
  const [answered,  setAnswered]  = useState(false);

  const aiRafRef   = useRef(null);
  const lastTsRef  = useRef(null);
  const aiPosRef   = useRef(0);
  const playerPosRef = useRef(0);
  const phaseRef   = useRef('idle');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(aiRafRef.current);
    };
  }, []);

  const startAI = useCallback(() => {
    cancelAnimationFrame(aiRafRef.current);
    lastTsRef.current = null;

    function tick(ts) {
      if (!mountedRef.current || phaseRef.current !== 'playing') return;
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.1);
      lastTsRef.current = ts;

      aiPosRef.current = Math.min(aiPosRef.current + AI_SPEED * dt, 100);
      setAiPos(aiPosRef.current);

      if (aiPosRef.current >= 100) {
        phaseRef.current = 'over';
        setWinner('ai');
        setPhase('over');
        return;
      }
      aiRafRef.current = requestAnimationFrame(tick);
    }
    aiRafRef.current = requestAnimationFrame(tick);
  }, []);

  const startGame = () => {
    cancelAnimationFrame(aiRafRef.current);
    aiPosRef.current    = 0;
    playerPosRef.current = 0;
    phaseRef.current    = 'playing';
    setPlayerPos(0); setAiPos(0);
    setQIdx(0); setScore(0);
    setFeedback(null); setWinner(null); setAnswered(false);
    setPhase('playing');
    startAI();
  };

  const handleAnswer = (option) => {
    if (answered || phaseRef.current !== 'playing') return;
    setAnswered(true);

    const q       = RACE_QUESTIONS[qIdx];
    const correct = option === q.answer;

    if (correct) {
      const np = Math.min(playerPosRef.current + BOOST, 100);
      playerPosRef.current = np;
      setPlayerPos(np);
      setScore(s => s + 20);
      setFeedback('correct');

      if (np >= 100) {
        cancelAnimationFrame(aiRafRef.current);
        phaseRef.current = 'over';
        setWinner('player');
        setPhase('over');
        return;
      }
    } else {
      const np = Math.max(playerPosRef.current - PENALTY, 0);
      playerPosRef.current = np;
      setPlayerPos(np);
      setFeedback('wrong');
    }

    setTimeout(() => {
      if (!mountedRef.current) return;
      setFeedback(null);
      setAnswered(false);
      const next = qIdx + 1;
      if (next >= TOTAL_Q) {
        cancelAnimationFrame(aiRafRef.current);
        phaseRef.current = 'over';
        setWinner(playerPosRef.current >= aiPosRef.current ? 'player' : 'ai');
        setPhase('over');
      } else {
        setQIdx(next);
      }
    }, 750);
  };

  const q = RACE_QUESTIONS[qIdx % TOTAL_Q];

  return (
    <div className="ar-root">

      {phase === 'idle' && (
        <div className="ar-screen">
          <div className="ar-screen-icon">🏎️</div>
          <h2>Algorithm Race</h2>
          <p>Answer correctly to speed up — wrong answers slow you down. Beat the AI!</p>
          <div className="ar-rules">
            <span>✅ Correct → Boost</span>
            <span>❌ Wrong → Slow</span>
            <span>🤖 Beat the AI</span>
          </div>
          <button className="ar-start-btn" onClick={startGame}>Start Race</button>
          <button className="ar-ghost-btn" onClick={onBack}>← Back to Games</button>
        </div>
      )}

      {phase === 'over' && (
        <div className="ar-screen">
          <div className="ar-screen-icon">{winner === 'player' ? '🏆' : '😅'}</div>
          <h2>{winner === 'player' ? 'You Won!' : 'AI Wins!'}</h2>
          <p className="ar-final">{winner === 'player' ? `Score: ${score} pts` : 'Better luck next time!'}</p>
          <div className="ar-result-bars">
            <div className="ar-result-row">
              <span>You</span>
              <div className="ar-result-bar-wrap">
                <div className="ar-result-bar ar-result-player" style={{ width: `${playerPosRef.current}%` }} />
              </div>
              <span>{Math.round(playerPosRef.current)}%</span>
            </div>
            <div className="ar-result-row">
              <span>AI</span>
              <div className="ar-result-bar-wrap">
                <div className="ar-result-bar ar-result-ai" style={{ width: `${aiPosRef.current}%` }} />
              </div>
              <span>{Math.round(aiPosRef.current)}%</span>
            </div>
          </div>
          <button className="ar-start-btn" onClick={startGame}>Race Again</button>
          <button className="ar-ghost-btn" onClick={onBack}>← Back to Games</button>
        </div>
      )}

      {phase === 'playing' && (
        <>
          <div className="ar-hud">
            <span className="ar-score">🏎️ {score} pts</span>
            <span className="ar-progress">Q {qIdx + 1} / {TOTAL_Q}</span>
            <button className="ar-back-btn" onClick={() => { cancelAnimationFrame(aiRafRef.current); onBack(); }}>✕</button>
          </div>

          {/* Race Track */}
          <div className="ar-track-section">
            <div className="ar-lane">
              <span className="ar-lane-label">You</span>
              <div className="ar-lane-track">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="ar-dash" style={{ left: `${i * 10 + 1}%` }} />
                ))}
                <div
                  className="ar-car ar-player-car"
                  style={{ left: `calc(${playerPos}% - 20px)` }}
                >
                  🏎️
                  {feedback === 'correct' && <span className="ar-boost">+BOOST!</span>}
                  {feedback === 'wrong'   && <span className="ar-slow">-SLOW</span>}
                </div>
                <div className="ar-finish-flag">🏁</div>
              </div>
              <span className="ar-pct">{Math.round(playerPos)}%</span>
            </div>

            <div className="ar-lane">
              <span className="ar-lane-label ar-ai-label">AI 🤖</span>
              <div className="ar-lane-track ar-ai-track">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="ar-dash" style={{ left: `${i * 10 + 1}%` }} />
                ))}
                <div
                  className="ar-car ar-ai-car"
                  style={{ left: `calc(${aiPos}% - 20px)` }}
                >
                  🚗
                </div>
                <div className="ar-finish-flag">🏁</div>
              </div>
              <span className="ar-pct">{Math.round(aiPos)}%</span>
            </div>
          </div>

          {/* Question */}
          <div className="ar-question-section">
            <div className="ar-question-card">
              <p className="ar-q-text">{q.q}</p>
              <div className="ar-options">
                {q.options.map((opt, i) => (
                  <button
                    key={i}
                    className={`ar-option
                      ${answered && opt === q.answer ? 'ar-opt-correct' : ''}
                      ${answered && feedback === 'wrong' && opt !== q.answer ? 'ar-opt-dim' : ''}
                    `}
                    onClick={() => handleAnswer(opt)}
                    disabled={answered}
                  >
                    <span className="ar-opt-letter">{String.fromCharCode(65 + i)}</span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
