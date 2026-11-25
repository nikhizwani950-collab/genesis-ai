// js/data-service.js
import {
  collection,
  query,
  where,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db, isFirebaseConfigured } from './firebase-init.js';
import { logActivity } from './auth-service.js';

function assertDb() {
  if (!isFirebaseConfigured() || !db) {
    throw new Error('Firebase Firestore belum sedia.');
  }
}

function getTimeMillis(item) {
  const ts = item?.updatedAt || item?.createdAt || item?.timestamp;
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatDateMY(ts) {
  if (!ts) return '-';
  let dateObj = null;
  if (typeof ts.toDate === 'function') {
    dateObj = ts.toDate();
  } else if (typeof ts.seconds === 'number') {
    dateObj = new Date(ts.seconds * 1000);
  } else {
    dateObj = new Date(ts);
  }
  if (!dateObj || Number.isNaN(dateObj.getTime())) return '-';
  return dateObj.toLocaleString('ms-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function subscribeUserCollection(colName, uid, onData, limitCount = 20) {
  if (!isFirebaseConfigured() || !db || !uid) {
    onData([]);
    return () => {};
  }

  const q = query(collection(db, colName), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => getTimeMillis(b) - getTimeMillis(a))
        .slice(0, limitCount);
      onData(items);
    },
    (err) => {
      console.warn(`Firestore listener [${colName}] error:`, err.message);
      onData([]);
    }
  );
}

export function watchUserDashboard(uid, onUpdate) {
  const state = {
    projects: [],
    products: [],
    payments: [],
    activities: []
  };

  const emit = () => onUpdate({ ...state });

  const unsubProjects = subscribeUserCollection('projects', uid, (items) => {
    state.projects = items;
    emit();
  }, 20);

  const unsubProducts = subscribeUserCollection('saved_products', uid, (items) => {
    state.products = items;
    emit();
  }, 20);

  const unsubPayments = subscribeUserCollection('payments', uid, (items) => {
    state.payments = items;
    emit();
  }, 15);

  const unsubActivities = subscribeUserCollection('activity_logs', uid, (items) => {
    state.activities = items;
    emit();
  }, 15);

  return () => {
    unsubProjects();
    unsubProducts();
    unsubPayments();
    unsubActivities();
  };
}

export async function saveUserProject(uid, { title, category = 'Genesis V2', summary = '', payload = {} }) {
  assertDb();
  const cleanTitle = String(title || '').trim() || 'Projek Tanpa Tajuk';
  const ref = await addDoc(collection(db, 'projects'), {
    userId: uid,
    title: cleanTitle,
    category: String(category || 'Genesis V2').trim(),
    summary: String(summary || '').trim(),
    payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await logActivity(uid, 'SAVE_PROJECT', { projectId: ref.id, title: cleanTitle });
  return ref.id;
}

export async function deleteUserProject(uid, projectId) {
  assertDb();
  await deleteDoc(doc(db, 'projects', projectId));
  await logActivity(uid, 'DELETE_PROJECT', { projectId });
}

export async function saveUserProduct(uid, { name, usp = '', targetAudience = '', notes = '' }) {
  assertDb();
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Sila masukkan nama produk.');
  const ref = await addDoc(collection(db, 'saved_products'), {
    userId: uid,
    name: cleanName,
    usp: String(usp || '').trim(),
    targetAudience: String(targetAudience || '').trim(),
    notes: String(notes || '').trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await logActivity(uid, 'SAVE_PRODUCT', { productId: ref.id, name: cleanName });
  return ref.id;
}

export async function deleteUserProduct(uid, productId) {
  assertDb();
  await deleteDoc(doc(db, 'saved_products', productId));
  await logActivity(uid, 'DELETE_PRODUCT', { productId });
}

export async function submitPaymentProof(uid, { plan, amount, reference, email }) {
  assertDb();
  const cleanRef = String(reference || '').trim();
  if (!cleanRef) throw new Error('Sila masukkan nombor rujukan transaksi.');

  const ref = await addDoc(collection(db, 'payments'), {
    userId: uid,
    email: String(email || '').trim().toLowerCase(),
    plan: String(plan || 'PRO_LIFETIME').trim(),
    amount: Number(amount) || 0,
    currency: 'MYR',
    reference: cleanRef,
    status: 'PENDING',
    createdAt: serverTimestamp()
  });
  await logActivity(uid, 'SUBMIT_PAYMENT', { paymentId: ref.id, plan, reference: cleanRef });
  return ref.id;
}
