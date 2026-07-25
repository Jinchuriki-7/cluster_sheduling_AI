import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyC8O63raCiKZ7DybrX4_24ZDIUyjBOsfYM",
  authDomain: "clusteros300809.firebaseapp.com",
  projectId: "clusteros300809",
  storageBucket: "clusteros300809.firebasestorage.app",
  messagingSenderId: "539405810338",
  appId: "1:539405810338:web:466dd102d440859d54f5fb",
  measurementId: "G-PC7GD7C2QV",
  databaseURL: "https://clusteros300809-default-rtdb.firebaseio.com"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);

export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export default app;
