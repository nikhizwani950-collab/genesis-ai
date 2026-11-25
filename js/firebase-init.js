// js/firebase-init.js
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { FIREBASE_CONFIG, isFirebaseConfigured } from './firebase-config.js';

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured()) {
  app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  db = getFirestore(app);

  // Pastikan sesi login kekal selepas refresh / tutup tab pada Android & Desktop
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Auth persistence warning:', err);
  });
} else {
  console.error('Genesis AI: FIREBASE_CONFIG belum diisi dalam js/firebase-config.js');
}

export { app, auth, db, isFirebaseConfigured };
