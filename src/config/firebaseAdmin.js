const admin = require("firebase-admin");

let firebaseAdminApp = null;

function normalizePrivateKey(key = "") {
  return key.replace(/\\n/g, "\n");
}

function hasFirebaseAdminConfig() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

function initializeFirebaseAdmin() {
  if (firebaseAdminApp) return firebaseAdminApp;
  if (!hasFirebaseAdminConfig()) return null;
  if (admin.apps.length) {
    firebaseAdminApp = admin.app();
    return firebaseAdminApp;
  }
  firebaseAdminApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
  });
  return firebaseAdminApp;
}

module.exports = {
  admin,
  initializeFirebaseAdmin,
  firebaseAdminApp: initializeFirebaseAdmin(),
};
