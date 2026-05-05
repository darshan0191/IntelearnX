import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LuZap, LuStar, LuMenu } from 'react-icons/lu';

const PAGE_TITLES = {
  '/student-dashboard': 'Student Dashboard',
  '/educator-dashboard': 'Educator Dashboard',
  '/quiz/select': 'Select Quiz',
  '/quiz/play': 'Quiz',
  '/quiz/result': 'Quiz Results',
  '/learning-path': 'Learning Path',
  '/leaderboard': 'Leaderboard',
  '/profile': 'Profile & Badges',
  '/pdf-quiz': 'PDF Quiz',
  '/dashboard': 'Dashboard',
  '/resume-builder': 'Resume Builder',
  '/portfolio': 'Portfolio Builder',
  '/games': 'Learning Games',
  '/create-quiz': 'Create Quiz',
  '/manage-quizzes': 'My Quizzes',
  '/teacher-quizzes': 'Teacher Quizzes',
};

export default function Navbar({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const title = PAGE_TITLES[location.pathname] || 'IntelearnX';
  const isStudent = user?.role === 'student';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="hamburger-btn" onClick={onMenuToggle} id="hamburger-menu-btn">
          <LuMenu />
        </button>
        <h2 className="navbar-title">{title}</h2>
      </div>

      <div className="navbar-right">
        {isStudent && (
          <>
            <div className="navbar-stat" style={{ color: '#fbbf24' }}>
              <LuZap /> {user?.xp || 0} XP
            </div>
            <div className="navbar-stat" style={{ color: '#10b981' }}>
              <LuStar /> Lv. {user?.level || 1}
            </div>
          </>
        )}
        <button className="logout-btn" onClick={handleLogout} id="logout-btn">
          <span className="logout-btn-icon">
            <svg viewBox="0 0 512 512" aria-hidden="true">
              <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z" />
            </svg>
          </span>
          <span className="logout-btn-text">Logout</span>
        </button>
      </div>
    </header>
  );
}
