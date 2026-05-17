import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserBadges, getPerformanceData } from '../services/storageService';
import { badgeDefinitions } from '../data/quizData';
import {
  LuZap, LuStar, LuTrophy, LuTarget, LuFlame,
  LuCalendar, LuLoader, LuLock, LuCheck, LuBookOpen,
  LuPencil, LuX, LuSave, LuUser, LuMail, LuPhone,
  LuGraduationCap, LuBuilding2, LuHeart, LuClock,
  LuShield, LuHash,
} from 'react-icons/lu';
import './Profile.css';

const AVATAR_OPTIONS = ['🧑‍🎓', '👩‍🎓', '🧑‍💻', '👨‍🔬', '👩‍🔬', '🧑‍🏫', '👨‍🎓', '👩‍💻', '🧑‍🔧', '👨‍💼', '👩‍💼', '🦸', '🧙', '🧑‍🚀'];

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [earnedBadgeIds, setEarnedBadgeIds] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [badgeFilter, setBadgeFilter] = useState('all');

  // Edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({});

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

  // Initialize edit form when entering edit mode
  const startEditing = () => {
    setEditForm({
      name: user?.name || '',
      avatar: user?.avatar || '🧑‍🎓',
      phone: user?.phone || '',
      bio: user?.bio || '',
      institution: user?.institution || '',
      yearOfStudy: user?.yearOfStudy || '',
      classCode: user?.classCode || '',
      studyInterests: user?.studyInterests || '',
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditForm({});
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = {};
      if (editForm.name && editForm.name.trim()) updates.name = editForm.name.trim();
      if (editForm.avatar) updates.avatar = editForm.avatar;
      updates.phone = editForm.phone?.trim() || '';
      updates.bio = editForm.bio?.trim() || '';
      updates.institution = editForm.institution?.trim() || '';
      updates.yearOfStudy = editForm.yearOfStudy?.trim() || '';
      updates.classCode = editForm.classCode?.trim() || '';
      updates.studyInterests = editForm.studyInterests?.trim() || '';

      await updateUser(updates);
      setEditing(false);
    } catch (err) {
      console.error('Failed to save profile', err);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

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

  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  const lastLoginDate = user?.lastLogin
    ? new Date(user.lastLogin).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  if (loading || !performance) {
    return (
      <div className="profile-page animate-fadeIn" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <LuLoader className="pq-spin" style={{ fontSize: '2rem', color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="profile-page animate-fadeIn">
      <div className="pf-workspace">
        {/* ── Left Panel ── */}
        <div className="pf-left-panel">

      {/* ── Hero Card ── */}
      <div className="pf-hero">
        <div className="pf-hero-bg" aria-hidden />
        <div className="pf-hero-inner">
          {editing ? (
            /* Avatar picker in edit mode */
            <div className="pf-avatar-edit-wrap">
              <div className="pf-avatar pf-avatar--editing">{editForm.avatar}</div>
              <div className="pf-avatar-picker">
                {AVATAR_OPTIONS.map(av => (
                  <button
                    key={av}
                    className={`pf-avatar-option ${editForm.avatar === av ? 'active' : ''}`}
                    onClick={() => updateField('avatar', av)}
                    type="button"
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pf-avatar">{user?.avatar || '🧑‍🎓'}</div>
          )}

          <div className="pf-hero-info">
            {editing ? (
              <input
                className="pf-edit-input pf-edit-name"
                value={editForm.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="Your name"
              />
            ) : (
              <h1 className="pf-name">{user?.name}</h1>
            )}
            <p className="pf-email"><LuMail style={{ fontSize: '0.8rem' }} /> {user?.email}</p>
            <div className="pf-tags">
              <span className="pf-tag pf-tag-role"><LuShield style={{ fontSize: '0.65rem' }} /> {user?.role}</span>
              {(editing ? editForm.classCode : user?.classCode) && (
                <span className="pf-tag pf-tag-class"><LuHash style={{ fontSize: '0.65rem' }} /> Class {editing ? editForm.classCode : user.classCode}</span>
              )}
              <span className="pf-tag pf-tag-level">⚡ Level {level}</span>
            </div>
          </div>

          {/* Edit/Save/Cancel buttons */}
          <div className="pf-hero-actions">
            {editing ? (
              <>
                <button className="btn btn-primary btn-sm pf-save-btn" onClick={handleSave} disabled={saving}>
                  {saving ? <LuLoader className="pq-spin" /> : <LuSave />} Save
                </button>
                <button className="btn btn-secondary btn-sm pf-cancel-btn" onClick={cancelEditing} disabled={saving}>
                  <LuX /> Cancel
                </button>
              </>
            ) : (
              <button className="btn btn-secondary btn-sm pf-edit-btn" onClick={startEditing}>
                <LuPencil /> Edit Profile
              </button>
            )}
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

      {/* ── User Details Section ── */}
      <div className="pf-details-section">
        <h2 className="pf-section-title"><LuUser /> Personal & Academic Details</h2>
        <div className="pf-details-grid">
          {/* Bio */}
          <div className="pf-detail-card pf-detail-card--wide">
            <div className="pf-detail-label"><LuHeart /> Bio</div>
            {editing ? (
              <textarea
                className="pf-edit-textarea"
                value={editForm.bio}
                onChange={e => updateField('bio', e.target.value)}
                placeholder="Tell us about yourself..."
                rows={3}
              />
            ) : (
              <div className="pf-detail-value">{user?.bio || <span className="pf-empty-hint">No bio added yet</span>}</div>
            )}
          </div>

          {/* Phone */}
          <div className="pf-detail-card">
            <div className="pf-detail-label"><LuPhone /> Phone</div>
            {editing ? (
              <input
                className="pf-edit-input"
                value={editForm.phone}
                onChange={e => updateField('phone', e.target.value)}
                placeholder="e.g. +91 98765 43210"
              />
            ) : (
              <div className="pf-detail-value">{user?.phone || <span className="pf-empty-hint">—</span>}</div>
            )}
          </div>

          {/* Institution */}
          <div className="pf-detail-card">
            <div className="pf-detail-label"><LuBuilding2 /> Institution</div>
            {editing ? (
              <input
                className="pf-edit-input"
                value={editForm.institution}
                onChange={e => updateField('institution', e.target.value)}
                placeholder="e.g. IIT Bombay"
              />
            ) : (
              <div className="pf-detail-value">{user?.institution || <span className="pf-empty-hint">—</span>}</div>
            )}
          </div>

          {/* Year of Study */}
          <div className="pf-detail-card">
            <div className="pf-detail-label"><LuGraduationCap /> Year of Study</div>
            {editing ? (
              <select
                className="pf-edit-select"
                value={editForm.yearOfStudy}
                onChange={e => updateField('yearOfStudy', e.target.value)}
              >
                <option value="">Select year</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
                <option value="Postgraduate">Postgraduate</option>
                <option value="Other">Other</option>
              </select>
            ) : (
              <div className="pf-detail-value">{user?.yearOfStudy || <span className="pf-empty-hint">—</span>}</div>
            )}
          </div>

          {/* Class Code */}
          <div className="pf-detail-card">
            <div className="pf-detail-label"><LuHash /> Class Code</div>
            {editing ? (
              <input
                className="pf-edit-input"
                value={editForm.classCode}
                onChange={e => updateField('classCode', e.target.value)}
                placeholder="e.g. CS-301"
              />
            ) : (
              <div className="pf-detail-value">{user?.classCode || <span className="pf-empty-hint">—</span>}</div>
            )}
          </div>

          {/* Study Interests */}
          <div className="pf-detail-card pf-detail-card--wide">
            <div className="pf-detail-label"><LuBookOpen /> Study Interests</div>
            {editing ? (
              <input
                className="pf-edit-input"
                value={editForm.studyInterests}
                onChange={e => updateField('studyInterests', e.target.value)}
                placeholder="e.g. Machine Learning, Web Development, DSA"
              />
            ) : (
              <div className="pf-detail-value">
                {user?.studyInterests ? (
                  <div className="pf-interest-tags">
                    {user.studyInterests.split(',').map((s, i) => (
                      <span key={i} className="pf-interest-tag">{s.trim()}</span>
                    ))}
                  </div>
                ) : (
                  <span className="pf-empty-hint">No interests added yet</span>
                )}
              </div>
            )}
          </div>

          {/* Read-only fields */}
          <div className="pf-detail-card">
            <div className="pf-detail-label"><LuCalendar /> Joined</div>
            <div className="pf-detail-value">{joinedDate}</div>
          </div>

          <div className="pf-detail-card">
            <div className="pf-detail-label"><LuClock /> Last Active</div>
            <div className="pf-detail-value">{lastLoginDate}</div>
          </div>
        </div>
      </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="pf-right-panel">

      {/* ── 30-Day Learning Journey ── */}
      <div className="pf-streak-card">
        <div className="pf-streak-header">
          <h2 className="pf-section-title" style={{ marginBottom: 0 }}>
            <LuFlame style={{ color: '#E0A546' }} /> Learning Streak
          </h2>
          <div className="pf-streak-metrics">
            <span className="pf-streak-metric">Current: {user?.loginStreak || 0} Days</span>
            <span className="pf-streak-metric pf-streak-metric--highlight">Next Milestone: Day {[7, 14, 21, 30].find(m => m > (user?.loginStreak || 0)) || 30}</span>
          </div>
        </div>
        <div className="pf-streak-grid">
          {Array.from({ length: 30 }, (_, i) => i + 1).map(day => {
            const currentStreak = user?.loginStreak || 0;
            const isCompleted = day <= currentStreak;
            const isCurrent = day === currentStreak + 1;
            const isMilestone = [7, 14, 21, 30].includes(day);
            
            let statusClass = 'pf-streak-node--future';
            if (isCompleted) statusClass = 'pf-streak-node--completed';
            else if (isCurrent) statusClass = 'pf-streak-node--current';
            
            let tooltip = `Day ${day}`;
            if (isCompleted) tooltip = "Goal Met!";
            else if (isMilestone) tooltip = `Reach a ${day}-day streak to unlock a badge.`;

            return (
              <div 
                key={day} 
                className={`pf-streak-node ${statusClass} ${isMilestone ? 'pf-streak-node--milestone' : ''}`}
                title={tooltip}
              >
                {isCompleted ? (
                  <LuCheck className="pf-streak-icon" />
                ) : isMilestone ? (
                  <LuStar className="pf-streak-icon" />
                ) : (
                  <span className="pf-streak-day-text">{day}</span>
                )}
              </div>
            );
          })}
        </div>
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

        {/* grid — simplified badge cards */}
        <div className="pf-badges-grid">
          {filteredBadges.map(badge => {
            const isEarned = earnedBadgeIds.includes(badge.id);
            return (
              <div key={badge.id} className={`pf-badge-card ${isEarned ? 'pf-badge-earned' : 'pf-badge-locked'}`}>
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
                  <div className="pf-badge-meta">
                    <span className="pf-badge-xp">
                      <LuZap style={{ fontSize: '0.7rem' }} /> +{badge.xpReward} XP
                    </span>
                    {isEarned && <span className="pf-badge-status pf-badge-status--earned">Earned</span>}
                    {!isEarned && <span className="pf-badge-status pf-badge-status--locked">Locked</span>}
                  </div>
                </div>
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
      </div>
    </div>
  );
}
