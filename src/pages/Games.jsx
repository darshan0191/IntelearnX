import { useState } from 'react';
import DropletGame   from '../games/DropletGame';
import SQLShooter    from '../games/SQLShooter';
import AlgorithmRace from '../games/AlgorithmRace';
import './Games.css';

const GAME_CARDS = [
  {
    id: 'droplet',
    title: 'Falling Droplets',
    subtitle: 'DSA · Reaction Game',
    icon: '💧',
    tag: 'DSA',
    tagColor: '#D4645C',
    // banner bg — warm coral tint
    bannerBg: 'linear-gradient(135deg, rgba(212,100,92,0.18) 0%, rgba(245,158,11,0.12) 100%)',
    desc: 'Answer DSA questions before the droplets hit the ground. Speed increases with every level!',
    stats: ['3 Lives', 'Infinite Levels', 'Score Attack'],
  },
  {
    id: 'sql',
    title: 'SQL Shooter',
    subtitle: 'DBMS · Precision Game',
    icon: '🎯',
    tag: 'DBMS',
    tagColor: '#4CAF82',
    bannerBg: 'linear-gradient(135deg, rgba(76,175,130,0.18) 0%, rgba(5,150,105,0.1) 100%)',
    desc: 'Moving SQL targets cross the screen. Shoot the correct query before time runs out!',
    stats: ['8 Rounds', 'Timer Bonus', 'Crosshair Mode'],
  },
  {
    id: 'race',
    title: 'Algorithm Race',
    subtitle: 'DSA · Strategy Game',
    icon: '🏎️',
    tag: 'DSA',
    tagColor: '#E0A546',
    bannerBg: 'linear-gradient(135deg, rgba(224,165,70,0.18) 0%, rgba(217,119,6,0.1) 100%)',
    desc: 'Race against an AI opponent. Correct answers boost your speed, wrong ones slow you down!',
    stats: ['vs AI', 'Speed Boost', 'Race Track'],
  },
];

export default function Games() {
  const [active, setActive] = useState(null);

  if (active === 'droplet') return <DropletGame   onBack={() => setActive(null)} />;
  if (active === 'sql')     return <SQLShooter    onBack={() => setActive(null)} />;
  if (active === 'race')    return <AlgorithmRace onBack={() => setActive(null)} />;

  return (
    <div className="gm-page animate-fadeIn">

      {/* Header */}
      <div className="gm-header">
        <div className="gm-header-icon">🎮</div>
        <div>
          <h1 className="gm-title">Learning Games</h1>
          <p className="gm-subtitle">Master CS concepts through interactive gameplay</p>
        </div>
      </div>

      {/* Cards */}
      <div className="gm-grid">
        {GAME_CARDS.map((g) => (
          <button
            key={g.id}
            className="gm-card"
            style={{ '--ct': g.tagColor }}
            onClick={() => setActive(g.id)}
          >
            {/* ── Coloured Banner ── */}
            <div className="gm-card-banner" style={{ '--cb': g.bannerBg }}>
              <div className="gm-card-icon-wrap">
                <div className="gm-card-icon">{g.icon}</div>
                <span
                  className="gm-tag"
                  style={{
                    color: g.tagColor,
                    borderColor: g.tagColor + '55',
                    background: g.tagColor + '22',
                  }}
                >
                  {g.tag}
                </span>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="gm-card-body">
              <h2 className="gm-card-title">{g.title}</h2>
              <p className="gm-card-sub">{g.subtitle}</p>
              <p className="gm-card-desc">{g.desc}</p>

              <div className="gm-card-stats">
                {g.stats.map(s => (
                  <span key={s} className="gm-stat-chip">{s}</span>
                ))}
              </div>

              <div className="gm-play-btn">
                <span>Play Now</span>
                <span>→</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="gm-footer-note">
        🧠 All games are based on real DSA &amp; DBMS concepts from your IntelearnX curriculum
      </p>
    </div>
  );
}
