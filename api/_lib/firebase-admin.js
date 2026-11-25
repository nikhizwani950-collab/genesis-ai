// api/_lib/firebase-admin.js
import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length) return admin.app();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin environment variables tidak lengkap di Vercel.');
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

export function getAdminServices() {
  const app = initAdmin();
  return {
    admin,
    auth: admin.auth(app),
    db: admin.firestore(app)
  };
}

export async function verifyRequestUser(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (!header.startsWith('Bearer ')) {
    const err = new Error('Akses ditolak: Tiada token pengesahan.');
    err.status = 401;
    throw err;
  }

  const token = header.slice(7).trim();
  const { auth, db } = getAdminServices();
  const decoded = await auth.verifyIdToken(token);

  const userSnap = await db.collection('users').doc(decoded.uid).get();
  if (!userSnap.exists) {
    const err = new Error('Rekod profil pengguna tidak wujud.');
    err.status = 403;
    throw err;
  }

  return {
    uid: decoded.uid,
    email: decoded.email || '',
    profile: userSnap.data()
  };
}

export async function requireActiveBuyerOrAdmin(req) {
  const ctx = await verifyRequestUser(req);
  if (ctx.profile.accountStatus !== 'ACTIVE') {
    const err = new Error('Akaun belum aktif atau digantung. Sila lengkapkan pembayaran.');
    err.status = 403;
    throw err;
  }
  return ctx;
}

export async function requireAdmin(req) {
  const ctx = await verifyRequestUser(req);
  if (ctx.profile.role !== 'admin' || ctx.profile.accountStatus !== 'ACTIVE') {
    const err = new Error('Akses terhad kepada Admin yang disahkan sahaja.');
    err.status = 403;
    throw err;
  }
  return ctx;
}
