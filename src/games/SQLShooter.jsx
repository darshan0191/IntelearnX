import { useState, useEffect, useRef, useCallback } from 'react';
import { SQL_QUESTIONS } from '../data/gameQuestions';
import './SQLShooter.css';

const ROUND_TIME   = 18;
const TOTAL_ROUNDS = SQL_QUESTIONS.length;

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

export default function SQLShooter({ onBack }) {
  const [phase,    setPhase]    = useState('idle');
  const [round,    setRound]    = useState(0);
  const [score,    setScore]    = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [targets,  setTargets]  = useState([]);
  const [question, setQuestion] = useState(null);
  const [shotFx,   setShotFx]   = useState(null); // { correct, x, y }

  const rafRef     = useRef(null);
  const timerRef   = useRef(null);
  const lastTsRef  = useRef(null);
  const targetsRef = useRef([]);
  const roundRef   = useRef(0);
  const scoreRef   = useRef(0);
  const timeRef    = useRef(ROUND_TIME);
  const phaseRef   = useRef('idle');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => { targetsRef.current = targets; }, [targets]);

  const ARENA_W = 700;
  const ARENA_H = 320;

  const spawnRound = useCallback((idx) => {
    const q    = SQL_QUESTIONS[idx % SQL_QUESTIONS.length];
    const opts = shuffle(q.options).slice(0, 5);
    const rowH = ARENA_H / opts.length;

    const newTargets = opts.map((text, i) => ({
      id:    i,
      text,
      correct: text === q.answer,
      x:     Math.random() * (ARENA_W - 240),
      y:     rowH * i + rowH / 2 - 18,
      speed: 0.9 + Math.random() * 0.8,
      dir:   Math.random() > 0.5 ? 1 : -1,
      hit:   false,
      flash: null,
    }));

    setQuestion(q);
    setTargets(newTargets);
    targetsRef.current = newTargets;
    timeRef.current = ROUND_TIME;
    setTimeLeft(ROUND_TIME);
  }, []);

  const runLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    lastTsRef.current = null;

    function tick(ts) {
      if (!mountedRef.current) return;
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 16.67, 2.5);
      lastTsRef.current = ts;

      const updated = targetsRef.current.map(t => {
        if (t.hit) return t;
        let nx = t.x + t.speed * t.dir * dt;
        let nd = t.dir;
        if (nx > ARENA_W - 240) { nx = ARENA_W - 240; nd = -1; }
        if (nx < 0)             { nx = 0;              nd =  1; }
        return { ...t, x: nx, dir: nd };
      });

      targetsRef.current = updated;
      setTargets([...updated]);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const goNextRound = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clearInterval(timerRef.current);
    const next = roundRef.current + 1;

    if (next >= TOTAL_ROUNDS) {
      phaseRef.current = 'over';
      setPhase('over');
      return;
    }

    setTimeout(() => {
      if (!mountedRef.current) return;
      roundRef.current = next;
      setRound(next);
      spawnRound(next);
      runLoop();
      startCountdown();
    }, 800);
  }, [spawnRound, runLoop]); // eslint-disable-line

  // separate countdown — uses goNextRound via ref to avoid stale closure
  const goNextRef = useRef(null);
  goNextRef.current = goNextRound;

  const startCountdown = useCallback(() => {
    clearInterval(timerRef.current);
    timeRef.current = ROUND_TIME;
    setTimeLeft(ROUND_TIME);

    timerRef.current = setInterval(() => {
      timeRef.current -= 1;
      setTimeLeft(timeRef.current);
      if (timeRef.current <= 0) {
        clearInterval(timerRef.current);
        goNextRef.current();
      }
    }, 1000);
  }, []);

  const startGame = () => {
    cancelAnimationFrame(rafRef.current);
    clearInterval(timerRef.current);
    roundRef.current = 0;
    scoreRef.current = 0;
    phaseRef.current = 'playing';
    setRound(0); setScore(0); setShotFx(null);
    setPhase('playing');
    spawnRound(0);
    runLoop();
    startCountdown();
  };

  const handleShoot = (target, e) => {
    if (target.hit || phaseRef.current !== 'playing') return;
    cancelAnimationFrame(rafRef.current);
    clearInterval(timerRef.current);

    // visual shot fx
    const rect = e.currentTarget.getBoundingClientRect();
    setShotFx({ correct: target.correct, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setTimeout(() => setShotFx(null), 600);

    const killed = targetsRef.current.map(t => ({
      ...t,
      hit:   true,
      flash: t.id === target.id ? (target.correct ? 'correct' : 'wrong') : null,
    }));
    targetsRef.current = killed;
    setTargets(killed);

    if (target.correct) {
      const ns = scoreRef.current + 10 + timeRef.current;
      scoreRef.current = ns;
      setScore(ns);
    }

    goNextRound();
  };

  const timerPct   = (timeLeft / ROUND_TIME) * 100;
  const timerColor = timeLeft > 10 ? '#10b981' : timeLeft > 5 ? '#f59e0b' : '#ef4444';

  return (
    <div className="sq-root">

      {phase === 'idle' && (
        <div className="sq-screen">
          <div className="sq-screen-icon">🎯</div>
          <h2>SQL Shooter</h2>
          <p>Shoot the correct SQL query before time runs out!</p>
          <div className="sq-rules">
            <span>🕐 {ROUND_TIME}s per round</span>
            <span>🎯 {TOTAL_ROUNDS} rounds</span>
            <span>⚡ Speed bonus</span>
          </div>
          <button className="sq-start-btn" onClick={startGame}>Start Game</button>
          <button className="sq-ghost-btn" onClick={onBack}>← Back to Games</button>
        </div>
      )}

      {phase === 'over' && (
        <div className="sq-screen">
          <div className="sq-screen-icon">🏆</div>
          <h2>Mission Complete!</h2>
          <p className="sq-final">Final Score: <strong>{score}</strong></p>
          <button className="sq-start-btn" onClick={startGame}>Play Again</button>
          <button className="sq-ghost-btn" onClick={onBack}>← Back to Games</button>
        </div>
      )}

      {phase === 'playing' && (
        <>
          <div className="sq-hud">
            <span className="sq-score">🎯 {score}</span>
            <div className="sq-timer-wrap">
              <div className="sq-timer-bar" style={{ width: `${timerPct}%`, background: timerColor }} />
            </div>
            <span className="sq-timer-num" style={{ color: timerColor }}>{timeLeft}s</span>
            <span className="sq-round">Round {round + 1}/{TOTAL_ROUNDS}</span>
            <button className="sq-back-btn" onClick={() => { cancelAnimationFrame(rafRef.current); clearInterval(timerRef.current); onBack(); }}>✕</button>
          </div>

          <div className="sq-question">
            <span className="sq-q-label">SQL CHALLENGE</span>
            {question?.q}
          </div>

          <div className="sq-arena" style={{ width: ARENA_W, height: ARENA_H }}>
            {targets.map(t => (
              <button
                key={t.id}
                className={`sq-target ${t.flash ? `sq-flash-${t.flash}` : ''} ${t.hit && !t.flash ? 'sq-hit' : ''}`}
                style={{ left: t.x, top: t.y }}
                onClick={(e) => handleShoot(t, e)}
                disabled={t.hit}
              >
                {t.text}
                {t.flash === 'correct' && <span className="sq-hit-fx">✓</span>}
                {t.flash === 'wrong'   && <span className="sq-hit-fx">✗</span>}
              </button>
            ))}
          </div>

          {/* shot fx overlay */}
          {shotFx && (
            <div
              className={`sq-shot-fx ${shotFx.correct ? 'sq-shot-ok' : 'sq-shot-miss'}`}
              style={{ left: shotFx.x, top: shotFx.y }}
            >
              {shotFx.correct ? '💥' : '✗'}
            </div>
          )}
        </>
      )}
    </div>
  );
}
