/**
 * Admin Service — Firebase Realtime Database
 * Handles all admin-level CRUD: users, subscription plans, payments.
 */
import { db } from '../firebase';
import {
  ref, set, get, push, update, remove,
} from 'firebase/database';

// ===== User Management =====

export async function getAllUsersAdmin() {
  const snap = await get(ref(db, 'users'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, user]) => ({ id, ...user }));
}

export async function updateUserRole(uid, role) {
  await update(ref(db, `users/${uid}`), { role });
}

export async function updateUserStatus(uid, status) {
  await update(ref(db, `users/${uid}`), { status });
}

export async function deleteUser(uid) {
  await remove(ref(db, `users/${uid}`));
}

export async function updateUserSubscription(uid, planId, planName) {
  await update(ref(db, `users/${uid}`), {
    subscriptionPlan: planId,
    subscriptionPlanName: planName,
    subscriptionUpdatedAt: new Date().toISOString(),
  });
}

// ===== Subscription Plans =====

export async function getSubscriptionPlans() {
  const snap = await get(ref(db, 'subscriptionPlans'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, plan]) => ({ id, ...plan }));
}

export async function saveSubscriptionPlan(plan) {
  const planRef = push(ref(db, 'subscriptionPlans'));
  const newPlan = {
    ...plan,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await set(planRef, newPlan);
  return { id: planRef.key, ...newPlan };
}

export async function updateSubscriptionPlan(planId, updates) {
  await update(ref(db, `subscriptionPlans/${planId}`), {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteSubscriptionPlan(planId) {
  await remove(ref(db, `subscriptionPlans/${planId}`));
}

// ===== Payments =====

export async function getAllPayments() {
  const snap = await get(ref(db, 'payments'));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([id, payment]) => ({ id, ...payment }));
}

export async function savePayment(payment) {
  const payRef = push(ref(db, 'payments'));
  const newPayment = {
    ...payment,
    createdAt: new Date().toISOString(),
  };
  await set(payRef, newPayment);
  return { id: payRef.key, ...newPayment };
}

export async function updatePaymentStatus(paymentId, status) {
  await update(ref(db, `payments/${paymentId}`), {
    status,
    updatedAt: new Date().toISOString(),
  });
}

// ===== Platform Analytics =====

export async function getPlatformStats() {
  const [usersSnap, paymentsSnap, plansSnap] = await Promise.all([
    get(ref(db, 'users')),
    get(ref(db, 'payments')),
    get(ref(db, 'subscriptionPlans')),
  ]);

  const users = usersSnap.exists()
    ? Object.entries(usersSnap.val()).map(([id, u]) => ({ id, ...u }))
    : [];
  const payments = paymentsSnap.exists()
    ? Object.entries(paymentsSnap.val()).map(([id, p]) => ({ id, ...p }))
    : [];
  const plans = plansSnap.exists()
    ? Object.entries(plansSnap.val()).map(([id, p]) => ({ id, ...p }))
    : [];

  const totalRevenue = payments
    .filter(p => p.status === 'completed')
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  const monthlyRevenue = payments
    .filter(p => {
      const d = new Date(p.createdAt);
      const now = new Date();
      return p.status === 'completed' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  return {
    totalUsers: users.length,
    totalStudents: users.filter(u => u.role === 'student').length,
    totalEducators: users.filter(u => u.role === 'educator').length,
    totalAdmins: users.filter(u => u.role === 'admin').length,
    activeUsers: users.filter(u => u.status !== 'suspended').length,
    totalRevenue,
    monthlyRevenue,
    totalPayments: payments.length,
    completedPayments: payments.filter(p => p.status === 'completed').length,
    pendingPayments: payments.filter(p => p.status === 'pending').length,
    totalPlans: plans.length,
    users,
    payments,
    plans,
  };
}

// ===== Seed Default Plans (first-time setup) =====

export async function seedDefaultPlans() {
  const snap = await get(ref(db, 'subscriptionPlans'));
  if (snap.exists()) return; // Already seeded

  const defaultPlans = [
    {
      name: 'Free',
      price: 0,
      currency: 'INR',
      billingCycle: 'monthly',
      features: ['5 AI Quizzes/month', 'Basic Learning Path', 'Leaderboard Access'],
      maxStudents: 30,
      isPopular: false,
      isActive: true,
      color: '#6b6b6b',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      name: 'Pro',
      price: 499,
      currency: 'INR',
      billingCycle: 'monthly',
      features: ['Unlimited AI Quizzes', 'Advanced Learning Paths', 'PDF Quiz AI', 'Resume Builder', 'Portfolio Builder', 'Priority Support'],
      maxStudents: 100,
      isPopular: true,
      isActive: true,
      color: '#c9a84c',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      name: 'Institution',
      price: 2999,
      currency: 'INR',
      billingCycle: 'monthly',
      features: ['Everything in Pro', 'Unlimited Students', 'Custom Branding', 'Dedicated Support', 'Analytics Dashboard', 'API Access'],
      maxStudents: -1,
      isPopular: false,
      isActive: true,
      color: '#5B9BD5',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  for (const plan of defaultPlans) {
    await push(ref(db, 'subscriptionPlans'), plan);
  }
}
