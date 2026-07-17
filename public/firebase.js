import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

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
    console.info("Firebase Web SDK config is not set. Existing auth remains active.");
    return null;
  }
  firebaseApp = initializeApp(config);
  firebaseAuth = getAuth(firebaseApp);
  window.studoxFirebaseApp = firebaseApp;
  window.studoxFirebaseAuth = firebaseAuth;
  return firebaseAuth;
}

export { firebaseApp, firebaseAuth };

initializeStudoxFirebase();
