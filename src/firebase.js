/**
 * Firebase configuration and initialization.
 * Provides shared instances of Auth and Realtime Database.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBd2zmq7Ak8ImImuYtAK7PM4GW7voxd8Gg",
  authDomain: "intelearnx.firebaseapp.com",
  databaseURL: "https://intelearnx-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "intelearnx",
  storageBucket: "intelearnx.firebasestorage.app",
  messagingSenderId: "713799714010",
  appId: "1:713799714010:web:017ee20912826a3a69d1e3",
  measurementId: "G-4KXE1VXHKN",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;