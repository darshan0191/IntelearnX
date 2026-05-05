import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getLeaderboard } from '../services/storageService';
import { LuTrophy, LuZap, LuTarget, LuFlame, LuLoader } from 'react-icons/lu';
import './Leaderboard.css';

const MEDAL = {
  0: { emoji: '🥇', color: '#F59E0B', border: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  1: { emoji: '🥈', color: '#94A3B8', border: '#94A3B8', bg: 'rgba(148,163,184,0.08)' },
  2: { emoji: '🥉', color: '#CD7F32', border: '#CD7F32', bg: 'rgba(205,127,50,0.08)' },
};

export default function Leaderboard() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const classCode = user?.classCode || 'global';
        const d = await getLeaderboard(classCode);
        setData(d || []);
      } catch { setData([]); }
      finally { setLoading(false); }
    }
    fetch();
  }, [user]);

  if (loading) return (
    <div className="lb-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      <LuLoader className="pq-spin" style={{ fontSize: '2rem', color: 'var(--accent)' }} />
    </div>
  );

  const top3 = data.slice(0, 3);
  // podium order: 2nd left, 1st center, 3rd right
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <div className="lb-page animate-fadeIn">

      {/* ── Title ── */}
      <div className="lb-title-block">
        <h1 className="lb-title"><LuTrophy className="lb-title-icon" /> Class Leaderboard</h1>
        <p className="lb-subtitle">
          <span className="lb-live-dot" /> Live rankings · {user?.classCode || 'Global'} · Compete with your peers
        </p>
      </div>

      {/* ── Podium ── */}
      {data.length >= 2 && (
        <div className="lb-podium-wrap">
          <div className="lb-podium">
            {podiumOrder.map((entry, i) => {
              const realRank = data.indexOf(entry); // 0,1,2
              const m = MEDAL[realRank] || {};
              const isCenter = realRank === 0;
              const barHeights = [80, 110, 64]; // 2nd, 1st, 3rd
              const barH = barHeights[i] || 64;
              return (
                <div key={entry.userId} className={`lb-podium-item ${isCenter ? 'lb-podium-center' : ''}`}>
                  {isCenter && <span className="lb-podium-crown">🏆</span>}
                  <div
                    className="lb-podium-avatar"
                    style={{ borderColor: m.border, boxShadow: `0 0 0 3px ${m.bg}` }}
                  >
                    {entry.avatar || '🧑‍🎓'}
                  </div>
                  <span className="lb-podium-medal">{m.emoji}</span>
                  <span className="lb-podium-name">{entry.name}</span>
                  <span className="lb-podium-xp" style={{ color: m.color }}>
                    <LuZap style={{ fontSize: '0.7rem' }} /> {entry.xp} XP
                  </span>
                  <div
                    className="lb-podium-bar"
                    style={{ height: barH, background: m.bg, borderColor: m.border }}
                  >
                    <span className="lb-podium-bar-num">{realRank + 1}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="lb-card">
        {/* header */}
        <div className="lb-thead">
          <span className="lb-th lb-th-rank">Rank</span>
          <span className="lb-th lb-th-student">Student</span>
          <span className="lb-th lb-th-stat">XP</span>
          <span className="lb-th lb-th-stat">Quizzes</span>
          <span className="lb-th lb-th-stat">Accuracy</span>
        </div>

        {data.length > 0 ? data.map((entry, idx) => {
          const m = MEDAL[idx];
          const isMe = entry.userId === user?.id;
          return (
            <div
              key={entry.userId}
              className={`lb-row ${isMe ? 'lb-row-me' : ''}`}
              style={m ? { borderLeft: `3px solid ${m.border}` } : {}}
            >
              {/* rank */}
              <span className="lb-td lb-td-rank">
                {m
                  ? <span className="lb-medal-emoji">{m.emoji}</span>
                  : <span className="lb-rank-num">{idx + 1}</span>
                }
              </span>

              {/* student */}
              <span className="lb-td lb-td-student">
                <span className="lb-row-avatar">{entry.avatar || '🧑‍🎓'}</span>
                <span className="lb-row-name">
                  {entry.name}
                  {isMe && <span className="lb-you-tag">You</span>}
                </span>
              </span>

              {/* xp */}
              <span className="lb-td lb-td-stat">
                <LuZap className="lb-stat-icon" style={{ color: '#D4645C' }} />
                {entry.xp}
              </span>

              {/* quizzes */}
              <span className="lb-td lb-td-stat">
                <LuTarget className="lb-stat-icon" style={{ color: '#10b981' }} />
                {entry.quizzes}
              </span>

              {/* accuracy */}
              <span className="lb-td lb-td-stat">
                <LuFlame className="lb-stat-icon" style={{ color: '#F59E0B' }} />
                {entry.accuracy}%
              </span>
            </div>
          );
        }) : (
          <div className="lb-empty">
            <LuTrophy style={{ fontSize: '2.5rem', opacity: 0.2 }} />
            <p>No rankings yet — complete a quiz to appear here!</p>
          </div>
        )}
      </div>
    </div>
  );
}
