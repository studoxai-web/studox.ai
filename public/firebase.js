import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

let firebaseApp = null;
let firebaseAuth = null;

async function loadFirebaseConfig() {
  const response = await fetch("/api/firebase/config");
  if (!response.ok) return null;
  return response.json();
}

function hasRequiredFirebaseConfig(config = {}) {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export async function initializeStudoxFirebase() {
  if (firebaseAuth) return firebaseAuth;
  const config = await loadFirebaseConfig();
  if (!hasRequiredFirebaseConfig(config)) {
    console.info("Firebase Web SDK config is not set.");
    return null;
  }
  firebaseApp = initializeApp(config);
  firebaseAuth = getAuth(firebaseApp);
  window.studoxFirebaseApp = firebaseApp;
  window.studoxFirebaseAuth = firebaseAuth;
  return firebaseAuth;
}

export { firebaseApp, firebaseAuth };

window.studoxFirebase = {
  initialize: initializeStudoxFirebase,
  get auth() {
    return firebaseAuth;
  },
  async createUserWithEmailAndPassword(email, password) {
    const auth = await initializeStudoxFirebase();
    if (!auth) throw new Error("Firebase is not configured.");
    return createUserWithEmailAndPassword(auth, email, password);
  },
  async signInWithEmailAndPassword(email, password) {
    const auth = await initializeStudoxFirebase();
    if (!auth) throw new Error("Firebase is not configured.");
    return signInWithEmailAndPassword(auth, email, password);
  },
  updateProfile,
  async sendEmailVerification(user) {
    return sendEmailVerification(user);
  },
  async sendPasswordResetEmail(email) {
    const auth = await initializeStudoxFirebase();
    if (!auth) throw new Error("Firebase is not configured.");
    return sendPasswordResetEmail(auth, email);
  },
  async signOut() {
    const auth = await initializeStudoxFirebase();
    if (auth) await signOut(auth);
  },
  async onAuthStateChanged(callback) {
    const auth = await initializeStudoxFirebase();
    if (!auth) {
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(auth, callback);
  },
};

window.studoxFirebaseReady = initializeStudoxFirebase();
