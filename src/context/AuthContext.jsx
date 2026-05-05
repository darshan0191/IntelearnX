/**
 * Authentication Context — Firebase Auth
 * Handles sign-up, sign-in, sign-out, and user profile management.
 */
import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import {
  getUserProfile,
  saveUserProfile,
  updateUserProfile,
} from '../services/storageService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in — fetch profile from Realtime DB
        const profile = await getUserProfile(firebaseUser.uid);
        if (profile) {
          setUser(profile);
        } else {
          // Profile doesn't exist yet (edge case) — create minimal one
          const minimalProfile = {
            name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            email: firebaseUser.email,
            role: 'student',
            classCode: '',
            xp: 0,
            level: 1,
            avatar: '🧑‍🎓',
            loginStreak: 0,
            lastLogin: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };
          await saveUserProfile(firebaseUser.uid, minimalProfile);
          setUser({ id: firebaseUser.uid, ...minimalProfile });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    setError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Update login streak
      const profile = await getUserProfile(cred.user.uid);
      if (profile) {
        const lastLogin = new Date(profile.lastLogin || 0);
        const now = new Date();
        const diffDays = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));
        const newStreak = diffDays === 1 ? (profile.loginStreak || 0) + 1 : diffDays > 1 ? 1 : profile.loginStreak || 0;
        await updateUserProfile(cred.user.uid, {
          loginStreak: newStreak,
          lastLogin: now.toISOString(),
        });
      }
      return true;
    } catch (err) {
      const messages = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/too-many-requests': 'Too many attempts. Try again later.',
      };
      setError(messages[err.code] || err.message);
      return false;
    }
  };

  const register = async (userData) => {
    setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, userData.email, userData.password);

      // Set display name in Firebase Auth
      await updateProfile(cred.user, { displayName: userData.name });

      // Create profile in Realtime Database
      const profile = {
        name: userData.name,
        email: userData.email,
        role: userData.role || 'student',
        classCode: userData.classCode || '',
        xp: 0,
        level: 1,
        badges: [],
        loginStreak: 1,
        lastLogin: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        avatar: userData.avatar || getRandomAvatar(),
      };

      await saveUserProfile(cred.user.uid, profile);
      setUser({ id: cred.user.uid, ...profile });
      return true;
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/invalid-email': 'Invalid email address.',
      };
      setError(messages[err.code] || err.message);
      return false;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const updateUser = async (updates) => {
    if (!user) return;
    await updateUserProfile(user.id, updates);
    setUser((prev) => ({ ...prev, ...updates }));
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isStudent: user?.role === 'student',
    isEducator: user?.role === 'educator',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

function getRandomAvatar() {
  const avatars = ['🧑‍🎓', '👩‍🎓', '🧑‍💻', '👨‍🔬', '👩‍🔬', '🧑‍🏫', '👨‍🎓', '👩‍💻'];
  return avatars[Math.floor(Math.random() * avatars.length)];
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
