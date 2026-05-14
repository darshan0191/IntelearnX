import { useState } from 'react';
import { updateUserRole, updateUserStatus, deleteUser, updateUserSubscription } from '../services/adminService';
import {
  LuUsers, LuSearch, LuPencil, LuTrash2, LuX, LuCheck,
  LuShieldCheck, LuUserX, LuUserCheck,
} from 'react-icons/lu';

export default function AdminUsers({ users, onRefresh }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editUser, setEditUser] = useState(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await updateUserRole(editUser.id, editUser.role);
      await updateUserStatus(editUser.id, editUser.status || 'active');
      showToast('User updated successfully');
      setEditUser(null);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (uid) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    await deleteUser(uid);
    showToast('User deleted');
    onRefresh();
  };

  const toggleStatus = async (u) => {
    const ns = u.status === 'suspended' ? 'active' : 'suspended';
    await updateUserStatus(u.id, ns);
    showToast(`User ${ns}`);
    onRefresh();
  };

  return (
    <div className="animate-fadeIn">
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="admin-section-title"><LuUsers /> All Users ({filtered.length})</span>
          <div className="admin-controls">
            <div className="admin-search">
              <LuSearch />
              <input placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="admin-filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="student">Student</option>
              <option value="educator">Educator</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th><th>Role</th><th>Status</th><th>Plan</th><th>XP</th><th>Joined</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No users found</td></tr>
              ) : filtered.map(u => (
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
                  <td>
                    <span className={`status-badge status-${u.status || 'active'}`}>
                      {u.status || 'active'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {u.subscriptionPlanName || 'Free'}
                  </td>
                  <td style={{ color: 'var(--accent)' }}>{u.xp || 0}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="icon-btn" title="Edit" onClick={() => setEditUser({ ...u })}>
                        <LuPencil size={13} />
                      </button>
                      <button className="icon-btn" title={u.status === 'suspended' ? 'Activate' : 'Suspend'} onClick={() => toggleStatus(u)}>
                        {u.status === 'suspended' ? <LuUserCheck size={13} /> : <LuUserX size={13} />}
                      </button>
                      <button className="icon-btn danger" title="Delete" onClick={() => handleDelete(u.id)}>
                        <LuTrash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editUser && (
        <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && setEditUser(null)}>
          <div className="admin-modal">
            <div className="admin-modal-header">
              <span className="admin-modal-title">Edit User</span>
              <button className="admin-modal-close" onClick={() => setEditUser(null)}><LuX size={14} /></button>
            </div>
            <div className="admin-form-grid">
              <div className="admin-form-group full-width">
                <label className="admin-form-label">Name</label>
                <input className="admin-form-input" value={editUser.name || ''} disabled />
              </div>
              <div className="admin-form-group full-width">
                <label className="admin-form-label">Email</label>
                <input className="admin-form-input" value={editUser.email || ''} disabled />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Role</label>
                <select className="admin-form-select" value={editUser.role} onChange={e => setEditUser(p => ({ ...p, role: e.target.value }))}>
                  <option value="student">Student</option>
                  <option value="educator">Educator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Status</label>
                <select className="admin-form-select" value={editUser.status || 'active'} onChange={e => setEditUser(p => ({ ...p, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setEditUser(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : <><LuCheck size={13} /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="admin-toast success"><LuShieldCheck size={16} style={{ color: '#4CAF82' }} />{toast}</div>}
    </div>
  );
}
