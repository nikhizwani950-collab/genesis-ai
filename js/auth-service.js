// js/auth-service.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { auth, db, isFirebaseConfigured } from './firebase-init.js';

export const ACCOUNT_STATUS = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  REJECTED: 'REJECTED'
};

export const PAYMENT_STATUS = {
  UNPAID: 'UNPAID',
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED'
};

function assertReady() {
  if (!isFirebaseConfigured() || !auth || !db) {
    throw new Error('Firebase belum dikonfigurasi. Sila isi js/firebase-config.js.');
  }
}

export async function logActivity(userId, action, details = {}) {
  if (!db || !userId) return;
  try {
    await addDoc(collection(db, 'activity_logs'), {
      userId,
      action,
      details,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.warn('Gagal simpan activity log:', err);
  }
}

export async function registerUser({ fullName, email, phone, password }) {
  assertReady();
  const cleanName = String(fullName || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPhone = String(phone || '').trim();

  if (!cleanName || !cleanEmail || !password) {
    throw new Error('Sila lengkapkan nama penuh, emel dan kata laluan.');
  }
  if (password.length < 6) {
    throw new Error('Kata laluan mestilah sekurang-kurangnya 6 aksara.');
  }

  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const uid = cred.user.uid;

  await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});

  const userRef = doc(db, 'users', uid);
  const existing = await getDoc(userRef);

  if (!existing.exists()) {
    await setDoc(userRef, {
      uid,
      fullName: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      role: 'buyer',
      accountStatus: 'ACTIVE',
      paymentStatus: 'PAID',
      plan: 'UNLIMITED_30',

      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      expiryDate: null,
      approvedAt: null
    });
  }

  await logActivity(uid, 'REGISTER', { email: cleanEmail });
  return cred.user;
}

export async function loginUser(email, password) {
  assertReady();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
  const uid = cred.user.uid;

  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    await updateDoc(userRef, { lastLogin: serverTimestamp() });
  } else {
    await setDoc(userRef, {
      uid,
      fullName: cred.user.displayName || cleanEmail.split('@')[0],
      email: cleanEmail,
      phone: '',
      role: 'buyer',
      accountStatus: 'ACTIVE',
      paymentStatus: 'PAID',
      plan: 'UNLIMITED_30',

      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      expiryDate: null,
      approvedAt: null
    });
  }

  await logActivity(uid, 'LOGIN', { device: navigator.userAgent.slice(0, 120) });
  return cred.user;
}

export async function logoutUser() {
  assertReady();
  const uid = auth.currentUser?.uid;
  if (uid) {
    await logActivity(uid, 'LOGOUT', {});
  }
  await signOut(auth);
}

export async function resetUserPassword(email) {
  assertReady();
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) throw new Error('Sila masukkan alamat emel anda.');
  await sendPasswordResetEmail(auth, cleanEmail);
}

export async function updateBuyerProfile(uid, { fullName, phone }) {
  assertReady();
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    fullName: String(fullName || '').trim(),
    phone: String(phone || '').trim(),
    updatedAt: serverTimestamp()
  });
  await logActivity(uid, 'UPDATE_PROFILE', {});
}

export async function getFreshIdToken() {
  assertReady();
  if (!auth.currentUser) throw new Error('Sesi log masuk telah tamat. Sila login semula.');
  return auth.currentUser.getIdToken(false);
}

export function watchAuthAndProfile(onUpdate) {
  if (!isFirebaseConfigured() || !auth || !db) {
    onUpdate({ configured: false, authUser: null, profile: null, loading: false });
    return () => {};
  }

  let unsubProfile = null;

  const unsubAuth = onAuthStateChanged(auth, (authUser) => {
    if (unsubProfile) {
      unsubProfile();
      unsubProfile = null;
    }

    if (!authUser) {
      onUpdate({ configured: true, authUser: null, profile: null, loading: false });
      return;
    }

    const userRef = doc(db, 'users', authUser.uid);
    unsubProfile = onSnapshot(
      userRef,
      (snap) => {
        const profile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        onUpdate({ configured: true, authUser, profile, loading: false });
      },
      (err) => {
        console.error('Profile listener error:', err);
        onUpdate({ configured: true, authUser, profile: null, loading: false, error: err.message });
      }
    );
  });

  return () => {
    if (unsubProfile) unsubProfile();
    unsubAuth();
  };
}

export function formatAuthError(err) {
  const code = err?.code || '';
  const map = {
    'auth/email-already-in-use': 'Emel ini telah didaftarkan. Sila log masuk.',
    'auth/invalid-email': 'Format alamat emel tidak sah.',
    'auth/weak-password': 'Kata laluan terlalu lemah (minimum 6 aksara).',
    'auth/user-not-found': 'Akaun tidak dijumpai.',
    'auth/wrong-password': 'Emel atau kata laluan salah.',
    'auth/invalid-credential': 'Emel atau kata laluan salah.',
    'auth/too-many-requests': 'Terlalu banyak cubaan. Sila tunggu sebentar dan cuba lagi.'
  };
  return map[code] || err?.message || 'Ralat pengesahan berlaku. Sila cuba lagi.';
}
