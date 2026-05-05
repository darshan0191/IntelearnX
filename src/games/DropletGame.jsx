import { useState, useEffect, useRef, useCallback } from 'react';
import { DSA_QUESTIONS } from '../data/gameQuestions';
import './DropletGame.css';

const LIVES     = 3;
const BASE_SPEED = 1.2;
const SPEED_INC  = 0.3;
const GAME_HEIGHT = 520; // fixed px — no window dependency

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

export default function DropletGame({ onBack }) {
  const [phase,    setPhase]    = useState('idle');
  const [score,    setScore]    = useState(0);
  const [lives,    setLives]    = useState(LIVES);
  const [level,    setLevel]    = useState(1);
  const [question, setQuestion] = useState(null);
  const [droplets, setDroplets] = useState([]);
  const [feedback, setFeedback] = useState(null);

  // all mutable game state lives in refs so closures always see fresh values
  const rafRef     = useRef(null);
  const lastTsRef  = useRef(null);
  const livesRef   = useRef(LIVES);
  const scoreRef   = useRef(0);
  const levelRef   = useRef(1);
  const phaseRef   = useRef('idle');
  const dropletsRef = useRef([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // keep dropletsRef in sync
  useEffect(() => { dropletsRef.current = droplets; }, [droplets]);

  const spawnRound = useCallback((lvl) => {
    const usedSet = new Set();
    const pool = DSA_QUESTIONS.filter((_, i) => !usedSet.has(i));
    const pick  = pool[Math.floor(Math.random() * pool.length)];
    const count = Math.min(4 + lvl - 1, 6);
    const opts  = shuffle([pick.answer, ...pick.options.filter(o => o !== pick.answer)]).slice(0, count);
    const slotW = 680 / count;

    const newDroplets = opts.map((text, i) => ({
      id:      i,
      text,
      correct: text === pick.answer,
      x:       slotW * i + slotW / 2 - 44,
      y:       -90 - i * 25,
      hit:     false,
    }));

    setQuestion(pick);
    setDroplets(newDroplets);
    dropletsRef.current = newDroplets;
  }, []);

  const runLoop = useCallback((lvl) => {
    cancelAnimationFrame(rafRef.current);
    lastTsRef.current = null;
    const speed = BASE_SPEED + (lvl - 1) * SPEED_INC;

    function tick(ts) {
      if (!mountedRef.current) return;
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 16.67, 2.5);
      lastTsRef.current = ts;

      const updated = dropletsRef.current.map(d =>
        d.hit ? d : { ...d, y: d.y + speed * dt }
      );

      // check miss — any non-hit droplet past bottom
      const missed = updated.find(d => !d.hit && d.y > GAME_HEIGHT - 20);
      if (missed) {
        const nl = livesRef.current - 1;
        livesRef.current = nl;
        setLives(nl);
        const killed = updated.map(d => ({ ...d, hit: true }));
        dropletsRef.current = killed;
        setDroplets(killed);

        if (nl <= 0) {
          phaseRef.current = 'over';
          setPhase('over');
          return;
        }
        // brief pause then next round
        setTimeout(() => {
          if (!mountedRef.current) return;
          spawnRound(levelRef.current);
          runLoop(levelRef.current);
        }, 700);
        return;
      }

      dropletsRef.current = updated;
      setDroplets([...updated]);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [spawnRound]);

  const startGame = () => {
    cancelAnimationFrame(rafRef.current);
    livesRef.current = LIVES;
    scoreRef.current = 0;
    levelRef.current = 1;
    phaseRef.current = 'playing';
    setScore(0); setLives(LIVES); setLevel(1);
    setFeedback(null); setPhase('playing');
    spawnRound(1);
    setTimeout(() => runLoop(1), 50);
  };

  const handleClick = (droplet) => {
    if (droplet.hit || phaseRef.current !== 'playing') return;
    cancelAnimationFrame(rafRef.current);

    const killed = dropletsRef.current.map(d => ({ ...d, hit: true }));
    dropletsRef.current = killed;
    setDroplets(killed);
    setFeedback({ correct: droplet.correct });

    if (droplet.correct) {
      const ns = scoreRef.current + 10 * levelRef.current;
      scoreRef.current = ns;
      setScore(ns);
      if (ns > 0 && ns % 30 === 0) {
        const nl = levelRef.current + 1;
        levelRef.current = nl;
        setLevel(nl);
      }
    } else {
      const nl = livesRef.current - 1;
      livesRef.current = nl;
      setLives(nl);
      if (nl <= 0) {
        phaseRef.current = 'over';
        setPhase('over');
        return;
      }
    }

    setTimeout(() => {
      if (!mountedRef.current) return;
      setFeedback(null);
      spawnRound(levelRef.current);
      runLoop(levelRef.current);
    }, 850);
  };

  const hearts = Array.from({ length: LIVES }, (_, i) => i < lives ? '❤️' : '🖤');

  return (
    <div className="dg-root" style={{ height: GAME_HEIGHT + 80 }}>

      {phase === 'idle' && (
        <div className="dg-screen">
          <div className="dg-screen-icon">💧</div>
          <h2>Falling Droplets</h2>
          <p>Click the correct answer before it hits the ground!</p>
          <div className="dg-rules">
            <span>❤️ 3 lives</span>
            <span>⚡ Score points</span>
            <span>🚀 Speed increases</span>
          </div>
          <button className="dg-start-btn" onClick={startGame}>Start Game</button>
          <button className="dg-ghost-btn" onClick={onBack}>← Back to Games</button>
        </div>
      )}

      {phase === 'over' && (
        <div className="dg-screen">
          <div className="dg-screen-icon">💀</div>
          <h2>Game Over</h2>
          <p className="dg-final-score">Score: <strong>{score}</strong></p>
          <p>Level reached: <strong>{level}</strong></p>
          <button className="dg-start-btn" onClick={startGame}>Play Again</button>
          <button className="dg-ghost-btn" onClick={onBack}>← Back to Games</button>
        </div>
      )}

      {phase === 'playing' && (
        <>
          <div className="dg-hud">
            <span className="dg-hud-score">⚡ {score}</span>
            <span className="dg-hud-level">Lv {level}</span>
            <span className="dg-hud-lives">{hearts.join(' ')}</span>
            <button className="dg-back-btn" onClick={() => { cancelAnimationFrame(rafRef.current); onBack(); }}>✕</button>
          </div>

          <div className="dg-arena" style={{ height: GAME_HEIGHT }}>
            <div className="dg-question">{question?.q}</div>

            {droplets.map(d => (
              <button
                key={d.id}
                className={`dg-droplet ${d.hit ? (d.correct ? 'dg-correct' : 'dg-wrong') : ''}`}
                style={{ left: d.x, top: d.y }}
                onClick={() => handleClick(d)}
                disabled={d.hit}
              >
                {d.text}
              </button>
            ))}

            {feedback && (
              <div className={`dg-feedback ${feedback.correct ? 'dg-fb-correct' : 'dg-fb-wrong'}`}>
                {feedback.correct ? `✓ +${10 * level} pts` : '✗ Wrong!'}
              </div>
            )}

            {/* ground line */}
            <div className="dg-ground" />
          </div>
        </>
      )}
    </div>
  );
}
