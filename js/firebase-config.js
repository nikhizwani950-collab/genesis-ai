// js/firebase-config.js
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBaKorMjl6-DfDyiUq3xEo1bFZD4CBlfKM',
  authDomain: 'genesis-ai-v2-92bba.firebaseapp.com',
  projectId: 'genesis-ai-v2-92bba',
  storageBucket: 'genesis-ai-v2-92bba.firebasestorage.app',
  messagingSenderId: '78166202778',
  appId: '1:78166202778:web:1c440973df97c01c0a0223'
};

export function isFirebaseConfigured() {
  return (
    Boolean(FIREBASE_CONFIG.apiKey) &&
    !FIREBASE_CONFIG.apiKey.startsWith('REPLACE_WITH_') &&
    Boolean(FIREBASE_CONFIG.projectId) &&
    !FIREBASE_CONFIG.projectId.startsWith('REPLACE_WITH_')
  );
}

