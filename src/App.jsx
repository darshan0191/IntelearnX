import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import QuizSelect from './pages/QuizSelect';
import QuizPlay from './pages/QuizPlay';
import QuizResult from './pages/QuizResult';
import StudentDashboard from './pages/StudentDashboard';
import EducatorDashboard from './pages/EducatorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import LearningPath from './pages/LearningPath';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import PdfQuiz from './pages/PdfQuiz';
import ResumeBuilder from './pages/ResumeBuilder';
import PortfolioBuilder from './pages/PortfolioBuilder';
import Games from './pages/Games';
import CreateQuiz from './pages/CreateQuiz';
import ManageQuizzes from './pages/ManageQuizzes';
import TeacherQuizPlay from './pages/TeacherQuizPlay';
import QuizHistory from './pages/QuizHistory';
import SubjectSelectModal from './components/SubjectSelectModal';

function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) return <Navigate to="/" replace />;
  const userRole = user?.role || 'student';
  if (roles && !roles.includes(userRole)) return <Navigate to="/" replace />;
  
  return children;
}

function App() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p style={{ color: 'var(--text-secondary)' }}>Loading IntelearnX...</p>
      </div>
    );
  }

  return (
    <>
      {isAuthenticated && user && user.role === 'student' && !user.introQuizCompleted && <SubjectSelectModal />}
      <Routes>
      {/* Public routes */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Landing />} />

      {/* Admin — standalone, no sidebar layout */}
      <Route path="/admin" element={
        <ProtectedRoute roles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />

      {/* Protected routes with layout */}
      <Route element={<Layout />}>
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardRedirect />
          </ProtectedRoute>
        } />
        <Route path="/student-dashboard" element={
          <ProtectedRoute roles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        } />
        <Route path="/educator-dashboard" element={
          <ProtectedRoute roles={['educator']}>
            <EducatorDashboard />
          </ProtectedRoute>
        } />
        <Route path="/quiz/select" element={
          <ProtectedRoute roles={['student']}>
            <QuizSelect />
          </ProtectedRoute>
        } />
        <Route path="/quiz/play" element={
          <ProtectedRoute roles={['student']}>
            <QuizPlay />
          </ProtectedRoute>
        } />
        <Route path="/quiz/result" element={
          <ProtectedRoute roles={['student']}>
            <QuizResult />
          </ProtectedRoute>
        } />
        <Route path="/learning-path" element={
          <ProtectedRoute roles={['student']}>
            <LearningPath />
          </ProtectedRoute>
        } />
        <Route path="/leaderboard" element={
          <ProtectedRoute>
            <Leaderboard />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />
        <Route path="/pdf-quiz" element={
          <ProtectedRoute>
            <PdfQuiz />
          </ProtectedRoute>
        } />
        <Route path="/resume-builder" element={
          <ProtectedRoute roles={['student']}>
            <ResumeBuilder />
          </ProtectedRoute>
        } />
        <Route path="/portfolio" element={
          <ProtectedRoute roles={['student']}>
            <PortfolioBuilder />
          </ProtectedRoute>
        } />
        <Route path="/games" element={
          <ProtectedRoute roles={['student']}>
            <Games />
          </ProtectedRoute>
        } />
        <Route path="/create-quiz" element={
          <ProtectedRoute roles={['educator']}>
            <CreateQuiz />
          </ProtectedRoute>
        } />
        <Route path="/manage-quizzes" element={
          <ProtectedRoute roles={['educator']}>
            <ManageQuizzes />
          </ProtectedRoute>
        } />
        <Route path="/teacher-quizzes" element={
          <ProtectedRoute roles={['student']}>
            <TeacherQuizPlay />
          </ProtectedRoute>
        } />
        <Route path="/quiz-history" element={
          <ProtectedRoute roles={['student']}>
            <QuizHistory />
          </ProtectedRoute>
        } />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

function DashboardRedirect() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (user?.role === 'educator') return <Navigate to="/educator-dashboard" replace />;
  return <Navigate to="/student-dashboard" replace />;
}

export default App;
