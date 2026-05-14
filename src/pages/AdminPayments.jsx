import { useState } from 'react';
import { savePayment, updatePaymentStatus } from '../services/adminService';
import {
  LuCreditCard, LuPlus, LuSearch, LuX, LuCheck, LuShieldCheck,
  LuIndianRupee, LuTrendingUp,
} from 'react-icons/lu';

const EMPTY = { userId: '', userName: '', planId: '', planName: '', amount: '', method: 'upi', status: 'completed', transactionId: '' };

export default function AdminPayments({ payments, users, plans, onRefresh }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const filtered = payments.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = p.userName?.toLowerCase().includes(q) || p.transactionId?.toLowerCase().includes(q) || p.planName?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const handleUserChange = (uid) => {
    const u = users.find(u => u.id === uid);
    set('userId', uid);
    set('userName', u?.name || '');
  };

  const handlePlanChange = (pid) => {
    const p = plans.find(p => p.id === pid);
    set('planId', pid);
    set('planName', p?.name || '');
    set('amount', p?.price || '');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePayment({ ...form, amount: Number(form.amount) });
      showToast('Payment recorded');
      setShowModal(false);
      setForm(EMPTY);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    await updatePaymentStatus(id, status);
    showToast(`Payment marked as ${status}`);
    onRefresh();
  };

  const totalRevenue = payments.filter(p => p.status === 'completed').reduce((a, p) => a + (p.amount || 0), 0);

  return (
    <div className="animate-fadeIn">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, color: '#4CAF82', bg: 'rgba(76,175,130,0.1)', icon: <LuIndianRupee /> },
          { label: 'Completed', value: payments.filter(p => p.status === 'completed').length, color: '#5B9BD5', bg: 'rgba(91,155,213,0.1)', icon: <LuCheck /> },
          { label: 'Pending', value: payments.filter(p => p.status === 'pending').length, color: '#E0A546', bg: 'rgba(224,165,70,0.1)', icon: <LuTrendingUp /> },
        ].map(c => (
          <div key={c.label} className="admin-stat-card" style={{ '--accent-color': c.color }}>
            <div className="admin-stat-icon" style={{ background: c.bg, color: c.color }}>{c.icon}</div>
            <div className="admin-stat-value">{c.value}</div>
            <div className="admin-stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="admin-section">
        <div className="admin-section-header">
          <span className="admin-section-title"><LuCreditCard /> Payments ({filtered.length})</span>
          <div className="admin-controls">
            <div className="admin-search">
              <LuSearch />
              <input placeholder="Search payments…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="admin-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
              <LuPlus size={14} /> Record
            </button>
          </div>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th><th>Plan</th><th>Amount</th><th>Method</th><th>Status</th><th>Transaction ID</th><th>Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No payments found</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.userName || '—'}</td>
                  <td style={{ color: 'var(--accent)' }}>{p.planName || '—'}</td>
                  <td style={{ fontWeight: 600, color: '#4CAF82' }}>₹{(p.amount || 0).toLocaleString()}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>{p.method || '—'}</td>
                  <td><span className={`status-badge status-${p.status}`}>{p.status}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {p.transactionId || '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <select
                      className="admin-filter-select"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      value={p.status}
                      onChange={e => handleStatusChange(p.id, e.target.value)}
                    >
                      <option value="completed">Completed</option>
                      <option value="pending">Pending</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="admin-modal">
            <div className="admin-modal-header">
              <span className="admin-modal-title">Record Payment</span>
              <button className="admin-modal-close" onClick={() => setShowModal(false)}><LuX size={14} /></button>
            </div>
            <div className="admin-form-grid">
              <div className="admin-form-group full-width">
                <label className="admin-form-label">User</label>
                <select className="admin-form-select" value={form.userId} onChange={e => handleUserChange(e.target.value)}>
                  <option value="">Select user…</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              <div className="admin-form-group full-width">
                <label className="admin-form-label">Subscription Plan</label>
                <select className="admin-form-select" value={form.planId} onChange={e => handlePlanChange(e.target.value)}>
                  <option value="">Select plan…</option>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ₹{p.price}</option>)}
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Amount (₹)</label>
                <input className="admin-form-input" type="number" value={form.amount} onChange={e => set('amount', e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Payment Method</label>
                <select className="admin-form-select" value={form.method} onChange={e => set('method', e.target.value)}>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="netbanking">Net Banking</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Status</label>
                <select className="admin-form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Transaction ID</label>
                <input className="admin-form-input" placeholder="TXN123…" value={form.transactionId} onChange={e => set('transactionId', e.target.value)} />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !form.userId || !form.amount}>
                {saving ? 'Saving…' : <><LuCheck size={13} /> Record Payment</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="admin-toast success"><LuShieldCheck size={16} style={{ color: '#4CAF82' }} />{toast}</div>}
    </div>
  );
}
