import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserBadges, getPerformanceData } from '../services/storageService';
import { badgeDefinitions } from '../data/quizData';
import {
  LuZap, LuStar, LuTrophy, LuTarget, LuFlame,
  LuCalendar, LuLoader, LuLock, LuCheck, LuBookOpen,
} from 'react-icons/lu';
import './Profile.css';

export default function Profile() {
  const { user } = useAuth();
  const [earnedBadgeIds, setEarnedBadgeIds] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [badgeFilter, setBadgeFilter] = useState('all'); // all | earned | locked

  useEffect(() => {
    async function fetchData() {
      if (!user?.id) return;
      try {
        const [badges, perf] = await Promise.all([
          getUserBadges(user.id),
          getPerformanceData(user.id),
        ]);
        setEarnedBadgeIds(badges || []);
        setPerformance(perf);
      } catch (err) {
        console.error('Failed to fetch profile data', err);
        setEarnedBadgeIds([]);
        setPerformance({ overallAccuracy: 0, totalQuizzes: 0 });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user?.id]);

  const xpForNextLevel = 250;
  const currentLevelXP = (user?.xp || 0) % xpForNextLevel;
  const xpProgress = Math.min((currentLevelXP / xpForNextLevel) * 100, 100);
  const level = user?.level || 1;

  const filteredBadges = useMemo(() => {
    if (badgeFilter === 'earned') return badgeDefinitions.filter(b => earnedBadgeIds.includes(b.id));
    if (badgeFilter === 'locked') return badgeDefinitions.filter(b => !earnedBadgeIds.includes(b.id));
    return badgeDefinitions;
  }, [badgeFilter, earnedBadgeIds]);

  const earnedCount = earnedBadgeIds.length;
  const totalCount = badgeDefinitions.length;
  const completionPct = Math.round((earnedCount / totalCount) * 100);

  if (loading || !performance) {
    return (
      <div className="profile-page animate-fadeIn" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <LuLoader className="pq-spin" style={{ fontSize: '2rem', color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="profile-page animate-fadeIn">

      {/* ── Hero Card ── */}
      <div className="pf-hero">
        <div className="pf-hero-bg" aria-hidden />
        <div className="pf-hero-inner">
          <div className="pf-avatar">{user?.avatar || '🧑‍🎓'}</div>
          <div className="pf-hero-info">
            <h1 className="pf-name">{user?.name}</h1>
            <p className="pf-email">{user?.email}</p>
            <div className="pf-tags">
              <span className="pf-tag pf-tag-role">{user?.role}</span>
              {user?.classCode && <span className="pf-tag pf-tag-class">Class {user.classCode}</span>}
              <span className="pf-tag pf-tag-level">⚡ Level {level}</span>
            </div>
          </div>
        </div>

        {/* XP bar */}
        <div className="pf-xp-section">
          <div className="pf-xp-labels">
            <span className="pf-xp-label-left">Level {level}</span>
            <span className="pf-xp-center">{currentLevelXP} / {xpForNextLevel} XP to next level</span>
            <span className="pf-xp-label-right">Level {level + 1}</span>
          </div>
          <div className="pf-xp-track">
            <div className="pf-xp-fill" style={{ width: `${xpProgress}%` }} />
          </div>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="pf-stats">
        {[
          { icon: <LuZap />,      value: user?.xp || 0,                  label: 'Total XP',     color: '#D4645C' },
          { icon: <LuStar />,     value: `Lv. ${level}`,                 label: 'Level',        color: '#10b981' },
          { icon: <LuTrophy />,   value: earnedCount,                    label: 'Badges',       color: '#fbbf24' },
          { icon: <LuTarget />,   value: `${performance.overallAccuracy}%`, label: 'Accuracy',  color: '#3b82f6' },
          { icon: <LuBookOpen />, value: performance.totalQuizzes,       label: 'Quizzes',      color: '#8b5cf6' },
          { icon: <LuFlame />,    value: user?.loginStreak || 0,         label: 'Day Streak',   color: '#E0A546' },
          { icon: <LuCalendar />, value: performance.totalCorrect || 0,  label: 'Correct Ans.', color: '#06b6d4' },
        ].map((s, i) => (
          <div key={i} className="pf-stat-card" style={{ '--sc': s.color }}>
            <span className="pf-stat-icon">{s.icon}</span>
            <span className="pf-stat-value">{s.value}</span>
            <span className="pf-stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Badges Section ── */}
      <div className="pf-badges-section">
        {/* header */}
        <div className="pf-badges-head">
          <div>
            <h2 className="pf-badges-title">
              <LuTrophy style={{ color: '#fbbf24' }} /> Badges & Achievements
            </h2>
            <p className="pf-badges-sub">{earnedCount} of {totalCount} earned · {completionPct}% complete</p>
          </div>
          {/* filter tabs */}
          <div className="pf-filter-tabs">
            {['all', 'earned', 'locked'].map(f => (
              <button
                key={f}
                className={`pf-filter-tab ${badgeFilter === f ? 'active' : ''}`}
                onClick={() => setBadgeFilter(f)}
              >
                {f === 'all' ? `All (${totalCount})` : f === 'earned' ? `Earned (${earnedCount})` : `Locked (${totalCount - earnedCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* progress bar */}
        <div className="pf-badge-progress-wrap">
          <div className="pf-badge-progress-track">
            <div className="pf-badge-progress-fill" style={{ width: `${completionPct}%` }} />
          </div>
          <span className="pf-badge-progress-pct">{completionPct}%</span>
        </div>

        {/* grid */}
        <div className="pf-badges-grid">
          {filteredBadges.map(badge => {
            const isEarned = earnedBadgeIds.includes(badge.id);
            return (
              <div key={badge.id} className={`pf-badge-card ${isEarned ? 'pf-badge-earned' : 'pf-badge-locked'}`}>
                {/* glow for earned */}
                {isEarned && <div className="pf-badge-glow" aria-hidden />}

                <div className="pf-badge-icon-wrap">
                  <span className="pf-badge-icon">{badge.icon}</span>
                  {isEarned
                    ? <span className="pf-badge-check"><LuCheck /></span>
                    : <span className="pf-badge-lock"><LuLock /></span>
                  }
                </div>

                <div className="pf-badge-body">
                  <div className="pf-badge-name">{badge.name}</div>
                  <div className="pf-badge-desc">{badge.description}</div>
                  <div className="pf-badge-xp">
                    <LuZap style={{ fontSize: '0.7rem' }} /> +{badge.xpReward} XP
                  </div>
                </div>

                {isEarned && <div className="pf-badge-earned-ribbon">Earned</div>}
              </div>
            );
          })}
        </div>

        {filteredBadges.length === 0 && (
          <div className="pf-empty">
            <LuTrophy style={{ fontSize: '2rem', color: 'var(--text-muted)' }} />
            <p>No badges here yet — keep quizzing!</p>
          </div>
        )}
      </div>
    </div>
  );
}
