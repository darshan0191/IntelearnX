import { useState } from 'react';
import {
  saveSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan,
} from '../services/adminService';
import { LuPackage, LuPlus, LuPencil, LuTrash2, LuX, LuCheck, LuShieldCheck } from 'react-icons/lu';

const EMPTY_PLAN = { name: '', price: '', currency: 'INR', billingCycle: 'monthly', features: '', maxStudents: '', isPopular: false, isActive: true, color: '#c9a84c' };

export default function AdminPlans({ plans, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [form, setForm] = useState(EMPTY_PLAN);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openCreate = () => { setForm(EMPTY_PLAN); setEditPlan(null); setShowModal(true); };
  const openEdit = (p) => {
    setEditPlan(p);
    setForm({ ...p, features: Array.isArray(p.features) ? p.features.join('\n') : p.features || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        maxStudents: Number(form.maxStudents),
        features: form.features.split('\n').map(f => f.trim()).filter(Boolean),
      };
      if (editPlan) {
        await updateSubscriptionPlan(editPlan.id, payload);
        showToast('Plan updated');
      } else {
        await saveSubscriptionPlan(payload);
        showToast('Plan created');
      }
      setShowModal(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this plan?')) return;
    await deleteSubscriptionPlan(id);
    showToast('Plan deleted');
    onRefresh();
  };

  const f = form;
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="animate-fadeIn">
      <div className="admin-section">
        <div className="admin-section-header">
          <span className="admin-section-title"><LuPackage /> Subscription Plans ({plans.length})</span>
          <button className="btn btn-primary btn-sm" onClick={openCreate}><LuPlus size={14} /> New Plan</button>
        </div>
        <div className="admin-section-body">
          {plans.length === 0 ? (
            <div className="empty-state">
              <LuPackage />
              <h3>No Plans Yet</h3>
              <p>Create your first subscription plan to get started.</p>
            </div>
          ) : (
            <div className="plans-grid">
              {plans.map(plan => (
                <div key={plan.id} className={`plan-card ${plan.isPopular ? 'popular' : ''}`} style={{ '--plan-color': plan.color || '#c9a84c' }}>
                  {plan.isPopular && <div className="plan-popular-badge">⭐ Popular</div>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div className="plan-name">{plan.name}</div>
                    <span className={`status-badge status-${plan.isActive ? 'active' : 'suspended'}`}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="plan-price">
                    <span className="plan-price-currency">₹</span>
                    <span className="plan-price-amount">{plan.price}</span>
                    <span className="plan-price-cycle">/{plan.billingCycle}</span>
                  </div>
                  <ul className="plan-features">
                    {(Array.isArray(plan.features) ? plan.features : []).slice(0, 4).map((feat, i) => (
                      <li key={i} className="plan-feature">
                        <div className="plan-feature-icon"><LuCheck size={8} /></div>
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                    Max Students: {plan.maxStudents === -1 ? 'Unlimited' : plan.maxStudents}
                  </div>
                  <div className="plan-actions">
                    <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openEdit(plan)}>
                      <LuPencil size={12} /> Edit
                    </button>
                    <button className="icon-btn danger" onClick={() => handleDelete(plan.id)}>
                      <LuTrash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="admin-modal">
            <div className="admin-modal-header">
              <span className="admin-modal-title">{editPlan ? 'Edit Plan' : 'Create Plan'}</span>
              <button className="admin-modal-close" onClick={() => setShowModal(false)}><LuX size={14} /></button>
            </div>
            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label className="admin-form-label">Plan Name</label>
                <input className="admin-form-input" placeholder="e.g. Pro" value={f.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Price (₹)</label>
                <input className="admin-form-input" type="number" placeholder="499" value={f.price} onChange={e => set('price', e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Billing Cycle</label>
                <select className="admin-form-select" value={f.billingCycle} onChange={e => set('billingCycle', e.target.value)}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Max Students (-1 = Unlimited)</label>
                <input className="admin-form-input" type="number" placeholder="100" value={f.maxStudents} onChange={e => set('maxStudents', e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Accent Color</label>
                <input className="admin-form-input" type="color" value={f.color} onChange={e => set('color', e.target.value)} style={{ height: 42, padding: 4 }} />
              </div>
              <div className="admin-form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 22 }}>
                <input type="checkbox" id="popular" checked={f.isPopular} onChange={e => set('isPopular', e.target.checked)} />
                <label htmlFor="popular" className="admin-form-label" style={{ margin: 0 }}>Mark as Popular</label>
                <input type="checkbox" id="active" checked={f.isActive} onChange={e => set('isActive', e.target.checked)} style={{ marginLeft: 10 }} />
                <label htmlFor="active" className="admin-form-label" style={{ margin: 0 }}>Active</label>
              </div>
              <div className="admin-form-group full-width">
                <label className="admin-form-label">Features (one per line)</label>
                <textarea className="admin-form-textarea" rows={5} placeholder={"Unlimited Quizzes\nAI Learning Path\nPDF Quiz"} value={f.features} onChange={e => set('features', e.target.value)} />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !f.name}>
                {saving ? 'Saving…' : <><LuCheck size={13} /> {editPlan ? 'Update' : 'Create'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="admin-toast success"><LuShieldCheck size={16} style={{ color: '#4CAF82' }} />{toast}</div>}
    </div>
  );
}
