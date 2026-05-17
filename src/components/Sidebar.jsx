import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LuLayoutDashboard,
  LuBookOpen,
  LuRoute,
  LuTrophy,
  LuUser,
  LuUsers,
  LuX,
  LuFileText,
  LuBriefcase,
  LuLayoutTemplate,
  LuGamepad2,
  LuClipboardList,
  LuPenLine,
  LuHistory,
  LuFileStack,
  LuSparkles,
} from 'react-icons/lu';

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🧠</div>
          <span className="sidebar-logo-text">IntelearnX</span>
        </div>
        <button className="sidebar-close-btn" onClick={onClose}>
          <LuX />
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <span className="sidebar-section-title">Main</span>

        {isStudent && (
          <NavLink
            to="/student-dashboard"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <LuLayoutDashboard />
            <span>Dashboard</span>
          </NavLink>
        )}

        {isStudent && (
          <NavLink
            to="/quiz/select"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <LuBookOpen />
            <span>Take Quiz</span>
          </NavLink>
        )}

        <NavLink
          to="/pdf-quiz"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <LuFileText />
          <span>PDF Quiz</span>
          <span className="sidebar-badge">AI</span>
        </NavLink>

        {isStudent && (
          <NavLink
            to="/learning-path"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <LuRoute />
            <span>Learning Path</span>
            <span className="sidebar-badge">AI</span>
          </NavLink>
        )}

        {isStudent && (
          <NavLink
            to="/games"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <LuGamepad2 />
            <span>Games</span>
            <span className="sidebar-badge">New</span>
          </NavLink>
        )}

        {isStudent && (
          <NavLink
            to="/teacher-quizzes"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <LuClipboardList />
            <span>Teacher Quizzes</span>
          </NavLink>
        )}

        {isStudent && (
          <NavLink
            to="/quiz-history"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <LuHistory />
            <span>Quiz History</span>
          </NavLink>
        )}

        {isStudent && (
          <NavLink
            to="/suggestions"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <LuSparkles />
            <span>Suggestions</span>
            <span className="sidebar-badge">AI</span>
          </NavLink>
        )}

        {isStudent && (
          <>
            <span className="sidebar-section-title">Career</span>
            <NavLink
              to="/resume-builder"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <LuFileText />
              <span>Resume Builder</span>
              <span className="sidebar-badge">New</span>
            </NavLink>

            <NavLink
              to="/portfolio"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <LuLayoutTemplate />
              <span>Portfolio</span>
              <span className="sidebar-badge">New</span>
            </NavLink>
          </>
        )}

        <span className="sidebar-section-title">Community</span>

        <NavLink
          to="/leaderboard"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <LuTrophy />
          <span>Leaderboard</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <LuUser />
          <span>Profile & Badges</span>
        </NavLink>

        {!isStudent && (
          <>
            <span className="sidebar-section-title">Educator</span>
            <NavLink
              to="/educator-dashboard"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <LuUsers />
              <span>Class Management</span>
            </NavLink>
            <NavLink
              to="/manage-quizzes"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <LuPenLine />
              <span>My Quizzes</span>
              <span className="sidebar-badge">New</span>
            </NavLink>
            <NavLink
              to="/theory-bank"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <LuBookOpen />
              <span>Theory Bank</span>
              <span className="sidebar-badge">AI</span>
            </NavLink>
            <NavLink
              to="/question-paper"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <LuFileStack />
              <span>Question Papers</span>
              <span className="sidebar-badge">AI</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-avatar">{user?.avatar || '🧑‍🎓'}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.name}</div>
          <div className="sidebar-user-role">{user?.role}</div>
        </div>
      </div>
    </aside>
  );
}
