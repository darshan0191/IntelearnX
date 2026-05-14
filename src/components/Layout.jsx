import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import AiDoubtsAgent from './AiDoubtsAgent';
import './Layout.css';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="app-layout">
      {/* Hamburger Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
      )}
      
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="app-main">
        <Navbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="app-content">
          <Outlet />
        </main>
      </div>

      {/* Floating AI Study Agent — available on all pages */}
      {user && <AiDoubtsAgent userId={user.id || ''} />}
    </div>
  );
}
