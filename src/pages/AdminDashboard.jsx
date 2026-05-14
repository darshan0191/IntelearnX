import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPlatformStats, seedDefaultPlans } from '../services/adminService';
import AdminUsers from './AdminUsers';
import AdminPlans from './AdminPlans';
import AdminPayments from './AdminPayments';
import {
  LuLayoutDashboard, LuUsers, LuCreditCard, LuPackage,
  LuTrendingUp, LuShield, LuLogOut, LuMenu, LuX,
  LuDollarSign, LuUserCheck, LuActivity,
} from 'react-icons/lu';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function init() {
      await seedDefaultPlans();
      const s = await getPlatformStats();
      setStats(s);
      setLoading(false);
    }
    init();
  }, []);

  const reload = async () => {
    const s = await getPlatformStats();
    setStats(s);
  };

  const navItems = [
    { id: 'overview',  icon: <LuLayoutDashboard />, label: 'Overview' },
    { id: 'users',     icon: <LuUsers />,           label: 'Users' },
    { id: 'plans',     icon: <LuPackage />,          label: 'Subscription Plans' },
    { id: 'payments',  icon: <LuCreditCard />,       label: 'Payments' },
  ];

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <div className="admin-logo-icon">🧠</div>
            <span className="admin-logo-text">IntelearnX</span>
          </div>
          <span className="admin-badge"><LuShield size={9} /> Admin</span>
        </div>

        <nav className="admin-nav">
          <span className="admin-nav-section">Navigation</span>
          {navItems.map(item => (
            <button
              key={item.id}
              className={`admin-nav-link ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-card">
            <div className="admin-user-avatar">👑</div>
            <div>
              <div className="admin-user-name">{user?.name || 'Admin'}</div>
              <div className="admin-user-role">Administrator</div>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 10, justifyContent: 'flex-start', gap: 8 }} onClick={logout}>
            <LuLogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="admin-main">
        <div className="admin-topbar">
          <div>
            <div className="admin-topbar-title">
              {navItems.find(n => n.id === activeTab)?.label || 'Overview'}
            </div>
            <div className="admin-topbar-subtitle">IntelearnX Control Panel</div>
          </div>
          <div className="admin-topbar-actions">
            <button className="icon-btn" onClick={() => setSidebarOpen(o => !o)} style={{ display: 'none' }}>
              <LuMenu />
            </button>
          </div>
        </div>

        <div className="admin-content">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
              <div className="spinner" />
            </div>
          ) : activeTab === 'overview' ? (
            <Overview stats={stats} setActiveTab={setActiveTab} />
          ) : activeTab === 'users' ? (
            <AdminUsers users={stats?.users || []} onRefresh={reload} />
          ) : activeTab === 'plans' ? (
            <AdminPlans plans={stats?.plans || []} onRefresh={reload} />
          ) : (
            <AdminPayments payments={stats?.payments || []} users={stats?.users || []} plans={stats?.plans || []} onRefresh={reload} />
          )}
        </div>
      </div>

      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
          onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}

function StatCard({ icon, value, label, color, bg, onClick }) {
  return (
    <div className="admin-stat-card" style={{ '--accent-color': color, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div className="admin-stat-icon" style={{ background: bg, color }}>{icon}</div>
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-label">{label}</div>
    </div>
  );
}

function Overview({ stats, setActiveTab }) {
  if (!stats) return null;
  const fmt = (n) => n >= 1000 ? `₹${(n/1000).toFixed(1)}k` : `₹${n}`;

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 4 }}>Welcome back, Admin 👑</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Here's what's happening on IntelearnX today.</p>
      </div>

      <div className="admin-stats-grid">
        <StatCard icon={<LuUsers />} value={stats.totalUsers} label="Total Users" color="#5B9BD5" bg="rgba(91,155,213,0.1)" onClick={() => setActiveTab('users')} />
        <StatCard icon={<LuUserCheck />} value={stats.activeUsers} label="Active Users" color="#4CAF82" bg="rgba(76,175,130,0.1)" />
        <StatCard icon={<LuDollarSign />} value={fmt(stats.totalRevenue)} label="Total Revenue" color="#c9a84c" bg="rgba(201,168,76,0.1)" onClick={() => setActiveTab('payments')} />
        <StatCard icon={<LuActivity />} value={fmt(stats.monthlyRevenue)} label="This Month" color="#E0A546" bg="rgba(224,165,70,0.1)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="admin-section">
          <div className="admin-section-header">
            <span className="admin-section-title"><LuUsers /> User Breakdown</span>
          </div>
          <div className="admin-section-body">
            {[
              { label: 'Students',  count: stats.totalStudents,  color: '#5B9BD5' },
              { label: 'Educators', count: stats.totalEducators, color: '#c9a84c' },
              { label: 'Admins',    count: stats.totalAdmins,    color: '#D4645C' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: r.color }}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-section">
          <div className="admin-section-header">
            <span className="admin-section-title"><LuCreditCard /> Payment Summary</span>
          </div>
          <div className="admin-section-body">
            {[
              { label: 'Completed', count: stats.completedPayments, color: '#4CAF82' },
              { label: 'Pending',   count: stats.pendingPayments,   color: '#E0A546' },
              { label: 'Total',     count: stats.totalPayments,     color: 'var(--text)' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: r.color }}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-section">
        <div className="admin-section-header">
          <span className="admin-section-title"><LuTrendingUp /> Recent Users</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('users')}>View All</button>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th><th>Role</th><th>XP</th><th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {(stats.users || []).slice(0, 5).map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-cell-avatar">{u.avatar || '🧑'}</div>
                      <div>
                        <div className="user-cell-name">{u.name}</div>
                        <div className="user-cell-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                  <td style={{ color: 'var(--accent)' }}>{u.xp || 0}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
