/**
 * Firebase configuration and initialization.
 * Provides shared instances of Auth and Realtime Database.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyD08eeqqdjsMOw6K1mZRDGhCu1BqW4r-Ag",
  authDomain: "student-portal-sih.firebaseapp.com",
  databaseURL: "https://student-portal-sih-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "student-portal-sih",
  storageBucket: "student-portal-sih.firebasestorage.app",
  messagingSenderId: "936263055945",
  appId: "1:936263055945:web:e6a44138125a526c11dd98",
  measurementId: "G-16TP2295WV",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
