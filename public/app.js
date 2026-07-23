const app = document.getElementById("app");
const toastHost = document.getElementById("toastHost");

const apiBase = window.location.port === "4100" ? "http://localhost:4500/api" : "/api";
let publicConfigPromise = null;
let googleScriptPromise = null;
const themeKey = "studox-theme";
const mentorFreeChatLimit = 10;
const mentorLimitTemporarilyDisabled = true;
const pendingRoadmapKey = "studox-pending-roadmap";

function getStoredTheme() {
  return localStorage.getItem(themeKey) || "light";
}

function resolveTheme(theme = getStoredTheme()) {
  if (theme === "system") return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return theme === "dark" ? "dark" : "light";
}

function applyTheme(theme = getStoredTheme()) {
  const resolved = resolveTheme(theme);
  localStorage.setItem(themeKey, theme);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = theme;
  document.body.dataset.theme = resolved;
  document.body.dataset.themePreference = theme;
}

function isDarkTheme() {
  return resolveTheme(getStoredTheme()) === "dark";
}

applyTheme(getStoredTheme());

window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
  if (getStoredTheme() === "system") applyTheme("system");
});
const defaultUser = {
  name: "Jayesh kumar Sahu",
  email: "aarav@studox.ai",
  avatar: "AS",
  goal: "Full Stack Developer",
  level: "Intermediate",
  plan: "free",
  xp: 12840,
};

let currentUser = JSON.parse(localStorage.getItem("studox-user") || "null") || defaultUser;
let adminResource = "users";
let adminSearchTerm = "";
let adminStatusFilter = "all";
let adminPageIndex = 1;
let adminSearchTimer = null;
let pendingRoadmapGeneration = false;
let pendingRoadmapSelection = false;
let assessmentStep = 0;
const assessmentAnswers = {};
const counsellingState = { step: "education", education: "", skills: "", messages: [], report: null, provider: "local", loading: false, error: "" };
const pendingAssessmentKey = "studox-pending-assessment";
let firebaseAuthReady = false;
let firebaseCurrentUser = null;
let firebaseAuthReadyPromise = null;
let firebaseSessionSyncPromise = null;

if (localStorage.getItem("demoSession") === "true" && !localStorage.getItem("studox-token")) {
  localStorage.removeItem("demoSession");
  localStorage.removeItem("studox-user");
  currentUser = defaultUser;
}

function hasDemoSession() {
  return Boolean(firebaseCurrentUser || localStorage.getItem("studox-token"));
}

function createDemoSession(user = currentUser) {
  localStorage.setItem("studox-user", JSON.stringify(user));
}

function clearDemoSession() {
  window.studoxFirebase?.signOut?.().catch(() => {});
  firebaseCurrentUser = null;
  firebaseSessionSyncPromise = null;
  localStorage.removeItem("demoSession");
  localStorage.removeItem("studox-token");
  localStorage.removeItem("studox-user");
  localStorage.removeItem("studox-plan");
  localStorage.removeItem("studox-auth-provider");
  localStorage.removeItem("studox-return-route");
  currentUser = defaultUser;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function getFirebaseBridge() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (window.studoxFirebase) return window.studoxFirebase;
    await delay(50);
  }
  return window.studoxFirebase || null;
}

async function getFirebaseIdToken(forceRefresh = false) {
  const user = firebaseCurrentUser || window.studoxFirebase?.auth?.currentUser;
  if (!user) return "";
  return user.getIdToken(forceRefresh);
}

async function syncStudoxFirebaseSession(user) {
  if (!user) return null;
  if (firebaseSessionSyncPromise) return firebaseSessionSyncPromise;
  firebaseSessionSyncPromise = (async () => {
    const token = await user.getIdToken();
    const result = await authRequest("/auth/firebase", null, token);
    if (!result?.ok || !result.user) throw new Error(result?.message || "Firebase session sync failed.");
    saveAuthSession(result);
    return result;
  })();
  try {
    return await firebaseSessionSyncPromise;
  } finally {
    firebaseSessionSyncPromise = null;
  }
}

async function waitForFirebaseAuth() {
  if (firebaseAuthReady) return firebaseCurrentUser;
  if (firebaseAuthReadyPromise) return firebaseAuthReadyPromise;

  firebaseAuthReadyPromise = (async () => {
    const bridge = await getFirebaseBridge();
    if (!bridge) {
      firebaseAuthReady = true;
      return null;
    }
    await window.studoxFirebaseReady?.catch?.(() => null);
    return new Promise((resolve) => {
      bridge.onAuthStateChanged(async (user) => {
        firebaseCurrentUser = user || null;
        if (user) {
          try {
            await syncStudoxFirebaseSession(user);
          } catch (_error) {
            firebaseCurrentUser = null;
          }
        }
        firebaseAuthReady = true;
        resolve(firebaseCurrentUser);
      }).catch(() => {
        firebaseAuthReady = true;
        resolve(null);
      });
    });
  })();

  return firebaseAuthReadyPromise;
}

const icons = {
  logo: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7.5 12 3l8 4.5-8 4.5L4 7.5Z" stroke-width="2" stroke-linejoin="round"/><path d="m6.5 11 5.5 3.1 5.5-3.1v4.7L12 19 6.5 15.7V11Z" stroke-width="2" stroke-linejoin="round"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none"><path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z" stroke-width="2"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z" stroke-width="2"/><path d="M9 3v15M15 6v15" stroke-width="2"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" stroke-width="2"/><path d="M4 5.5V21" stroke-width="2"/></svg>',
  test: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 3h8l2 3v15H6V6l2-3Z" stroke-width="2"/><path d="M9 12h6M9 16h4" stroke-width="2"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none"><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" stroke-width="2"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 7V5h6v2M4 8h16v11H4V8Z" stroke-width="2"/><path d="M4 13h16" stroke-width="2"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" stroke-width="2"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v4M8 21h8M10 17h4" stroke-width="2"/></svg>',
  bot: '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="7" width="14" height="11" rx="3" stroke-width="2"/><path d="M12 7V4M9 12h.01M15 12h.01M9 16h6" stroke-width="2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none"><path d="M20 21a8 8 0 0 0-16 0" stroke-width="2"/><circle cx="12" cy="7" r="4" stroke-width="2"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" stroke-width="2"/><path d="M19.4 15a8 8 0 0 0 .1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L15 6.5h-6L8.6 9a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8 8 0 0 0 .1 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h6l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5Z" stroke-width="1.6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke-width="2"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none"><path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" stroke-width="2"/><path d="M10 21h4" stroke-width="2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke-width="2"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 19V5M4 19h16" stroke-width="2"/><path d="M8 16v-5M12 16V8M16 16v-7" stroke-width="2"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3Z" stroke-width="2"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke-width="2"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke-width="2"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none"><path d="M21 14.6A8 8 0 0 1 9.4 3 7 7 0 1 0 21 14.6Z" stroke-width="2" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke-width="2"/></svg>',
  "arrow-right": '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke-width="2"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke-width="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke-width="2"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke-width="2"/></svg>',
  resume: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 3h7l4 4v14H7V3Z" stroke-width="2"/><path d="M14 3v5h5M9 13h6M9 17h6" stroke-width="2"/></svg>',
  admin: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z" stroke-width="2"/><path d="M9 12l2 2 4-5" stroke-width="2"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.15-1.1-1.46-1.1-1.46-.9-.61.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.33 1.08 2.9.83.09-.64.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.03A9.5 9.5 0 0 1 12 7.04c.85 0 1.7.11 2.5.33 1.9-1.3 2.74-1.03 2.74-1.03.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>',
  html5: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m4 2 1.45 16.3L12 22l6.55-3.7L20 2H4Zm12.85 5.32H9.16l.18 2.05h7.33l-.55 6.14L12 17.78l-4.1-2.27-.28-3.12h2.01l.14 1.58 2.23 1.2 2.24-1.2.23-2.59H7.44l-.54-6.07h10.13l-.18 2.01Z"/></svg>',
  js: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3V3Zm10.2 13.95c.37.75 1.12 1.35 2.35 1.35 1.41 0 2.45-.74 2.45-2.1 0-1.26-.72-1.82-2-2.37l-.37-.16c-.65-.28-.93-.46-.93-.9 0-.36.27-.63.72-.63.43 0 .7.18.96.63l1.33-.85c-.5-.89-1.2-1.23-2.29-1.23-1.44 0-2.36.92-2.36 2.13 0 1.31.77 1.93 1.93 2.43l.37.16c.69.3 1.1.48 1.1.97 0 .41-.39.71-1 .71-.72 0-1.13-.37-1.45-.9l-1.37.79Zm-5.05.15c.39.82 1.08 1.2 2.08 1.2 1.24 0 2.1-.66 2.1-2.1v-5.42h-1.68v5.4c0 .58-.24.74-.61.74-.39 0-.55-.26-.73-.58l-1.36.76Z"/></svg>',
  node: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 3.5 6.9v9.8L12 21.6l8.5-4.9V6.9L12 2Zm-1.65 13.9H8.8v-4.2c0-.72-.37-1.08-1-1.08-.68 0-1.08.42-1.08 1.18v4.1H5.16V9.35h1.5v.75c.34-.56.92-.9 1.72-.9 1.23 0 1.97.82 1.97 2.18v4.52Zm3.93.12c-1.9 0-3.12-1.42-3.12-3.4 0-1.98 1.22-3.4 3.12-3.4 1.91 0 3.13 1.42 3.13 3.4 0 1.98-1.22 3.4-3.13 3.4Zm0-1.36c.93 0 1.5-.78 1.5-2.04 0-1.27-.57-2.04-1.5-2.04-.92 0-1.49.77-1.49 2.04 0 1.26.57 2.04 1.49 2.04Z"/></svg>',
  react: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="2.2" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.6" stroke="currentColor" stroke-width="1.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" stroke="currentColor" stroke-width="1.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" stroke="currentColor" stroke-width="1.6" transform="rotate(120 12 12)"/></svg>',
};

const sideLinks = [
  ["dashboard", "Dashboard", "home"],
  ["roadmap", "Roadmap", "map"],
  ["courses", "Courses", "book"],
  ["tests", "Tests", "test"],
  ["dsa", "DSA Practice", "code"],
  ["resume", "Resume Builder", "resume"],
  ["projects", "Projects", "briefcase"],
  ["internships", "Internships", "briefcase"],
  ["hackathons", "Hackathons", "trophy"],
  ["certificates", "Certificates", "star"],
  ["mentor", "AI Mentor", "bot"],
  ["profile", "Profile", "user"],
  ["settings", "Settings", "settings"],
  ["admin", "Admin Panel", "admin"],
];
const webAvailableFeatureRoutes = new Set(["dashboard", "roadmap", "courses", "mentor", "profile", "settings", "admin"]);
const appComingSoonRoutes = new Set(sideLinks.map(([key]) => key).filter((key) => !webAvailableFeatureRoutes.has(key)));
const appComingSoonLabels = Object.fromEntries(sideLinks.map(([key, label]) => [key, label]));

function isAdminUser() {
  return currentUser?.role === "admin";
}

function isAppComingSoonRoute(route) {
  return appComingSoonRoutes.has(String(route || "").replace("#", ""));
}

function appComingSoonLabel(route) {
  return appComingSoonLabels[String(route || "").replace("#", "")] || "This feature";
}

const dashboardStats = [
  ["Overall Progress", 72, "%", "chart", "12% faster this month"],
  ["Tests Completed", 18, "", "test", "4 this week"],
  ["Skills Mastered", 36, "", "star", "React, Node, MongoDB"],
  ["XP Points", 12840, "", "trophy", "Level 12 learner"],
  ["Learning Time", 126, "h", "book", "8h this week"],
];

const courses = [
  {
    title: "Full Stack Developer",
    level: "Intermediate",
    progress: 64,
    students: "12.4k",
    modules: 9,
    desc: "Build production-ready web apps using React, Node.js, Express and MongoDB.",
  },
  {
    title: "Data Structures Mastery",
    level: "Core",
    progress: 48,
    students: "9.2k",
    modules: 12,
    desc: "Arrays, trees, graphs, dynamic programming and interview pattern practice.",
  },
  {
    title: "AI Product Builder",
    level: "Advanced",
    progress: 31,
    students: "5.8k",
    modules: 7,
    desc: "Use AI APIs, prompts, embeddings and automation to build real products.",
  },
];

const modules = [
  ["HTML, CSS and responsive systems", "completed", "8 lessons", "100%"],
  ["JavaScript fundamentals", "completed", "12 lessons", "100%"],
  ["React components and routing", "progress", "14 lessons", "62%"],
  ["Node.js and Express APIs", "progress", "11 lessons", "38%"],
  ["MongoDB and Mongoose", "locked", "9 lessons", "0%"],
  ["Capstone project and deployment", "locked", "7 lessons", "0%"],
];

const tests = [
  ["React Weekly Test", "Jul 08", "45 min", "20 questions"],
  ["DSA Arrays Sprint", "Jul 10", "60 min", "18 questions"],
  ["Backend API Quiz", "Jul 12", "40 min", "16 questions"],
];

const dsaProblems = [
  ["Two Sum", "Array", "Easy", "Solved", "98%"],
  ["Longest Substring", "String", "Medium", "Review", "72%"],
  ["Binary Tree Level Order", "Tree", "Medium", "Solved", "81%"],
  ["Merge Intervals", "Greedy", "Medium", "Attempted", "64%"],
];

const projects = [
  ["AI Study Planner", "React, Node, MongoDB", "Featured", "1.8k views", "Portfolio-ready planner with adaptive weekly goals."],
  ["DSA Visualizer", "JavaScript, Canvas", "Published", "920 views", "Animated sorting, graph and tree algorithm explorer."],
  ["Resume ATS Lab", "Express, PDF", "Draft", "410 views", "Resume scoring, keyword matching and improvement suggestions."],
];

const internships = [
  ["Frontend Developer Intern", "BluePeak Labs", "Remote", "3 months", "$600/mo", "94%"],
  ["MERN Stack Intern", "NovaWorks", "Bengaluru", "6 months", "$800/mo", "89%"],
  ["AI Product Intern", "SkillForge", "Hybrid", "4 months", "$700/mo", "86%"],
];

const hackathons = [
  ["Build for Campus", "48 hours", "AI + Education", "$8,000 prizes", "Jul 19"],
  ["Climate Code Sprint", "72 hours", "Sustainability", "$12,000 prizes", "Aug 02"],
  ["Fintech Future Jam", "36 hours", "Payments", "$6,500 prizes", "Aug 15"],
];

const certificates = [
  ["React Foundations", "Frontend", "Jun 18", "Verified"],
  ["DSA 100 Problems", "Programming", "Jun 28", "Verified"],
  ["MongoDB Basics", "Database", "Jul 03", "Verified"],
];

function icon(name) {
  return `<span class="icon">${icons[name] || icons.star}</span>`;
}

function brand() {
  return `<a href="#landing" class="brand" data-route="landing">
    <span class="brand-mark">${icons.logo}</span>
    <span class="brand-text">Studox<span>.ai</span></span>
  </a>`;
}

function setRoute(route) {
  if (isAppComingSoonRoute(route)) {
    showAppComingSoonModal(route);
    window.location.hash = hasDemoSession() ? "dashboard" : "landing";
    return;
  }
  window.location.hash = route;
}

function scrollAssessmentToTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.querySelector(".assessment-view")?.scrollIntoView({ block: "start" });
  });
}

function renderAssessmentScreen(options = {}) {
  app.innerHTML = assessmentQuestionScreen();
  bindPage();
  if (options.scroll !== false) scrollAssessmentToTop();
}

function getRoute() {
  return (window.location.hash || "#landing").replace("#", "");
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  toastHost.appendChild(node);
  window.setTimeout(() => {
    node.style.opacity = "0";
    node.style.transform = "translateX(20px)";
    window.setTimeout(() => node.remove(), 220);
  }, 2600);
}
function closeAppComingSoonModal() {
  document.querySelector(".app-coming-soon-backdrop")?.remove();
}

function showAppComingSoonModal(route) {
  const label = appComingSoonLabel(route);
  closeAppComingSoonModal();
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="app-coming-soon-backdrop" role="dialog" aria-modal="true" aria-label="Studox.ai app coming soon">
      <section class="app-coming-soon-modal">
        <button class="modal-close" type="button" data-app-coming-close aria-label="Close">x</button>
        <div class="app-coming-icon"><span>${icon("lock")}</span></div>
        <span class="ai-pill">STUDOX.AI APP</span>
        <h2>${label} is coming to the app</h2>
        <p>This feature will be available inside the Studox.ai app. The app is coming soon with the complete student toolkit, while Roadmap, Courses and AI Mentor stay open on web.</p>
        <div class="app-coming-actions">
          <button class="btn" type="button" data-app-coming-close>Got it</button>
          <a class="btn primary glow" href="#roadmap" data-app-coming-open>Open Roadmap</a>
        </div>
      </section>
    </div>`,
  );
  document.querySelectorAll("[data-app-coming-close]").forEach((node) => node.addEventListener("click", closeAppComingSoonModal));
  document.querySelector("[data-app-coming-open]")?.addEventListener("click", closeAppComingSoonModal);
}
function handleAppComingSoonLinkClick(event) {
  const target = event.target instanceof Element ? event.target : event.target?.parentElement;
  const link = target?.closest("a[href^='#'], [data-route]");
  if (!link) return;
  const rawRoute = link.dataset.route || link.getAttribute("href")?.replace("#", "");
  if (!isAppComingSoonRoute(rawRoute)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  document.getElementById("sidebar")?.classList.remove("open");
  document.querySelector("[data-mobile-close]")?.classList.remove("open");
  showAppComingSoonModal(rawRoute);
}

document.addEventListener("click", handleAppComingSoonLinkClick, true);
function handleGlobalRoadmapStart(event) {
  const trigger = event.target.closest?.("[data-action='start-assessment']");
  if (!trigger) return;
  event.preventDefault();
  event.stopPropagation();
  beginRoadmapCounselling(event);
}
document.addEventListener("click", handleGlobalRoadmapStart, true);

async function api(path, options = {}) {
  try {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    const firebaseToken = await getFirebaseIdToken();
    const legacyToken = localStorage.getItem("studox-token");
    if (firebaseToken) headers.Authorization = `Bearer ${firebaseToken}`;
    else if (legacyToken) headers.Authorization = `Bearer ${legacyToken}`;

    const res = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
    });
    return await res.json();
  } catch (error) {
    return null;
  }
}

function statCards(stats = dashboardStats) {
  return `<div class="stats-grid">
    ${stats
      .map(
        ([label, value, suffix, iconName, note]) => `<article class="stat-card">
          <div class="stat-top">
            <span class="stat-icon">${icon(iconName)}</span>
            <span class="chip green">${note}</span>
          </div>
          <strong><span class="count-up" data-value="${value}">0</span>${suffix}</strong>
          <span>${label}</span>
        </article>`,
      )
      .join("")}
  </div>`;
}

function barChart(values = [48, 66, 52, 78, 72, 88, 82], labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
  return `<div class="bar-chart">
    ${values.map((value, index) => `<div class="bar" style="height:${value}%"><span>${labels[index]}</span></div>`).join("")}
  </div>`;
}

function progress(label, value) {
  return `<div>
    <div class="form-row"><strong>${label}</strong><span>${value}%</span></div>
    <div class="mini-progress" style="--value:${value}%"><span></span></div>
  </div>`;
}

function studoxLandingPage() {
  return `<main class="landing view landing-page">
    <nav class="landing-nav" id="navbar">
      ${brand()}
      <div class="nav-links" id="navLinks">
        <a href="#landing" class="active">Home</a>
        <a href="#how-it-works">How It Works</a>
        <a href="#features">Features</a>
        <a href="#roadmap">Roadmap</a>
        <a href="#courses">Courses</a>
        <a href="#about">About Us</a>
      </div>
      <div class="nav-actions">
        <a href="#login" class="nav-login-link">Log in</a>
        <a href="#signup" class="btn primary nav-cta-btn">Get Started Free</a>
      </div>
      <button class="mobile-nav-button" id="mobileNavBtn" aria-label="Toggle menu">${icon("menu")}</button>
    </nav>

    <section class="hero" id="hero">
      <div class="hero-left">
        <div class="eyebrow">AI CAREER MENTOR FOR COLLEGE STUDENTS</div>
        <h1>Your AI Mentor.<br />Your Roadmap.<br /><span>Your Future.</span></h1>
        <p class="hero-copy">
          Take a 5-minute assessment and get a personalized learning roadmap, daily goals,
          practice, real projects and career guidance all in one place.
        </p>
        <div class="hero-actions">
          <a class="btn primary" href="#counselling" data-action="start-assessment" onclick="window.startRoadmapCounselling?.(event)">Build My AI Roadmap</a>
          <a class="btn ghost watch-btn" href="#how-it-works"><span>${icon("test")}</span> See How It Works</a>
        </div>
        <div class="hero-trust">
          <div class="trust-checks"><span>Free to start</span><span>No credit card</span><span>Cancel anytime</span></div>
          <div class="trusted-row">
            <div class="avatar-stack"><span>A</span><span>R</span><span>S</span><span>P</span><span>M</span></div>
            <div class="trust-text"><strong>4.8/5</strong> from 2,500+ students<br /><span class="trust-sub">Trusted by students from 500+ colleges</span></div>
          </div>
        </div>
      </div>

      <div class="hero-right">
        <div class="dashboard-preview">
          <div class="dash-header">
            <div class="dash-brand">
              <div class="dash-brand-dot"></div>
              <span>Studox.ai</span>
            </div>
            <span class="dash-welcome">Welcome back, Ankit</span>
          </div>
          <div class="dash-body">
            <div class="dash-sidebar">
              ${["Home", "Roadmap", "Courses", "Practice", "Tests", "AI Mentor", "Bookmarks", "Profile"].map((item, index) => `<div class="dash-sidebar-item ${index === 0 ? "active" : ""}">${item}</div>`).join("")}
            </div>
            <div class="dash-main hero-how-preview">
              <div class="preview-title"><h3>See How It Works</h3><p>From assessment to your personalized roadmap in 3 simple steps</p></div>
              <div class="preview-steps">
                ${[
                  ["1", "Take Assessment", "Answer 8 quick questions about your goals, skills and interests.", "test", "blue"],
                  ["2", "AI Analyzes", "Our AI analyzes your answers and identifies the best career path for you.", "bot", "purple"],
                  ["3", "Get Your Roadmap", "Receive a personalized learning roadmap with courses, projects and daily goals.", "trophy", "green"],
                ].map(([num, title, text, iconName, tone]) => `<div class="preview-step ${tone}"><span class="step-num">${num}</span><div class="step-big-icon">${icon(iconName)}</div><strong>${title}</strong><p>${text}</p></div>`).join("")}
              </div>
              <div class="roadmap-preview-line">
                <div class="roadmap-heading"><strong>Roadmap Preview</strong><span>Example: Full Stack Developer</span></div>
                <div class="roadmap-track">
                  ${[
                    ["github", "Week 1", "Git & GitHub", "Completed", "done"],
                    ["html5", "Week 2", "HTML & CSS", "Completed", "done"],
                    ["js", "Week 3", "JavaScript Basics", "In Progress", "active"],
                    ["node", "Week 4", "Node.js", "Upcoming", ""],
                    ["react", "Week 5", "React Basics", "Upcoming", ""],
                    ["12+", "Week 6", "More Topics", "Ahead", ""],
                  ].map(([mark, week, title, status, state]) => `<div class="roadmap-node ${state}"><span>${icons[mark] ? icon(mark) : mark}</span><strong>${week}</strong><p>${title}</p><small>${status}</small></div>`).join("")}
                </div>
              </div>
              <div class="preview-benefits">
                ${[["Personalized", "Roadmap built just for you"], ["AI-Powered", "Smart recommendations"], ["Track Progress", "Real-time tracking"], ["Career Ready", "Projects, skills & prep"]].map(([title, text]) => `<div><strong>${title}</strong><span>${text}</span></div>`).join("")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section feature-section" id="features">
      <div class="section-title center"><div><h2>Everything you need to reach your goals</h2></div></div>
      <div class="feature-strip">
        ${[
          ["Personalized Roadmap", "AI creates a roadmap tailored to your career goals.", "map", "blue"],
          ["Curated Courses", "Best courses handpicked for your roadmap.", "book", "green"],
          ["Track Progress", "Track your learning and stay consistent every day.", "chart", "amber"],
          ["Stay on Track", "Smart reminders and insights to keep you motivated.", "trophy", "purple"],
        ].map(([title, text, iconName, tone]) => `<div class="strip-item"><div class="mini-icon ${tone}">${icon(iconName)}</div><h3>${title}</h3><p>${text}</p></div>`).join("")}
      </div>
    </section>

    <section class="section how-section" id="how-it-works">
      <div class="section-title center"><div><h2>How Studox.ai Works</h2><p>Your journey from confused to career ready in 4 simple steps.</p></div></div>
      <div class="steps-row">
        ${[
          ["Take Assessment", "Answer a few questions about yourself and your goals.", "test", "blue-bg"],
          ["AI Creates Roadmap", "Our AI builds a personalized learning roadmap for you.", "bot", "green-bg"],
          ["Learn & Practice", "Follow your roadmap, learn daily, practice and build skills.", "book", "amber-bg"],
          ["Achieve Your Goal", "Build projects, gain confidence and land your dream career.", "trophy", "purple-bg"],
        ].map(([title, text, iconName, color], index) => `<div class="step-item"><span class="step-count">${index + 1}</span><div class="step-icon ${color}">${icon(iconName)}</div><div class="step-arrow">-&gt;</div><h4>${title}</h4><p>${text}</p></div>`).join("")}
      </div>
    </section>

    <section class="section platform-section" id="roadmap">
      <div class="section-title center"><div><h2>Your Personalized Roadmap Preview</h2><p>A glimpse of what your roadmap looks like</p></div></div>
      <div class="platform-roadmap-preview">
        <aside class="roadmap-timeline">
          ${[
            ["Week 1", "HTML, CSS & JavaScript Basics", "Completed", "done"],
            ["Week 2", "Responsive Web Design", "Completed", "done"],
            ["Week 3", "JavaScript Fundamentals", "In Progress", "active"],
            ["Week 4", "React Basics", "Upcoming", ""],
            ["Week 5", "Projects & Practice", "Upcoming", ""],
          ].map(([week, title, status, state]) => `<div class="timeline-week ${state}"><span></span><div><strong>${week}</strong><p>${title}</p></div><small>${status}</small></div>`).join("")}
        </aside>
        <div class="roadmap-preview-card detailed-roadmap-card">
          <div class="rp-content">
            <div class="rp-title"><h4>Week 3: JavaScript Fundamentals</h4><span class="rp-pct">60%</span></div>
            <div class="rp-bar"><div class="rp-fill" style="width:60%"></div></div>
            <div class="roadmap-detail-grid">
              <article>
                <h5>Topics</h5>
                ${["Variables & Data Types", "Functions & Scope", "DOM Manipulation", "Events Handling", "Mini Project"].map((item) => `<p><span class="topic-check"></span>${item}</p>`).join("")}
              </article>
              <article>
                <h5>Resources</h5>
                ${[["Video Lecture", "15 min"], ["Documentation", "20 min"], ["Practice Problems", "10 problems"]].map(([item, meta]) => `<p><span>${icon("book")}</span>${item}<small>${meta}</small></p>`).join("")}
              </article>
              <article>
                <h5>Tasks <small>4 / 8 completed</small></h5>
                ${["Read Notes", "Watch Video", "Practice Problems", "Mini Project"].map((item, index) => `<label><input type="checkbox" ${index < 2 ? "checked" : ""} disabled />${item}</label>`).join("")}
                <button class="btn primary" type="button">Continue Learning</button>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="cta-banner">
      <div class="cta-inner">
        <div class="cta-icon">${icon("trophy")}</div>
        <div class="cta-text"><h2>Ready to take control of your learning?</h2><p>Join students who are already building their future with Studox.ai.</p></div>
        <div class="cta-action"><a class="btn cta-btn" href="#counselling" data-action="start-assessment" onclick="window.startRoadmapCounselling?.(event)">Build My AI Roadmap</a><span class="cta-note">Free to start. No credit card required.</span></div>
      </div>
    </section>

    <footer class="landing-footer simple-landing-footer">
      <div class="simple-footer-inner">
        <div class="footer-mini-brand">
          ${brand()}
          <p>AI counselling, personalized roadmaps, curated courses and mentor guidance for students who want clear weekly progress.</p>
        </div>
        <nav class="simple-footer-links" aria-label="Landing footer links">
          <a href="#how-it-works">How It Works</a>
          <a href="#features">Features</a>
          <a href="#roadmap">Roadmap</a>
          <a href="#courses">Courses</a>
          <a href="#about">About Us</a>
        </nav>
        <div class="college-strip">
          ${["BCA", "B.Tech", "Diploma", "School", "Freshers", "Self learners"].map((item) => `<span>${item}</span>`).join("")}
        </div>
      </div>
    </footer>
  </main>`;
}


function aboutUsPage() {
  const stats = [
    ["2,500+", "students guided", "Across colleges, freshers and self-learners"],
    ["500+", "college communities", "Built for Indian student learning habits"],
    ["8", "career signals", "Goal, level, time, projects and learning style"],
    ["24/7", "AI support", "Counselling, roadmap help and mentor guidance"]
  ];
  const pillars = [
    ["Career clarity first", "We start with counselling because students do not just need content, they need the right direction.", "bot"],
    ["Roadmaps that feel real", "Every plan considers current level, weekly time, projects, timeline and practical outcomes.", "map"],
    ["Practice with proof", "Courses, tests, DSA, portfolio projects and progress tracking come together in one student dashboard.", "test"],
    ["Built for confidence", "Studox.ai turns confusion into weekly actions students can actually complete.", "trophy"]
  ];
  const timeline = [
    ["01", "Understand the student", "AI counselling captures education, interests and skill direction before the assessment."],
    ["02", "Design the path", "Career assignment turns answers into a focused roadmap for the selected career goal."],
    ["03", "Learn with structure", "Courses, weekly tasks, tests and projects keep the student moving with clarity."],
    ["04", "Become career ready", "Resume, internships, practice and mentor support help convert learning into opportunity."]
  ];
  const coverage = ["AI career counselling", "Personalized roadmap", "Curated courses", "Weekly tests", "DSA practice", "Projects", "Resume readiness", "Internship tracking", "AI mentor", "Progress analytics"];
  const team = [
    ["Students", "The learner at the center", "Every feature is designed around real student confusion, time pressure and placement anxiety."],
    ["Mentors", "Practical career guidance", "The product voice focuses on clear advice, simple next steps and realistic timelines."],
    ["AI systems", "Personalized support", "Gemini-powered counselling and mentor flows help scale guidance without losing context."]
  ];

  return `<main class="landing view about-page">
    <nav class="landing-nav about-nav" id="navbar">
      ${brand()}
      <div class="nav-links" id="navLinks">
        <a href="#landing">Home</a>
        <a href="#how-it-works">How It Works</a>
        <a href="#features">Features</a>
        <a href="#roadmap">Roadmap</a>
        <a href="#courses">Courses</a>
        <a href="#about" class="active">About Us</a>
      </div>
      <div class="nav-actions"><a href="#login" class="nav-login-link">Log in</a><a href="#signup" class="btn primary nav-cta-btn">Get Started Free</a></div>
      <button class="mobile-nav-button" id="mobileNavBtn" aria-label="Toggle menu">${icon("menu")}</button>
    </nav>

    <section class="about-hero-section">
      <div class="about-hero-copy">
        <span class="about-kicker">Built for student success</span>
        <h1>We are building the AI career companion students wish they had earlier.</h1>
        <p>Studox.ai helps students move from confusion to a focused career path with AI counselling, personalized roadmaps, curated courses, practice, projects and progress tracking in one premium learning space.</p>
        <div class="about-hero-actions">
          <a class="btn primary" href="#counselling" data-action="start-assessment" onclick="window.startRoadmapCounselling?.(event)">Build My AI Roadmap</a>
          <a class="btn ghost" href="#courses">Explore Courses</a>
        </div>
      </div>
      <div class="about-hero-media">
        <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80" alt="Students collaborating around laptops" />
        <div class="about-floating-card primary"><strong>AI counselling</strong><span>Personal direction before roadmap</span></div>
        <div class="about-floating-card secondary"><strong>Career ready</strong><span>Projects, tests and mentor support</span></div>
      </div>
    </section>

    <section class="about-stat-strip">
      ${stats.map(([value, label, detail]) => `<article><strong>${value}</strong><span>${label}</span><p>${detail}</p></article>`).join("")}
    </section>

    <section class="about-story-grid">
      <div class="about-story-image">
        <img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80" alt="Student learning from an online course" loading="lazy" />
      </div>
      <div class="about-story-copy">
        <span class="about-kicker">Why Studox.ai exists</span>
        <h2>Most students do not fail because they cannot learn. They struggle because the path is unclear.</h2>
        <p>One student wants full stack. Another wants AI. Someone else is in BCA, diploma, school or B.Tech and does not know where to start. Studox.ai brings counselling, assessment and execution together so every student gets a path that fits their level and weekly time.</p>
        <div class="about-check-list">
          ${["No random course jumping", "No generic roadmap confusion", "No guessing what to learn next", "A clear weekly plan with measurable progress"].map((item) => `<span>${icon("star")} ${item}</span>`).join("")}
        </div>
      </div>
    </section>

    <section class="about-section-block">
      <div class="about-section-head"><span class="about-kicker">What makes us different</span><h2>A complete student growth system, not just another course list.</h2></div>
      <div class="about-pillar-grid">
        ${pillars.map(([title, text, iconName]) => `<article><div>${icon(iconName)}</div><h3>${title}</h3><p>${text}</p></article>`).join("")}
      </div>
    </section>

    <section class="about-feature-band">
      <div>
        <span class="about-kicker">What we cover</span>
        <h2>Everything needed from first clarity to career readiness.</h2>
        <p>Studox.ai connects career counselling, roadmap generation, learning, practice, portfolio and progress. Students can discover what to learn, follow it weekly, and build proof along the way.</p>
      </div>
      <div class="about-coverage-cloud">
        ${coverage.map((item) => `<span>${item}</span>`).join("")}
      </div>
    </section>

    <section class="about-journey-section">
      <div class="about-journey-copy">
        <span class="about-kicker">The Studox journey</span>
        <h2>From career confusion to a roadmap students can follow.</h2>
        <p>Our flow is intentionally simple: understand the student, recommend the right direction, build the roadmap, then track consistent progress.</p>
      </div>
      <div class="about-journey-list">
        ${timeline.map(([num, title, text]) => `<article><b>${num}</b><div><h3>${title}</h3><p>${text}</p></div></article>`).join("")}
      </div>
    </section>

    <section class="about-people-grid">
      <div class="about-people-copy">
        <span class="about-kicker">Who we build for</span>
        <h2>Students who want a serious career path without feeling lost.</h2>
        <p>Studox.ai is designed for college students, beginners, self-learners and placement-focused learners who want career guidance that feels personal and actionable.</p>
        <div class="about-team-list">${team.map(([title, label, text]) => `<article><strong>${title}</strong><span>${label}</span><p>${text}</p></article>`).join("")}</div>
      </div>
      <div class="about-people-photos">
        <img src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80" alt="Students and mentors working together" loading="lazy" />
        <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80" alt="Team discussing learning strategy" loading="lazy" />
      </div>
    </section>

    <section class="about-cta-panel">
      <div><span class="about-kicker">Ready when you are</span><h2>Your roadmap should feel like it was made for you.</h2><p>Start with AI counselling, answer the career assignment, and let Studox.ai turn your goals into weekly progress.</p></div>
      <a class="btn primary glow" href="#counselling" data-action="start-assessment" onclick="window.startRoadmapCounselling?.(event)">Start AI Counselling</a>
    </section>
  </main>`;
}
function resetAssessmentFlow() {
  assessmentStep = 0;
  Object.keys(assessmentAnswers).forEach((key) => delete assessmentAnswers[key]);
  functionalState.generatedRoadmaps = [];
  functionalState.previewRoadmapIndex = 0;
}

function startCareerAssessment() {
  resetAssessmentFlow();
  applyCounsellingDefaultsToAssessment();
  renderAssessmentScreen();
}

function ensureCounsellingStarted() {
  if (counsellingState.messages.length) return;
  counsellingState.step = "education";
  counsellingState.education = "";
  counsellingState.skills = "";
  counsellingState.report = null;
  counsellingState.provider = "local";
  counsellingState.loading = false;
  counsellingState.error = "";
  counsellingState.messages = [
    { from: "ai", text: "Hey, I am Studox AI. Before the career assignment, let me understand your current education and skill direction." },
    { from: "ai", text: "Aap abhi kya kar rahe ho? Example: BCA first year, B.Tech CSE, 12th, diploma, commerce, ya working." }
  ];
}

function openCounsellingRoute() {
  ensureCounsellingStarted();
  if (window.location.hash !== "#counselling") {
    window.history.pushState(null, "", "#counselling");
  }
  renderCounsellingScreen();
}

function beginRoadmapCounselling(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  counsellingState.messages = [];
  ensureCounsellingStarted();
  openCounsellingRoute();
}

function renderCounsellingScreen() {
  app.innerHTML = counsellingScreen();
  bindPage();
  scrollAssessmentToTop();
}

function clampScore(value, fallback = 70) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function validAssessmentOption(questionId, value, fallback) {
  const question = assessmentQuestions.find((item) => item.id === questionId);
  return question?.options?.includes(value) ? value : fallback;
}

function buildClientCounsellingReport(payload = {}) {
  const education = String(payload.education || "").trim();
  const skills = String(payload.skills || "").trim();
  const text = `${education} ${skills}`.toLowerCase();
  let recommendedTrack = "Full Stack Developer";
  if (text.includes("ui") || text.includes("ux") || text.includes("figma")) recommendedTrack = "UI/UX Designer";
  else if (text.includes("cyber") || text.includes("security")) recommendedTrack = "Cybersecurity";
  else if (text.includes("data") || text.includes("sql") || text.includes("analytics")) recommendedTrack = "Data Analyst";
  else if (/\b(ai|ml|ai\/ml|machine learning|artificial intelligence)\b/.test(text) && !/\bweb\b/.test(text)) recommendedTrack = "AI/ML Engineer";
  else if (text.includes("web") || text.includes("react") || text.includes("frontend")) recommendedTrack = "Web Development";
  const tracks = [recommendedTrack, "Full Stack Developer", "AI/ML Engineer", "Data Analyst"].filter((item, index, array) => array.indexOf(item) === index).slice(0, 4);
  return {
    profileTitle: `${education || "Student"} - ${recommendedTrack} fit`,
    snapshot: [
      education ? `Current status: ${education}` : "Current status: exploring career direction",
      skills ? `Skill interest: ${skills}` : "Skill interest: not decided yet",
      `Suggested next move: ${recommendedTrack} foundation plus one portfolio project.`
    ],
    recommendedTrack,
    confidence: skills ? 86 : 68,
    fitScores: tracks.map((track, index) => ({ track, score: Math.max(58, 92 - index * 9), reason: index === 0 ? "Best fit from your counselling answers." : "Useful secondary option after main foundation." })),
    miniRoadmap: [
      "Week 1: revise fundamentals and setup GitHub learning log.",
      `Week 2: learn ${recommendedTrack} basics with daily practice.`,
      "Week 3: build one small portfolio project.",
      "Week 4: deploy, document and prepare interview talking points."
    ],
    warnings: skills ? [] : ["Skill direction is unclear, so assessment answers will refine this recommendation."],
    assessmentDefaults: { goal: recommendedTrack, focus: "Portfolio projects", timeline: "3 months", hours: "6-8 hours" }
  };
}

function normalizeCounsellingReportClient(report, payload = {}) {
  const fallback = buildClientCounsellingReport(payload);
  const source = report && typeof report === "object" ? report : fallback;
  const defaults = source.assessmentDefaults && typeof source.assessmentDefaults === "object" ? source.assessmentDefaults : fallback.assessmentDefaults;
  const normalized = {
    profileTitle: String(source.profileTitle || fallback.profileTitle),
    snapshot: Array.isArray(source.snapshot) && source.snapshot.length ? source.snapshot.map(String).slice(0, 4) : fallback.snapshot,
    recommendedTrack: validAssessmentOption("goal", source.recommendedTrack, fallback.recommendedTrack),
    confidence: clampScore(source.confidence, fallback.confidence),
    fitScores: Array.isArray(source.fitScores) && source.fitScores.length ? source.fitScores : fallback.fitScores,
    miniRoadmap: Array.isArray(source.miniRoadmap) && source.miniRoadmap.length ? source.miniRoadmap.map(String).slice(0, 5) : fallback.miniRoadmap,
    warnings: Array.isArray(source.warnings) ? source.warnings.map(String).slice(0, 3) : fallback.warnings,
    assessmentDefaults: {
      goal: validAssessmentOption("goal", defaults.goal || source.recommendedTrack, fallback.assessmentDefaults.goal),
      focus: validAssessmentOption("focus", defaults.focus, fallback.assessmentDefaults.focus),
      timeline: validAssessmentOption("timeline", defaults.timeline, fallback.assessmentDefaults.timeline),
      hours: validAssessmentOption("hours", defaults.hours, fallback.assessmentDefaults.hours)
    }
  };
  normalized.fitScores = normalized.fitScores.map((item, index) => ({
    track: validAssessmentOption("goal", item.track, index === 0 ? normalized.recommendedTrack : fallback.fitScores[index]?.track || "Full Stack Developer"),
    score: clampScore(item.score, fallback.fitScores[index]?.score || 68),
    reason: String(item.reason || "Career fit based on your counselling answers.")
  })).sort((a, b) => b.score - a.score).slice(0, 4);
  return normalized;
}

function getSavedCounsellingReport() {
  try {
    return JSON.parse(localStorage.getItem("studox-counselling-result") || "null");
  } catch (_error) {
    return null;
  }
}

function saveCounsellingReport(report) {
  if (!report) return;
  localStorage.setItem("studox-counselling-result", JSON.stringify({ ...report, savedAt: new Date().toISOString() }));
}

function activeCounsellingReport() {
  return counsellingState.report || getSavedCounsellingReport();
}

function applyCounsellingDefaultsToAssessment() {
  const report = activeCounsellingReport();
  const defaults = report?.assessmentDefaults || {};
  if (!defaults.goal) return;
  assessmentAnswers.goal = { value: validAssessmentOption("goal", defaults.goal, "Full Stack Developer") };
  assessmentAnswers.focus = { value: validAssessmentOption("focus", defaults.focus, "Portfolio projects") };
  assessmentAnswers.timeline = { value: validAssessmentOption("timeline", defaults.timeline, "3 months") };
  assessmentAnswers.hours = { value: validAssessmentOption("hours", defaults.hours, "6-8 hours") };
}

function counsellingReportPanel(report) {
  if (!report) return "";
  const confidence = clampScore(report.confidence, 70);
  const scores = (report.fitScores || []).slice(0, 4);
  const roadmap = (report.miniRoadmap || []).slice(0, 5);
  const warnings = report.warnings || [];
  return `<section class="counselling-report-panel">
    <div class="report-head">
      <div><span>AI career snapshot</span><h3>${escapeHtml(report.profileTitle || "Career fit ready")}</h3></div>
      <strong>${escapeHtml(report.recommendedTrack || "Recommended track")}</strong>
    </div>
    <div class="career-confidence" style="--score:${confidence}"><div><b>${confidence}%</b><span>Career clarity</span></div></div>
    <div class="snapshot-list">${(report.snapshot || []).map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>
    <div class="fit-score-list">
      ${scores.map((item) => `<article><div><strong>${escapeHtml(item.track)}</strong><span>${escapeHtml(item.reason)}</span></div><b>${clampScore(item.score)}%</b><i style="--score:${clampScore(item.score)}"></i></article>`).join("")}
    </div>
    <div class="mini-roadmap-preview"><h4>4-week starter preview</h4>${roadmap.map((item, index) => `<p><b>${index + 1}</b>${escapeHtml(item)}</p>`).join("")}</div>
    ${warnings.length ? `<div class="counselling-warning">${warnings.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>` : ""}
  </section>`;
}

window.startRoadmapCounselling = function startRoadmapCounsellingFromWindow(event) {
  event?.preventDefault?.();
  beginRoadmapCounselling(event);
};

function counsellingScreen() {
  const isSkillStep = counsellingState.step === "skills";
  const isDone = counsellingState.step === "done";
  const providerLabel = counsellingState.provider === "gemini" ? "Gemini live" : "Smart fallback";
  return `<main class="landing view ai-counselling-view">
    <nav class="landing-nav assessment-nav">
      ${brand()}
      <div class="nav-actions"><a href="#landing" class="btn ghost">Home</a><button class="btn primary" type="button" data-action="skip-counselling">Skip to assessment</button></div>
    </nav>
    <section class="counselling-shell">
      <aside class="counselling-robot-panel">
        <div class="counselling-robot active" aria-hidden="true">
          <span class="robot-ear left"></span><span class="robot-ear right"></span>
          <div class="robot-eye left"></div><div class="robot-eye right"></div>
          <div class="robot-mouth"><i></i><i></i><i></i></div>
          <div class="robot-body"><span></span><span></span></div>
        </div>
        <span class="eyebrow">AI counselling</span>
        <h1>Let us understand you first</h1>
        <p>Studox AI will ask a couple of counselling questions, suggest useful skills, and then send you to the career assignment.</p>
        <div class="counselling-signal"><span></span><span></span><span></span><strong>${providerLabel}</strong></div>
      </aside>
      <section class="counselling-chat-card">
        <div class="counselling-chat-head"><div><span>Studox AI Mentor</span><h2>Pre-roadmap counselling</h2></div><strong>${isDone ? "Ready" : isSkillStep ? "2/2" : "1/2"}</strong></div>
        <div class="counselling-messages">
          ${counsellingState.messages.map((item) => `<div class="counselling-message ${item.from}"><span>${item.from === "ai" ? icon("bot") : icon("user")}</span><p>${escapeHtml(item.text)}</p></div>`).join("")}
        </div>
        ${counsellingState.error ? `<div class="counselling-error" role="alert"><strong>Answer mismatch</strong><span>${escapeHtml(counsellingState.error)}</span></div>` : ""}
        ${counsellingState.report ? counsellingReportPanel(counsellingState.report) : ""}
        ${isDone ? `<div class="counselling-actions"><button class="btn primary glow" type="button" data-action="start-career-assessment">Continue to career assignment</button></div>` : `
          <form class="counselling-input-row" data-form="${isSkillStep ? "counselling-skills" : "counselling-education"}">
            <textarea name="answer" placeholder="${isSkillStep ? "Example: web development, AI/ML, Python, UI/UX, cybersecurity..." : "Example: I am doing BCA second year..."}" ${isSkillStep ? "" : "required"}></textarea>
            <button class="btn primary" type="submit">Send</button>
          </form>`}
      </section>
    </section>
  </main>`;
}

function educationInsight(value = "") {
  const text = value.toLowerCase();
  if (text.includes("bca")) return "BCA is a solid tech degree for software, web development, data analytics and AI fundamentals. Agar tum practical projects aur internships pe focus karoge, placement readiness kaafi strong ho sakti hai.";
  if (text.includes("b.tech") || text.includes("btech") || text.includes("cse") || text.includes("computer")) return "Computer science background roadmap ke liye strong base deta hai. Tum DSA, development, projects and system basics ko combine karke high-value profile build kar sakte ho.";
  if (text.includes("12") || text.includes("school")) return "School stage se start karna advantage hai. Abhi foundation, coding basics, English communication and project habit build karoge to college mein kaafi ahead rahoge.";
  if (text.includes("diploma")) return "Diploma background practical learning ke liye useful hota hai. Tum skills and portfolio projects par focus karke job-ready track bana sakte ho.";
  return "Good. Tumhari current situation ko roadmap ke starting point ki tarah use karenge, so plan realistic aur career-focused rahega.";
}

function skillCounsellingFeedback(education = "", skills = "") {
  const text = skills.toLowerCase();
  const edu = education.toLowerCase();
  const valuable = ["web", "javascript", "react", "node", "python", "java", "dsa", "data", "sql", "ai", "ml", "cyber", "security", "ui", "ux", "figma", "cloud"];
  const matched = valuable.filter((skill) => text.includes(skill));
  const bca = edu.includes("bca");

  if (!text.trim()) {
    return bca
      ? "Agar skills decide nahi ki hain, BCA ke saath Web Development + DSA + SQL/Python best start rahega. Isse internship, projects aur placement dono ke liye strong base banega."
      : "Agar skills decide nahi ki hain, main suggest karunga: Web Development foundation, DSA basics, GitHub projects and one specialization like AI/ML, Data Analytics, Cybersecurity or UI/UX.";
  }

  if (matched.length) {
    return `Good choice. ${skills} valuable lag raha hai because it connects with tech careers and future projects. Main assessment mein tumhe focused roadmap choose karne mein help karunga.`;
  }

  return bca
    ? `Honestly, ${skills} BCA-tech career ke liye strongest primary skill nahi lag raha. Main suggest karunga Web Development, Python, SQL, DSA, ya AI/ML basics par focus karo.`
    : `Ye skill direction career roadmap ke liye thoda weak lag raha hai. Main suggest karunga ek tech-aligned skill choose karo: Web Development, Data Analytics, AI/ML, Cybersecurity, UI/UX, ya DSA.`;
}

function normalizeCounsellingAnswer(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9+#.\s/-]/g, " ").replace(/\s+/g, " ").trim();
}

function hasCounsellingSignal(text, signals) {
  return signals.some((signal) => signal instanceof RegExp ? signal.test(text) : text.includes(signal));
}

const educationAnswerSignals = [
  /\b(bca|mca|btech|b\.tech|b\. tech|bsc|b\.sc|bcom|b\.com|ba|b\.a|bba|mba|diploma|iti|polytechnic|engineering|cse|computer science)\b/,
  /\b(10th|12th|11th|school|college|university|graduation|graduate|undergraduate|degree|semester|sem|year|class|student|fresher|internship|intern|job|working|employed|commerce|science|arts|pcm|pcb)\b/,
  /\b(studying|study|doing|pursuing|preparing|current|currently|abhi|kar raha|kar rha|kar rahi|padh raha|padh rha|padh rahi|mein hu|me hu|main hu)\b/
];

const careerSkillSignals = [
  /\b(web development|full stack|frontend|backend|html|css|javascript|js|react|node|express|mongodb|sql|python|java|c\+\+|cpp|dsa|data analytics|data analyst|machine learning|ai|ml|ai\/ml|artificial intelligence|cybersecurity|cyber security|ethical hacking|ui\/ux|figma|graphic design|cloud|devops|app development|android|flutter|digital marketing|excel|communication|english)\b/,
  /\b(web|coding|programming|developer|design|analytics|security|database|portfolio|project|skill|skills|course|learning|seekhna|sikhna|karni|krni|interest|interested)\b/
];

const emptySkillSignals = [/\b(no|nahi|nhi|not sure|confused|decide nahi|decided nahi|blank|skip)\b/];
const weakCounsellingAnswers = [/^(hi|hello|hey|ok|okay|yes|no|haan|ha|nahi|nhi|thanks|thank you|good|fine)$/];

function validateCounsellingEducationAnswer(answer = "") {
  const text = normalizeCounsellingAnswer(answer);
  if (!text) {
    return { ok: false, message: "Pehle apni current education/status likho, jaise: 'BCA 2nd year', 'B.Tech CSE first year', '12th student', ya 'Diploma final year'." };
  }
  if (text.length < 5 || weakCounsellingAnswers.some((pattern) => pattern.test(text))) {
    return { ok: false, message: "Yeh answer current education/status nahi lag raha. Example likho: 'Main BCA 2nd year kar raha hu' ya 'I am in B.Tech CSE first year'." };
  }
  const hasEducation = hasCounsellingSignal(text, educationAnswerSignals);
  const hasSkillOnly = hasCounsellingSignal(text, careerSkillSignals) && !hasEducation;
  if (hasSkillOnly) {
    return { ok: false, message: "Abhi skill nahi puchha hai. Pehle batao aap abhi kya kar rahe ho: course, year, college/school/job status." };
  }
  if (!hasEducation) {
    return { ok: false, message: "Answer question se match nahi hua. Apni current situation clear likho: education/course + year/semester/status." };
  }
  return { ok: true };
}

function validateCounsellingSkillAnswer(answer = "") {
  const text = normalizeCounsellingAnswer(answer);
  if (!text || hasCounsellingSignal(text, emptySkillSignals)) return { ok: true };
  if ((text.length < 3 && !/\b(ai|ml|js)\b/.test(text)) || weakCounsellingAnswers.some((pattern) => pattern.test(text))) {
    return { ok: false, message: "Yeh skill answer nahi lag raha. Skill ya career interest likho, jaise Web Development, AI/ML, Python, DSA, Data Analytics, Cybersecurity, UI/UX." };
  }
  const hasSkill = hasCounsellingSignal(text, careerSkillSignals);
  const looksEducationOnly = hasCounsellingSignal(text, educationAnswerSignals) && !hasSkill;
  if (looksEducationOnly) {
    return { ok: false, message: "Yeh education/status answer lag raha hai. Ab skill interest batao, ya agar decide nahi kiya to blank chhod do." };
  }
  if (!hasSkill) {
    return { ok: false, message: "Answer skill question se match nahi hua. Tech/career skill likho, ya blank chhod do agar abhi decide nahi kiya." };
  }
  return { ok: true };
}

function validateCounsellingStepAnswer(step, answer = "") {
  return step === "skills" ? validateCounsellingSkillAnswer(answer) : validateCounsellingEducationAnswer(answer);
}
async function requestCounsellingAdvice(step, payload, fallbackMessages) {
  try {
    const result = await api("/ai/counselling", {
      method: "POST",
      body: JSON.stringify({ step, ...payload })
    });
    const messages = Array.isArray(result?.messages) ? result.messages.filter(Boolean) : [];
    if (messages.length) {
      counsellingState.provider = result.provider || "gemini";
      return {
        ...result,
        messages,
        report: result.report ? normalizeCounsellingReportClient(result.report, payload) : null
      };
    }
  } catch (error) {
    console.warn("Gemini counselling request failed", error);
  }
  counsellingState.provider = "local";
  return {
    messages: fallbackMessages,
    provider: "local",
    model: "studox-local-counsellor",
    fallback: true,
    report: step === "skills" ? buildClientCounsellingReport(payload) : null
  };
}

async function handleCounsellingEducation(event) {
  event.preventDefault();
  const answer = new FormData(event.currentTarget).get("answer")?.trim() || "";
  if (!answer) return;
  counsellingState.education = answer;
  counsellingState.step = "skills";
  counsellingState.messages.push({ from: "user", text: answer });
  counsellingState.messages.push({ from: "ai", text: "Studox AI is thinking about your background..." });
  renderCounsellingScreen();

  const fallbackMessages = [
    "Good, thanks for sharing.",
    educationInsight(answer),
    "Iske saath tumne koi skill sochi hai? Agar sochi hai to likho. Agar nahi sochi, blank chhod ke Send kar sakte ho, main suggest kar dunga."
  ];
  const result = await requestCounsellingAdvice("education", { education: answer }, fallbackMessages);
  counsellingState.messages.pop();
  result.messages.forEach((text) => counsellingState.messages.push({ from: "ai", text }));
  renderCounsellingScreen();
}

async function handleCounsellingSkills(event) {
  event.preventDefault();
  const answer = new FormData(event.currentTarget).get("answer")?.trim() || "";
  counsellingState.skills = answer;
  counsellingState.step = "done";
  counsellingState.messages.push({ from: "user", text: answer || "Abhi skills decide nahi ki hain." });
  counsellingState.messages.push({ from: "ai", text: "Studox AI is checking if this skill direction fits your career..." });
  renderCounsellingScreen();

  const fallbackMessages = [
    skillCounsellingFeedback(counsellingState.education, answer),
    "Now I will send you to the career assignment. Wahan ke answers ke basis par focused AI roadmap generate hoga."
  ];
  const result = await requestCounsellingAdvice("skills", { education: counsellingState.education, skills: answer }, fallbackMessages);
  counsellingState.messages.pop();
  result.messages.forEach((text) => counsellingState.messages.push({ from: "ai", text }));
  counsellingState.report = normalizeCounsellingReportClient(result.report, { education: counsellingState.education, skills: answer });
  saveCounsellingReport(counsellingState.report);
  renderCounsellingScreen();
}
function assessmentQuestionScreen() {
  const roadmaps = functionalState.generatedRoadmaps || [];
  const question = assessmentQuestions[assessmentStep];
  const answer = assessmentAnswers[question.id] || {};
  const hasRoadmaps = !pendingRoadmapGeneration && roadmaps.length > 0;
  const progressValue = hasRoadmaps ? 100 : Math.round(((assessmentStep + 1) / assessmentQuestions.length) * 100);
  const answeredCount = assessmentQuestions.filter((item) => currentAssessmentValue(item)).length;
  const selectedValue = currentAssessmentValue(question);

  return `<main class="landing view assessment-view classic-premium-assessment">
    <nav class="landing-nav assessment-nav">
      ${brand()}
      <div class="nav-actions"><a href="#landing" class="btn ghost">Home</a><a href="#signup" class="btn primary">Signup</a></div>
    </nav>
    <section class="assessment-shell">
      ${hasRoadmaps ? assessmentResultScreen(roadmaps) : `
        <div class="assessment-grid">
          <aside class="assessment-side classic-panel">
            <span class="eyebrow">Career assignment</span>
            <h1>Build a focused AI roadmap</h1>
            <p>Answer a few sharp questions and get three practical roadmap tracks built around your goal, level, weekly time and learning style.</p>
            <div class="assessment-meter" aria-label="Assessment progress"><span style="width:${progressValue}%"></span></div>
            <div class="assessment-mini"><strong>${progressValue}%</strong><span>${answeredCount}/${assessmentQuestions.length} answers completed</span></div>
            <div class="assessment-highlight-panel">
              <strong>${question.label}</strong>
              <span>${question.hint || question.description || "This answer helps personalize your roadmap."}</span>
            </div>
            <div class="assessment-tags"><span>Goal clarity</span><span>Weekly plan</span><span>Signup ready</span></div>
          </aside>
          <form class="assessment-card premium-panel" data-form="roadmap-assessment">
            <div class="assessment-card-head">
              <div>
                <span>${question.section || "Roadmap step"}</span>
                <h2>${question.title}</h2>
              </div>
              <strong>${assessmentStep + 1}/${assessmentQuestions.length}</strong>
            </div>
            <p>${question.prompt || question.description || ""}</p>
            ${selectedValue ? `<div class="assessment-selected-note"><b>Selected</b><span>${selectedValue}</span></div>` : ""}
            <div class="assessment-options ${question.type === "textarea" ? "single" : ""}">
              ${question.type === "textarea"
                ? `<textarea class="assessment-textarea" name="${question.id}" data-assessment-field="${question.id}" placeholder="${question.placeholder || "Share anything useful for your roadmap..."}" ${question.required === false ? "" : "required"}>${answer.value || ""}</textarea>`
                : question.options.map((option) => `<label class="assessment-option"><input type="radio" name="${question.id}" value="${option}" ${answer.value === option ? "checked" : ""} ${question.required === false ? "" : "required"} /><span class="option-copy">${option}</span><b class="option-status">${answer.value === option ? "Selected" : "Select"}</b></label>`).join("")}
              
            </div>
            <div class="assessment-actions">
              <button class="btn" type="button" data-action="assessment-prev" ${assessmentStep === 0 ? "disabled" : ""}>Previous</button>
              ${assessmentStep >= 4
                ? `${assessmentStep < assessmentQuestions.length - 1 ? `<button class="btn" type="button" data-action="assessment-next">Answer optional</button>` : ""}<button class="btn primary glow" type="submit">${pendingRoadmapGeneration ? "Generating roadmap..." : "Generate Roadmap"}</button>`
                : `<button class="btn primary" type="button" data-action="assessment-next">Next question</button>`}
            </div>
          </form>
        </div>
        ${pendingRoadmapGeneration ? `<div class="assessment-loading"><span class="loader"></span><div><strong>Creating your roadmap</strong><p>Studox.ai is structuring the right roadmap from your required answers and optional details.</p></div></div>` : ""}
      `}
    </section>
  </main>`;
}

function assessmentResultScreen(roadmaps) {
  return `<div class="assessment-results premium-results">
    <div class="assessment-result-head">
      <span class="eyebrow">Roadmap generated</span>
      <h1>${roadmaps.length === 1 ? "Your roadmap is ready" : "Choose your roadmap track"}</h1>
      <p>${roadmaps.length === 1 ? "Based on your career goal, level, timeline and weekly time, Studox.ai created the best-fit roadmap for you." : "Pick the path that matches your level. Locked options show future growth but cannot be selected yet."}</p>
    </div>
    <div class="assessment-answer-pills">
      ${assessmentQuestions.slice(0, 4).map((question) => `<span><em>${question.label}</em><strong>${currentAssessmentValue(question) || "Not set"}</strong></span>`).join("")}
    </div>
    <div class="assessment-roadmaps count-${roadmaps.length}">
      ${roadmaps.map((roadmap, index) => `<button class="assessment-roadmap-card ${roadmap.locked ? "locked" : ""} ${roadmap.recommended ? "recommended" : ""} ${roadmap.optional ? "optional" : ""}" type="button" ${roadmap.locked ? "disabled" : "data-action=\"choose-roadmap-signup\""} data-roadmap-index="${index}">
        <div class="roadmap-card-top"><span class="track-label">${roadmap.trackLabel || `Track ${String(index + 1).padStart(2, "0")}`}</span><strong>${roadmap.estimatedDurationWeeks || 12} weeks</strong></div>
        <span class="roadmap-track-name">${roadmap.locked ? "Locked" : roadmap.recommended ? "Recommended" : roadmap.optional ? "Optional" : "Roadmap"}</span>
        <h3>${roadmap.title || "Roadmap option"}</h3>
        <p>${roadmap.summary || "Personalized roadmap option for your selected career goal."}</p>
        <div class="roadmap-card-plan">
          ${roadmapCardSteps(roadmap).map((step, stepIndex) => `<div><span>${stepIndex + 1}</span><p>${step}</p></div>`).join("")}
        </div>
        <small>${roadmap.locked ? roadmap.lockReason || "Complete earlier milestones to unlock." : "Continue with this roadmap"}</small>
      </button>`).join("")}
    </div>
    <div class="assessment-actions result-actions">
      <button class="btn" type="button" data-action="assessment-prev">Edit answers</button>
      <a class="btn ghost" href="#landing">Back to home</a>
    </div>
  </div>`;
}

function roadmapCardSteps(roadmap = {}) {
  const weekTitles = (roadmap.weeks || []).slice(0, 3).map((week) => week.title).filter(Boolean);
  if (weekTitles.length) return weekTitles;
  return ["Foundation and skill setup", "Guided projects and practice", "Interview and portfolio polish"];
}

function roadmapPreview(roadmap) {
  if (!roadmap) return "";
  return `<article class="panel" style="width:min(100%, 1100px);margin-top:16px">
    <div class="panel-head"><div><h2>${roadmap.title || "Roadmap Preview"}</h2><p>${roadmap.summary || ""}</p></div><span class="chip purple">${roadmap.difficulty || "beginner"}</span></div>
    <div class="skills-row" style="margin:12px 0 18px"><span class="chip">${roadmap.careerGoal || "Career Goal"}</span><span class="chip">${roadmap.estimatedDurationWeeks || 0} weeks</span></div>
    <div class="timeline">${(roadmap.weeks || []).map((week) => `<article class="timeline-item active"><span class="node"></span><div class="module-card"><header><div><h3>Week ${week.weekNumber || ""}: ${week.title || "Untitled week"}</h3><p>${week.description || ""}</p></div><span class="chip">${week.estimatedHours || 0}h</span></header><h4>Tasks</h4><div class="list">${(week.tasks || []).map((task) => `<div class="list-item"><div><h4>${task.title || "Task"}</h4><p>${task.description || ""}</p></div><span class="chip">${task.estimatedTimeMinutes || 0} min</span></div>`).join("") || emptyState("No tasks", "No tasks returned.")}</div><h4 style="margin-top:14px">Resources</h4><div class="skills-row">${(week.resources || []).map((resource) => `<a class="chip" href="${resource.url || "#"}" target="_blank" rel="noopener">${resource.title || "Resource"}</a>`).join("") || `<span class="chip">No resources</span>`}</div></div></article>`).join("")}</div>
    <button class="btn primary" type="button" data-action="choose-roadmap" ${pendingRoadmapSelection ? "disabled" : ""}>${pendingRoadmapSelection ? "Saving..." : "Choose Roadmap"}</button>
  </article>`;
}
const assessmentQuestions = [
  {
    id: "goal",
    key: "goal",
    label: "Career goal",
    section: "Goal clarity",
    title: "Which career goal should we build for?",
    question: "Which career goal should we build for?",
    prompt: "Choose one career direction. Your roadmap will stay focused on this field only.",
    hint: "This locks the roadmap domain, tools, projects and first learning portion.",
    description: "Choose the main career direction for your roadmap.",
    type: "radio",
    required: true,
    options: ["Full Stack Developer", "AI/ML Engineer", "Data Analyst", "Cybersecurity", "UI/UX Designer", "Web Development"]
  },
  {
    id: "level",
    key: "level",
    label: "Current level",
    section: "Skill level",
    title: "What is your current skill level?",
    question: "What is your current skill level?",
    prompt: "Your level decides how many roadmap options you see and which ones are selectable.",
    hint: "Beginner gets one beginner roadmap. Intermediate gets beginner optional, intermediate recommended, and advanced locked.",
    description: "This helps Studox.ai set the right difficulty.",
    type: "radio",
    required: true,
    options: ["Beginner", "Basic coding knowledge", "Intermediate", "Advanced"]
  },
  {
    id: "timeline",
    key: "timeline",
    label: "Timeline",
    section: "Target speed",
    title: "What timeline should we plan around?",
    question: "What timeline should we plan around?",
    prompt: "Pick your target timeline. Studox.ai will compare it with the recommended timeline for your field and level.",
    hint: "Timeline controls roadmap duration and whether the plan becomes normal or intensive.",
    description: "We will create a realistic learning speed.",
    type: "radio",
    required: true,
    options: ["1 month", "3 months", "6 months", "12 months"]
  },
  {
    id: "hours",
    key: "hours",
    label: "Weekly time",
    section: "Study capacity",
    title: "How many hours can you study each week?",
    question: "How many hours can you study each week?",
    prompt: "Select your weekly commitment. This decides workload and expected finish time.",
    hint: "Low weekly time means lighter tasks and longer finish. High weekly time means faster but more intensive work.",
    description: "Pick a schedule you can actually follow.",
    type: "radio",
    required: true,
    options: ["3-5 hours", "6-8 hours", "9-12 hours", "15+ hours"]
  },
  {
    id: "focus",
    key: "focus",
    label: "Main focus",
    section: "Optional priority",
    title: "What should your roadmap prioritize?",
    question: "What should your roadmap prioritize?",
    prompt: "Optional. Choose this only if you want the roadmap to lean toward a specific outcome.",
    hint: "If skipped, Studox.ai will use a balanced default priority.",
    description: "Your roadmap will prioritize this area.",
    type: "radio",
    required: false,
    options: ["Job-ready skills", "Internship preparation", "Portfolio projects", "DSA and coding", "Interview preparation"]
  },
  {
    id: "projects",
    key: "projects",
    label: "Projects built",
    section: "Optional portfolio base",
    title: "How much project experience do you have?",
    question: "How much project experience do you have?",
    prompt: "Optional. This helps tune project difficulty, but the roadmap can generate without it.",
    hint: "If skipped, beginner-friendly project planning will be used.",
    description: "This helps us decide your project difficulty.",
    type: "radio",
    required: false,
    options: ["0 projects", "1-2 projects", "3-5 projects", "5+ projects"]
  },
  {
    id: "learningStyle",
    key: "learningStyle",
    label: "Learning style",
    section: "Optional learning style",
    title: "How do you learn best?",
    question: "How do you learn best?",
    prompt: "Optional. Pick this if you want the roadmap format adjusted to your style.",
    hint: "If skipped, mixed learning will be used.",
    description: "We will shape your weekly plan around this.",
    type: "radio",
    required: false,
    options: ["Video lessons", "Practice tasks", "Projects", "Reading notes", "Mixed learning"]
  },
  {
    id: "extra",
    key: "extra",
    label: "Extra context",
    section: "Optional personal details",
    title: "Anything else we should consider?",
    question: "Anything else we should consider?",
    prompt: "Optional. Add weak topics, target company, college year, or current skills if useful.",
    hint: "If skipped, the roadmap will still generate from your main four answers.",
    description: "Example: college year, weak topics, target company, current skills.",
    type: "textarea",
    required: false,
    placeholder: "Example: I know HTML/CSS, weak in DSA, want an internship in 3 months..."
  }
];

function currentAssessmentValue(question = assessmentQuestions[assessmentStep]) {
  const answer = assessmentAnswers[question.id] || {};
  return answer.value || "";
}

function syncAssessmentAnswer(form, question = assessmentQuestions[assessmentStep]) {
  if (question.type === "textarea") {
    const textarea = form?.querySelector(`[name="${question.id}"]`);
    assessmentAnswers[question.id] = { value: textarea?.value.trim() || "" };
    return;
  }
  const checked = form?.querySelector(`input[name="${question.id}"]:checked`);
  assessmentAnswers[question.id] = { value: checked?.value || "" };
}

function validateAssessmentStep(form, question = assessmentQuestions[assessmentStep]) {
  syncAssessmentAnswer(form, question);
  const answer = assessmentAnswers[question.id] || {};
  if (question.required !== false && !answer.value) {
    toast("Please answer this required question.");
    return false;
  }
  return true;
}

function validateRequiredAssessmentAnswers(form) {
  const currentQuestion = assessmentQuestions[assessmentStep];
  if (currentQuestion) syncAssessmentAnswer(form, currentQuestion);

  const missingQuestion = assessmentQuestions.slice(0, 4).find((question) => {
    const answer = assessmentAnswers[question.id] || {};
    return question.required !== false && !answer.value;
  });

  if (missingQuestion) {
    assessmentStep = Math.max(0, assessmentQuestions.findIndex((question) => question.id === missingQuestion.id));
    toast(`Please answer ${missingQuestion.label.toLowerCase()} first.`);
    renderAssessmentScreen();
    return false;
  }

  return true;
}

function assessmentFormData() {
  return assessmentQuestions.reduce((payload, question) => {
    payload[question.id] = currentAssessmentValue(question);
    return payload;
  }, {});
}

function savePendingAssessment(data) {
  sessionStorage.setItem(pendingAssessmentKey, JSON.stringify({
    data,
    answers: assessmentAnswers,
    step: assessmentStep,
    savedAt: new Date().toISOString(),
  }));
}

function getPendingAssessment() {
  try {
    return JSON.parse(sessionStorage.getItem(pendingAssessmentKey) || "null");
  } catch (_error) {
    sessionStorage.removeItem(pendingAssessmentKey);
    return null;
  }
}

function clearPendingAssessment() {
  sessionStorage.removeItem(pendingAssessmentKey);
}

function getPendingRoadmap() {
  try {
    return JSON.parse(localStorage.getItem(pendingRoadmapKey) || "null");
  } catch (_error) {
    localStorage.removeItem(pendingRoadmapKey);
    return null;
  }
}

function clearPendingRoadmap() {
  localStorage.removeItem(pendingRoadmapKey);
}

function restorePendingAssessment(pending) {
  if (!pending?.answers) return;
  Object.keys(assessmentAnswers).forEach((key) => delete assessmentAnswers[key]);
  Object.assign(assessmentAnswers, pending.answers);
  assessmentStep = Math.min(assessmentQuestions.length - 1, Number(pending.step || assessmentQuestions.length - 1));
}

function courseCard(course) {
  return `<article class="card course-card">
    <div class="course-art"><div><span class="chip">${course.level}</span><h3>${course.title}</h3></div><strong>${course.progress}%</strong></div>
    <p>${course.desc}</p>
    ${progress(`${course.modules} modules`, course.progress)}
    <div class="form-row"><span>${course.students} enrolled</span><a class="btn" href="#courses">Open</a></div>
  </article>`;
}

function testItem([title, date, time, count]) {
  return `<div class="list-item">
    <div class="list-main"><span class="calendar-tile">${date.split(" ")[1]}</span><div><h4>${title}</h4><p>${time} - ${count}</p></div></div>
    <span class="chip">${date}</span>
  </div>`;
}

function authPage(type) {
  const isLogin = type === "login";
  return `<main class="auth-page view">
    <section class="auth-grid">
      <aside class="auth-left">
        ${brand()}
        <div class="auth-visual-card">
          <span class="eyebrow">${icon("bot")} Studox.ai Mentor</span>
          <h1>${isLogin ? "Welcome Back" : "Create Your Account"}</h1>
          <p>${isLogin ? "Resume your roadmap, tests, projects and AI mentor conversations exactly where you left off." : "Build your student profile once and unlock personalized learning, career and practice guidance."}</p>
        </div>
        <div class="auth-features">
          ${["Personalized Learning", "Track Progress", "Achieve Goals", "AI-Powered Mentor"]
            .map((title, index) => `<div class="auth-feature"><strong>${title}</strong><span>${["Adaptive plans for your goal.", "Analytics across every module.", "Milestones, XP and certificates.", "Fast answers with context."][index]}</span></div>`)
            .join("")}
        </div>
      </aside>
      <section class="auth-panel">
        ${isLogin ? loginForm() : signupForm()}
      </section>
    </section>
  </main>`;
}

function loginForm() {
  return `<h2>Welcome Back</h2>
  <p class="muted">Login to your Studox.ai learning command center.</p>
  <form class="form-grid" data-form="login">
    <div class="field"><label>Email or phone</label><input name="email" value="aarav@studox.ai" placeholder="you@example.com" required /></div>
    <div class="field password-field"><label>Password</label><input name="password" value="password123" type="password" placeholder="Enter password" required /><button type="button" class="btn icon ghost" data-password-toggle>${icon("eye")}</button></div>
    <div class="form-row"><label><input type="checkbox" checked /> Remember me</label><a href="#" data-action="forgot">Forgot password?</a></div>
    <button class="btn primary glow" type="submit">Login</button>
  </form>
  <div class="divider">or continue with</div>
  <div class="social-row">
    <button class="btn" data-toast="Google login placeholder is ready for OAuth.">Google</button>
    <button class="btn" data-toast="GitHub login placeholder is ready for OAuth.">GitHub</button>
    <button class="btn" data-toast="LinkedIn login placeholder is ready for OAuth.">LinkedIn</button>
  </div>
  <p class="muted" style="text-align:center;margin-top:18px">New here? <a href="#signup" style="color:var(--blue);font-weight:800">Create an account</a></p>`;
}

function signupForm() {
  return `<h2>Create Your Account</h2>
  <p class="muted">Start with personal info. Security and preferences are ready for the next steps.</p>
  <div class="stepper">
    <div class="step active"><span></span>Personal Info</div>
    <div class="step"><span></span>Security</div>
    <div class="step"><span></span>Preferences</div>
  </div>
  <form class="form-grid" data-form="signup">
    <div class="field"><label>Full name</label><input name="name" value="Aarav Sharma" required /></div>
    <div class="field"><label>Email</label><input name="email" type="email" value="aarav@studox.ai" required /></div>
    <div class="field"><label>Phone</label><input name="phone" value="+91 98765 43210" required /></div>
    <button class="btn primary glow" type="submit">Next Step</button>
  </form>
  <div class="secure-note">${icon("lock")} Your data is encrypted and used only to personalize your Studox.ai journey.</div>`;
}

function premiumPlanBadge() {
  const plan = getCurrentPlan();
  if (!isPremiumPlan(plan)) return "";
  return `<span class="premium-name-badge">${icon("star")} ${plan === "elite" ? "Elite" : "Premium"}</span>`;
}
function appLayout(content, route) {
  const dark = isDarkTheme() || route === "profile" || route === "settings";
  const premium = isPremiumPlan(getCurrentPlan());
  return `<div class="${dark ? "dark-page" : ""} view app-view" data-current-theme="${isDarkTheme() ? "dark" : "light"}">
    <div class="mobile-backdrop" data-mobile-close></div>
    <div class="dashboard-layout ${dark ? "dark-shell" : ""}">
      <aside class="sidebar ${dark ? "dark-card" : ""}" id="sidebar">
        ${brand()}
        <nav class="side-nav">
          ${sideLinks
            .filter(([key]) => key !== "admin" || isAdminUser())
            .map(([key, label, iconName]) => {
              const locked = isAppComingSoonRoute(key);
              return `<a class="side-link ${route === key ? "active" : ""} ${locked ? "locked" : ""}" href="#${key}" data-route="${key}" ${locked ? "data-app-locked=\"true\"" : ""}>${icon(iconName)}<span>${label}</span>${locked ? "<small>App</small>" : ""}</a>`;
            })
            .join("")}
        </nav>
        ${premium ? "" : `<div class="side-footer">
          <strong>Pro learning plan</strong>
          <p>AI roadmap, mentor support, weekly reports and career readiness tracking.</p>
          <a class="btn primary" href="#pricing" data-action="open-upgrade">Upgrade</a>
        </div>`}
      </aside>
      <main class="main">
        ${topbar(dark)}
        <section class="content">${content}</section>
      </main>
    </div>
  </div>`;
}

function topbar(dark) {
  return `<header class="topbar ${dark ? "dark-card" : ""}">
    <button class="btn icon mobile-menu" data-mobile-menu aria-label="Open menu">${icon("menu")}</button>
    <label class="global-search">${icon("search")}<input class="search-input" placeholder="Search courses, tests, internships, projects" /></label>
    <button class="btn icon theme-toggle ${dark ? "dark" : ""}" data-theme-toggle aria-label="Toggle dark mode">${icon(isDarkTheme() ? "sun" : "moon")}</button>
    <button class="btn icon notification ${dark ? "dark" : ""}" data-toast="You have 5 new mentor and test notifications.">${icon("bell")}<span class="badge">5</span></button>
    <div class="user-menu">
      <button class="user-pill" data-user-toggle>
        <span class="avatar">${currentUser.avatar}</span>
        <span><strong class="user-name-line">${currentUser.name} ${premiumPlanBadge()}</strong><br /><small>${currentUser.goal}</small></span>
      </button>
      <div class="dropdown" id="userDropdown">
        <a href="#profile">${icon("user")} Profile</a>
        <a href="#settings">${icon("settings")} Settings</a>
        <button data-action="logout">${icon("lock")} Logout</button>
      </div>
    </div>
  </header>`;
}

function coursesPage() {
  return appLayout(`<div class="course-layout">
      <div>
        <div class="hero-card">
          <span class="chip">Full Stack Developer</span>
          <h1>Master MERN stack with projects, tests and AI mentor checkpoints.</h1>
          <p>Continue from React routing and move into Node APIs, MongoDB data modeling and deployment with a portfolio-ready capstone.</p>
          <div class="hero-actions"><button class="btn primary" data-toast="Continuing from React routing module.">Continue Learning</button><button class="btn dark" data-toast="Course bookmarked.">${icon("star")} Bookmark</button><button class="btn dark" data-toast="Share link copied.">Share</button></div>
        </div>
        <div class="panel" style="margin-top:16px">
          <div class="tabs"><button class="active">Course Content</button><button>Projects</button><button>Tests</button><button>Notes</button><button>Discussions</button><button>Resources</button></div>
          <div class="module-list" style="margin-top:16px">${modules
            .map(([title, status, lessons, percent], index) => `<div class="module-row">
              <span class="status-dot ${status}">${status === "completed" ? "OK" : status === "locked" ? "L" : index + 1}</span>
              <div><h4>${title}</h4><p>${lessons} - ${percent}</p></div>
              <span class="chip ${status === "completed" ? "green" : status === "progress" ? "purple" : ""}">${status}</span>
            </div>`)
            .join("")}</div>
        </div>
      </div>
      <aside class="panel">
        <div class="circle-progress" style="--percent:64" data-label="64%"></div>
        ${progress("Course completion", 64)}
        <h3 style="margin-top:18px">Instructor</h3>
        <div class="list-item"><div class="list-main"><span class="avatar">NT</span><div><h4>Nisha Thomas</h4><p>Senior Full Stack Mentor</p></div></div></div>
        <h3 style="margin-top:18px">Students also enrolled</h3>
        <div class="avatar-stack" style="margin:12px 0 18px"><span>RK</span><span>SM</span><span>AN</span><span>DV</span></div>
        <div class="hero-card" style="padding:18px"><h2>Stay consistent</h2><p>Finish 3 lessons today to keep your weekly roadmap ahead of schedule.</p><button class="btn dark">Start sprint</button></div>
      </aside>
    </div>`, "courses");
}

function testsPage() {
  return appLayout(`<div class="page-head">
      <div><h1>Weekly Tests & AI Test Analysis</h1><p>Review scores, accuracy, percentile, weak concepts and AI recommendations after every test.</p></div>
      <button class="btn primary" data-toast="Starting mock test environment.">Start Mock Test</button>
    </div>
    ${statCards([
      ["Score", 91, "/100", "trophy", "Excellent"],
      ["Percentile", 96, "%", "chart", "Top 4%"],
      ["Accuracy", 88, "%", "test", "Improved"],
      ["Time Taken", 38, "m", "book", "Fast"],
      ["AI Confidence", 84, "%", "bot", "High"],
    ])}
    <div class="dash-grid">
      <div class="panel">
        <div class="panel-head"><h2>AI Performance Analysis</h2><span class="chip purple">Generated summary</span></div>
        <p class="muted">You are strongest in React hooks and component composition. Revise async state handling and nested route edge cases before the next weekly test.</p>
        ${progress("Concept clarity", 87)}
        ${progress("Speed", 78)}
        ${progress("Revision priority", 64)}
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Score by Section</h2></div>
        <div class="donut-row"><div class="donut"></div><div class="legend"><span><i style="background:var(--blue)"></i> React 42%</span><span><i style="background:var(--purple)"></i> JavaScript 29%</span><span><i style="background:var(--green)"></i> DSA 17%</span><span><i style="background:#d7e1f1"></i> Review 12%</span></div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Performance Over Time</h2></div>
        ${barChart([62, 70, 74, 69, 82, 86, 91], ["T1", "T2", "T3", "T4", "T5", "T6", "T7"])}
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Questions Review</h2></div>
        <div class="filters"><button class="active">All</button><button>Correct</button><button>Incorrect</button><button>Review</button></div>
        <div class="list" style="margin-top:14px">
          ${["React keys in lists", "Promise chaining output", "Binary search boundary", "useEffect dependency"].map((q, i) => `<div class="list-item"><div><h4>${q}</h4><p>${i === 2 ? "Needs review" : "AI explanation available"}</p></div><span class="chip ${i === 2 ? "amber" : "green"}">${i === 2 ? "review" : "correct"}</span></div>`).join("")}
        </div>
      </div>
    </div>`, "tests");
}

function dsaPage() {
  return appLayout(`<div class="page-head">
      <div><h1>DSA Practice Platform</h1><p>Practice by topic, track streaks, review recent problems and let AI select the next best challenge.</p></div>
      <label style="min-width:280px"><input class="search-input" placeholder="Search problems or topics" /></label>
    </div>
    ${statCards([
      ["Problems Solved", 320, "", "code", "Strong"],
      ["Acceptance Rate", 78, "%", "chart", "Improving"],
      ["Current Streak", 18, "d", "trophy", "Consistent"],
      ["Ranking", 1840, "", "star", "Campus top 5%"],
      ["Total Problems", 760, "", "book", "All topics"],
    ])}
    <div class="dash-grid">
      <div class="panel">
        <div class="panel-head"><h2>Topic Wise Progress</h2><div class="filters"><button class="active">All</button><button>Easy</button><button>Medium</button><button>Hard</button></div></div>
        ${["Arrays", "Strings", "Trees", "Graphs", "Dynamic Programming"].map((topic, i) => progress(topic, [88, 72, 54, 38, 26][i])).join("")}
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Today's Challenge</h2><span class="chip purple">AI picked</span></div>
        <h3>Longest Repeating Character Replacement</h3>
        <p class="muted">Sliding window pattern. Target time: 24 minutes.</p>
        <button class="btn primary" data-toast="Opening coding workspace placeholder.">Solve Now</button>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Recent Problems</h2></div>
        <div class="table-wrap"><table><thead><tr><th>Problem</th><th>Topic</th><th>Level</th><th>Status</th><th>Score</th></tr></thead><tbody>${dsaProblems.map((row) => `<tr>${row.map((cell, index) => `<td>${index === 3 ? `<span class="chip ${cell === "Solved" ? "green" : "amber"}">${cell}</span>` : cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Badges Earned</h2></div>
        <div class="skills-row">${["Array Ace", "Streak 15", "Tree Climber", "Debug Master", "Fast Solver"].map((badge) => `<span class="chip purple">${badge}</span>`).join("")}</div>
        <h3 style="margin-top:18px">Journey Chart</h3>
        ${barChart([26, 38, 52, 66, 78, 84, 91], ["W1", "W2", "W3", "W4", "W5", "W6", "W7"])}
      </div>
    </div>`, "dsa");
}

function resumePage() {
  return appLayout(`<div class="page-head">
      <div><h1>Resume Builder + ATS Score</h1><p>Create a polished student resume, check ATS fit and generate targeted AI improvements.</p></div>
      <div class="hero-actions"><button class="btn">Download PDF</button><button class="btn">Download DOCX</button></div>
    </div>
    <div class="tabs" style="margin-bottom:16px"><button class="active">Resume Builder</button><button>ATS Score</button><button>Resume Analysis</button><button>Templates</button></div>
    <div class="resume-layout">
      <div class="panel">
        <div class="two-column">
          <div>
            <h2>Resume Sections</h2>
            <div class="checklist" style="margin-top:14px">${["Profile summary", "Education", "Skills", "Projects", "Internships", "Achievements", "Certifications"].map((item, i) => `<div class="check-item"><span>${item}</span><span class="chip ${i < 5 ? "green" : "amber"}">${i < 5 ? "complete" : "improve"}</span></div>`).join("")}</div>
            <div class="hero-card" style="margin-top:16px"><h2>AI write with Studox.ai</h2><p>Generate achievement bullets, project impact lines and role-specific summaries.</p><button class="btn dark" data-toast="AI resume writer placeholder ready.">Generate bullets</button></div>
          </div>
          <div class="resume-preview">
            <h2>${currentUser.name}</h2><p>Full Stack Developer - ${currentUser.email} - +91 98765 43210</p>
            <h3>Summary</h3><p>Student developer building MERN projects with strong React, DSA and product thinking.</p>
            <h3>Skills</h3><p>React, Node.js, Express, MongoDB, JavaScript, Git, REST APIs, DSA</p>
            <h3>Projects</h3><p><strong>AI Study Planner:</strong> Adaptive planner with progress analytics and mentor recommendations.</p>
            <h3>Experience</h3><p>Frontend Intern, BluePeak Labs. Improved dashboard performance and shipped reusable UI components.</p>
          </div>
        </div>
      </div>
      <aside class="panel">
        <div class="circle-progress" style="--percent:86" data-label="86"></div>
        <h2>ATS Score</h2>
        <p class="muted">Strong match for Full Stack Developer internships.</p>
        ${progress("Keyword match", 88)}
        ${progress("Formatting", 92)}
        ${progress("Impact metrics", 68)}
        <h3 style="margin-top:18px">AI Suggestions</h3>
        <div class="list">${["Add measurable impact to project bullets.", "Mention Express authentication and MongoDB schema design.", "Move top projects above certifications."].map((item) => `<div class="list-item"><p>${item}</p></div>`).join("")}</div>
        <h3 style="margin-top:18px">Templates</h3>
        <div class="skills-row"><span class="chip purple">Modern</span><span class="chip">Minimal</span><span class="chip">Technical</span></div>
      </aside>
    </div>`, "resume");
}

function projectsPage() {
  return appLayout(`<div class="page-head">
      <div><h1>Projects Showcase</h1><p>Publish your best work, collect feedback and feature portfolio projects for recruiters.</p></div>
      <button class="btn primary">${icon("plus")} Add New Project</button>
    </div>
    ${statCards([
      ["Total Projects", 12, "", "briefcase", "Active"],
      ["Featured Projects", 4, "", "star", "Recruiter ready"],
      ["Profile Views", 1840, "", "chart", "This month"],
      ["Project Likes", 620, "", "trophy", "Growing"],
      ["Skills in Projects", 18, "", "code", "Mapped"],
    ])}
    <div class="panel" style="margin-bottom:16px"><div class="tabs"><button class="active">My Projects</button><button>Featured</button><button>Bookmarked</button></div></div>
    <div class="project-grid">${projects.map(([title, skills, status, views, desc]) => `<article class="card"><div class="course-art"><span class="chip">${status}</span><strong>${views}</strong></div><h3>${title}</h3><p>${desc}</p><div class="skills-row">${skills.split(", ").map((skill) => `<span class="chip">${skill}</span>`).join("")}</div><div class="form-row"><button class="btn">Open</button><button class="btn ghost">Feature</button></div></article>`).join("")}</div>
    <div class="two-column" style="margin-top:16px"><div class="panel"><div class="panel-head"><h2>Project Activity</h2></div>${barChart([34, 46, 62, 55, 70, 82, 94])}</div><div class="hero-card"><h2>Feature a project</h2><p>Pin your strongest work to your public profile and internship applications.</p><button class="btn dark">Feature Project</button></div></div>`, "projects");
}

function internshipsPage() {
  return appLayout(`<div class="page-head">
      <div><h1>Internship Portal</h1><p>Find internships that match your roadmap, resume strength, location and skill profile.</p></div>
      <span class="chip green">Resume match active</span>
    </div>
    <div class="panel" style="margin-bottom:16px">
      <div class="filters">
        ${["Domain", "Location", "Duration", "Stipend", "Remote", "Full-time"].map((filter, index) => `<button class="${index === 0 ? "active" : ""}">${filter}</button>`).join("")}
      </div>
    </div>
    <div class="dash-grid">
      <div class="panel">
        <div class="panel-head"><h2>Recommended Internships</h2><span class="chip purple">Personalized</span></div>
        <div class="list">${internships.map(([role, company, location, duration, stipend, match]) => `<div class="list-item"><div class="list-main"><span class="stat-icon">${icon("briefcase")}</span><div><h4>${role}</h4><p>${company} - ${location} - ${duration} - ${stipend}</p></div></div><div class="hero-actions"><span class="chip green">${match} match</span><button class="btn primary">Apply</button><button class="btn icon">${icon("star")}</button></div></div>`).join("")}</div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Application Tracker</h2></div>
        ${progress("Applied", 68)}
        ${progress("Shortlisted", 34)}
        ${progress("Interviews", 16)}
        <h3 style="margin-top:18px">Top companies hiring</h3>
        <div class="skills-row">${["BluePeak", "NovaWorks", "SkillForge", "Cloudlane", "Appsmith"].map((company) => `<span class="chip">${company}</span>`).join("")}</div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Recent Applications</h2></div>
        <div class="list">${["BluePeak Labs", "NovaWorks", "SkillForge"].map((company, i) => `<div class="list-item"><div><h4>${company}</h4><p>${["Submitted", "Shortlisted", "Resume viewed"][i]}</p></div><span class="chip ${i === 1 ? "green" : "amber"}">${["2d ago", "5d ago", "1w ago"][i]}</span></div>`).join("")}</div>
      </div>
      <div class="hero-card"><h2>Personalized recommendations</h2><p>Your best current fit is a MERN internship because your roadmap, ATS score and project tags align strongly.</p><button class="btn dark">Improve match</button></div>
    </div>`, "internships");
}

function hackathonsPage() {
  return appLayout(`<div class="page-head">
      <div><h1>Hackathons</h1><p>Build solutions, find teammates and convert projects into portfolio wins.</p></div>
      <div class="hero-actions"><button class="btn">Find Teammates</button><button class="btn primary">Submit Idea</button></div>
    </div>
    ${statCards([
      ["Registered", 7, "", "trophy", "This year"],
      ["Submissions", 4, "", "briefcase", "2 finalist"],
      ["Team Invites", 12, "", "user", "Active"],
      ["Skills Gained", 21, "", "star", "Mapped"],
      ["Prizes Won", 2, "", "chart", "Campus"],
    ])}
    <div class="hero-card" style="margin-bottom:16px"><h1>Build Solutions. Make an Impact.</h1><p>Join AI, sustainability, fintech and education hackathons with mentor-backed project planning.</p></div>
    <div class="panel" style="margin-bottom:16px"><div class="tabs"><button class="active">Recommended</button><button>Popular</button><button>By Domain</button></div></div>
    <div class="hackathon-grid">${hackathons.map(([title, duration, domain, prize, date]) => `<article class="card"><span class="chip purple">${domain}</span><h3>${title}</h3><p>${duration} - ${prize} - Starts ${date}</p>${progress("Team readiness", 76)}<div class="form-row"><button class="btn primary">Register</button><button class="btn">Details</button></div></article>`).join("")}</div>
    <div class="two-column" style="margin-top:16px"><div class="panel"><div class="panel-head"><h2>Hackathon Journey</h2></div>${barChart([18, 30, 44, 58, 70, 78, 86], ["Idea", "Team", "MVP", "Pitch", "Demo", "Submit", "Win"])}</div><div class="panel"><h2>Skills Gained</h2><div class="skills-row">${["Ideation", "Pitching", "APIs", "Rapid UI", "Teamwork", "Deployment"].map((skill) => `<span class="chip">${skill}</span>`).join("")}</div></div></div>`, "hackathons");
}

function certificatesPage() {
  return appLayout(`<div class="page-head">
      <div><h1>Certificates & Achievements</h1><p>Showcase certificates, skill badges, course completions, XP and verified milestones.</p></div>
      <button class="btn primary">Share Achievement</button>
    </div>
    ${statCards([
      ["Certificates Earned", 18, "", "star", "Verified"],
      ["Achievements", 42, "", "trophy", "Unlocked"],
      ["Skill Badges", 28, "", "code", "Mapped"],
      ["Courses Completed", 7, "", "book", "This year"],
      ["Total XP", 12840, "", "chart", "Level 12"],
    ])}
    <div class="certificate-grid">${certificates.map(([title, category, date, status]) => `<article class="card"><div class="course-art"><span class="chip">${category}</span><strong>${status}</strong></div><h3>${title}</h3><p>Issued ${date} by Studox.ai Learning Lab.</p><button class="btn">View Certificate</button></article>`).join("")}</div>
    <div class="dash-grid" style="margin-top:16px">
      <div class="panel"><div class="panel-head"><h2>Certificates by Category</h2></div><div class="donut-row"><div class="donut"></div><div class="legend"><span><i style="background:var(--blue)"></i> Frontend</span><span><i style="background:var(--purple)"></i> Programming</span><span><i style="background:var(--green)"></i> Database</span><span><i style="background:#d7e1f1"></i> Career</span></div></div></div>
      <div class="panel"><div class="panel-head"><h2>Top Achievements</h2><span class="chip green">Level 12</span></div><div class="list">${["100 DSA problems", "React module distinction", "18-day streak", "Portfolio featured"].map((item) => `<div class="list-item"><h4>${item}</h4><span class="chip purple">earned</span></div>`).join("")}</div></div>
      <div class="panel"><div class="panel-head"><h2>Certificates Timeline</h2></div><div class="timeline">${certificates.map(([title, category]) => `<div class="timeline-item completed"><span class="node"></span><div class="module-card"><h3>${title}</h3><p>${category}</p></div></div>`).join("")}</div></div>
      <div class="hero-card"><h2>Share achievement</h2><p>Create a LinkedIn-ready badge post with your current certificate and skill story.</p><button class="btn dark">Generate Share Card</button></div>
    </div>`, "certificates");
}

function mentorPage() {
  const chats = functionalState.chats || [];
  const plan = getCurrentPlan();
  const premium = isPremiumPlan(plan) || mentorLimitTemporarilyDisabled;
  const used = chats.length || 0;
  const chatsLeft = premium ? "Unlimited" : Math.max(0, mentorFreeChatLimit - used);
  const mentorLocked = !premium && used >= mentorFreeChatLimit;
  const chatMessages = chats
    .slice()
    .reverse()
    .flatMap((chat) => chat.messages || [])
    .slice(-8);
  const latestMeta = chats[0]?.metadata || {};
  const sourceLabel = latestMeta.provider
    ? `${latestMeta.provider}${latestMeta.fallback ? " fallback" : ""}`
    : "Ready";
    const suggestions = mentorSuggestions();
  return appLayout(`<div class="page-head">
      <div><h1>AI Mentor Dashboard</h1><p>Ask doubts, get career guidance, review code, improve resumes and plan interviews.</p></div>
      <span class="chip purple">AI ${sourceLabel}</span>
    </div>
    ${statCards([
      ["Total Conversations", chats.length || 0, "", "bot", "Saved"],
      ["Doubts Solved", chats.length ? chats.length * 2 : 0, "", "test", "Live"],
      ["Topics Explored", 54, "", "book", "Broad"],
      ["Time Saved", 86, "h", "chart", "Estimated"],
      ["Chats Left", premium ? 999 : chatsLeft, premium ? "" : "", "star", premium ? "Unlimited" : `${chatsLeft}/${mentorFreeChatLimit}`],
    ])}
    <div class="mentor-layout">
      <div class="panel">
        <div class="panel-head">
  <h2>Chat with Studox.ai Mentor</h2>
  <div class="filters mentor-mode-single">
    <button class="active" type="button">All-in-one AI Mentor</button>
  </div>
</div>
        <div class="mentor-limit-strip ${mentorLocked ? "locked" : ""}">
          <span>${icon(mentorLocked ? "lock" : "bot")}</span>
          <div><strong>${mentorLocked ? "Free mentor limit reached" : premium ? "AI Mentor access active" : `${chatsLeft} free mentor chats left`}</strong><p>${mentorLocked ? "Upgrade to Pro or Elite to continue unlimited AI Mentor conversations." : premium ? "Chat limit is temporarily disabled." : "Free plan includes 10 AI Mentor conversations."}</p></div>
          ${mentorLocked ? `<a class="btn primary" href="#pricing" data-action="open-upgrade">Upgrade Plan</a>` : ""}
        </div>
        <div class="chat-window" id="chatWindow">
          ${chatMessages.length
            ? chatMessages.map((item) => `<div class="message ${item.role === "assistant" ? "ai" : "user"}">${formatMentorMessage(item.content)}</div>`).join("")
            : `<div class="message ai">Hi ${currentUser.name.split(" ")[0]}, I am connected to your Studox.ai mentor engine. Ask me about React, DSA, resumes, internships, projects, roadmap planning or interview prep.</div>`}
        </div>
        <form class="chat-input ${mentorLocked ? "locked" : ""}" data-form="chat">
          <input class="search-input" name="message" placeholder="${mentorLocked ? "Upgrade to continue chatting..." : "Ask Studox.ai mentor..."}" ${mentorLocked ? "disabled" : ""} />
          <button class="btn primary" ${mentorLocked ? "disabled" : ""}>Send</button>
        </form>
      </div>
      <aside class="panel">
        <h2>Suggested for you</h2>
        <div class="list mentor-suggestions" style="margin-top:14px">
  ${suggestions.map((item) => `
    <button class="mentor-suggestion" type="button" data-mentor-suggestion="${escapeHtml(item.prompt)}">
      <span>${escapeHtml(item.title)}</span>
      <i>${icon("plus")}</i>
    </button>
  `).join("")}
</div>
        <h3 style="margin-top:18px">Learning insights</h3>
        ${progress("Concept confidence", 82)}
        ${progress("Career readiness", 78)}
        <h3 style="margin-top:18px">Popular resources</h3>
        <div class="skills-row">${["React Guide", "DSA Sheet", "Resume Kit", "Interview Bank"].map((resource) => `<span class="chip">${resource}</span>`).join("")}</div>
      </aside>
    </div>`, "mentor");
}

function getCurrentPlan() {
  return String(currentUser.plan || localStorage.getItem("studox-plan") || "free").toLowerCase();
}

function isPremiumPlan(plan) {
  return ["pro", "elite"].includes(String(plan || "").toLowerCase());
}

function pricingPage() {
  const plan = getCurrentPlan();
  const isPro = plan === "pro";
  const isElite = plan === "elite";
  const benefitCards = [
    ["Smarter AI Guidance", "Get personalized answers, explanations and study plans tailored just for you.", "bot"],
    ["Job & Internship Support", "Access curated opportunities, resume reviews and internship suggestions.", "briefcase"],
    ["Advanced Test Analytics", "Detailed performance insights to help you improve faster and smarter.", "chart"],
    ["Premium Content", "Premium courses, learning paths and resources for serious students.", "book"],
  ];
  return `<main class="pricing-page view">
    <nav class="pricing-nav">
      ${brand()}
      <div class="pricing-links"><a href="#dashboard">Dashboard</a><a href="#courses">Courses</a><a href="#mentor">AI Mentor</a><a class="active" href="#pricing">Pricing</a></div>
      <div class="pricing-user"><span class="avatar">${currentUser.avatar}</span><strong>${currentUser.name.split(" ")[0]}</strong>${premiumPlanBadge()}</div>
    </nav>
    <section class="pricing-hero">
      <div class="pricing-visual">
        <div class="pricing-cap"></div>
        <div class="pricing-chart"><span></span><span></span><span></span></div>
      </div>
      <div>
        <h1>Upgrade Your <span>Learning Journey</span></h1>
        <p>Unlock premium features, smarter AI guidance and powerful career tools designed for your success.</p>
        <div class="billing-toggle"><span>Monthly</span><button class="active" type="button"><i></i></button><span>Yearly</span><strong>Save 17%</strong></div>
      </div>
    </section>
    <section class="pricing-grid">
      <article class="plan-card ${plan === "free" ? "current" : ""}">
        <div class="plan-icon soft">${icon("trophy")}</div>
        <h2>Free</h2>
        <div class="plan-price">Rs. 0<span>/month</span></div>
        <ul><li>Basic roadmap access</li><li>10 AI mentor prompts</li><li>Free skill assessment</li><li>Community access</li></ul>
        <button class="btn ${plan === "free" ? "" : "ghost"}" disabled>${plan === "free" ? "Current Plan" : "Included"}</button>
      </article>
      <article class="plan-card featured ${isPro ? "current" : ""}">
        <div class="popular-badge">${icon("star")} Most Popular</div>
        <div class="plan-icon pro">${icon("star")}</div>
        <h2>Pro</h2>
        <div class="plan-price">Rs. 299<span>/month</span></div>
        <ul><li>Unlimited AI mentor access</li><li>All premium courses</li><li>Weekly tests and analytics</li><li>Resume review</li><li>Internship suggestions</li></ul>
        <button class="btn primary glow" data-action="checkout-plan" data-plan="pro">${isPro ? "Current Plan" : "Upgrade Now"}</button>
      </article>
      <article class="plan-card ${isElite ? "current" : ""}">
        <div class="plan-icon elite">${icon("trophy")}</div>
        <h2>Elite</h2>
        <div class="plan-price">Rs. 599<span>/month</span></div>
        <ul><li>Everything in Pro</li><li>1:1 career guidance</li><li>Advanced DSA practice</li><li>Hackathon updates</li><li>Priority support</li><li>Exclusive learning paths</li></ul>
        <button class="btn ${isElite ? "" : "primary"}" data-action="checkout-plan" data-plan="elite">${isElite ? "Current Plan" : "Go Elite"}</button>
      </article>
    </section>
    <section class="why-upgrade"><h2>Why Upgrade?</h2><div>${benefitCards.map(([title, body, iconName]) => `<article>${icon(iconName)}<div><h3>${title}</h3><p>${body}</p></div></article>`).join("")}</div></section>
    <section class="trust-row"><div>${icon("lock")}<span><strong>Cancel anytime</strong><small>No hidden fees. Cancel anytime with one click.</small></span></div><div>${icon("lock")}<span><strong>Secure payments</strong><small>Your payments are encrypted and 100% secure.</small></span></div><div>${icon("user")}<span><strong>Trusted by students</strong><small>Join students building their future with Studox.ai.</small></span></div></section>
  </main>`;
}

function paymentPlanDetails(plan = localStorage.getItem("studox-checkout-plan") || "pro") {
  const normalized = String(plan || "pro").toLowerCase() === "elite" ? "elite" : "pro";
  const plans = {
    pro: {
      id: "pro",
      name: "Pro",
      price: 299,
      badge: "Most Popular",
      description: "Premium courses, unlimited AI mentor access, weekly tests and analytics.",
      features: ["Unlimited AI Mentor", "All premium courses", "Weekly tests", "Resume review"]
    },
    elite: {
      id: "elite",
      name: "Elite",
      price: 599,
      badge: "Career Focused",
      description: "Everything in Pro plus 1:1 guidance, advanced DSA and priority support.",
      features: ["Everything in Pro", "1:1 career guidance", "Advanced DSA", "Priority support"]
    }
  };
  return plans[normalized];
}

function paymentGatewayPage() {
  const checkout = paymentPlanDetails();
  const tax = Math.round(checkout.price * 0.18);
  const total = checkout.price + tax;
  return `<main class="payment-page view">
    <nav class="pricing-nav payment-nav">
      ${brand()}
      <div class="pricing-links"><a href="#pricing">Pricing</a><a href="#dashboard">Dashboard</a><a href="#courses">Courses</a></div>
      <div class="pricing-user"><span class="avatar">${currentUser.avatar}</span><strong>${currentUser.name.split(" ")[0]}</strong>${premiumPlanBadge()}</div>
    </nav>
    <section class="payment-shell">
      <div class="payment-hero">
        <span class="eyebrow">Secure checkout</span>
        <h1>Complete your ${checkout.name} upgrade</h1>
        <p>Review your plan, choose a payment method and activate premium access for your Studox.ai account.</p>
        <div class="payment-trust"><span>${icon("lock")} Bank-grade encryption</span><span>${icon("star")} Instant activation</span><span>${icon("user")} Student friendly billing</span></div>
      </div>
      <form class="payment-card" data-form="payment-checkout" data-plan="${checkout.id}">
        <div class="payment-card-head"><div><span>${checkout.badge}</span><h2>${checkout.name} Plan</h2></div><strong>Rs. ${checkout.price}<small>/month</small></strong></div>
        <div class="razorpay-only-box">
          <span>${icon("lock")}</span>
          <div>
            <strong>Pay securely with Razorpay</strong>
            <p>Razorpay will open its secure checkout where students can pay using UPI, cards, netbanking, wallets or supported payment apps.</p>
          </div>
        </div>
        <div class="razorpay-secure-strip">
          <span>${icon("star")} Official Razorpay Checkout</span>
          <span>${icon("lock")} Server-side verification</span>
        </div>
        <button class="btn primary glow payment-pay-btn" type="submit">Pay Rs. ${total} and activate ${checkout.name}</button>
        <p class="payment-note">Real Razorpay checkout opens after this step. Your plan activates only after payment verification.</p>
      </form>
      <aside class="payment-summary">
        <div class="summary-plan"><span>${icon("trophy")}</span><div><h2>${checkout.name}</h2><p>${checkout.description}</p></div></div>
        <div class="summary-features">${checkout.features.map((feature) => `<span>${icon("star")} ${feature}</span>`).join("")}</div>
        <div class="summary-lines"><div><span>Monthly price</span><strong>Rs. ${checkout.price}</strong></div><div><span>GST estimate</span><strong>Rs. ${tax}</strong></div><div class="total"><span>Total today</span><strong>Rs. ${total}</strong></div></div>
        <a class="btn ghost" href="#pricing">Change plan</a>
      </aside>
    </section>
  </main>`;
}
function profilePage() {
  return appLayout(`<div class="page-head">
      <div><h1>Profile Settings</h1><p>Manage your public profile, education, skills, completion and security.</p></div>
      <button class="btn primary">Save Profile</button>
    </div>
    <div class="roadmap-layout">
      <div class="panel dark-card">
        <div class="profile-cover">
          <div class="profile-avatar">${currentUser.avatar}</div>
          <div><h2>${currentUser.name}</h2><p>${currentUser.goal} - Computer Science - Level ${currentUser.level}</p><div class="skills-row"><span class="chip">React</span><span class="chip">Node.js</span><span class="chip">DSA</span></div></div>
        </div>
        <form class="form-grid" style="margin-top:18px">
          <div class="two-column">
            <div class="field"><label>Full name</label><input value="${currentUser.name}" /></div>
            <div class="field"><label>Username</label><input value="aarav.dev" /></div>
            <div class="field"><label>Email</label><input value="${currentUser.email}" /></div>
            <div class="field"><label>Phone</label><input value="+91 98765 43210" /></div>
            <div class="field"><label>College</label><input value="Studox Institute of Technology" /></div>
            <div class="field"><label>Branch</label><input value="Computer Science" /></div>
          </div>
          <div class="field"><label>Bio</label><textarea>Student developer focused on full stack engineering, AI products and DSA interview readiness.</textarea></div>
        </form>
      </div>
      <aside class="panel dark-card">
        <h2>Profile Completion</h2>
        <div class="circle-progress" style="--percent:86" data-label="86%"></div>
        ${progress("Skills", 90)}
        ${progress("Education", 100)}
        ${progress("Projects", 76)}
        <h3 style="margin-top:18px">Account Security</h3>
        <div class="list"><div class="list-item"><p>Two-factor authentication</p><span class="chip amber">off</span></div><div class="list-item"><p>Password updated</p><span class="chip green">safe</span></div></div>
        <h3 style="margin-top:18px">Activity Summary</h3>
        <p class="muted">18-day streak, 320 DSA problems, 12 projects and 18 certificates.</p>
      </aside>
    </div>`, "profile");
}

function settingsPage() {
  return appLayout(`<div class="page-head">
      <div><h1>Settings</h1><p>Control appearance, study preferences, notifications, privacy and connected accounts.</p></div>
      <button class="btn primary">Save All Changes</button>
    </div>
    <div class="roadmap-layout">
      <div class="panel dark-card">
        <h2>Appearance</h2>
        <div class="settings-list" style="margin-top:14px">
          <div class="setting-row"><div><strong>Theme</strong><p class="muted">Choose light, dark or system mode.</p></div><div class="toggle-group"><button>Light</button><button class="active">Dark</button><button>System</button></div></div>
          <div class="setting-row"><div><strong>Accent color</strong><p class="muted">Customize primary dashboard accents.</p></div><div class="color-row"><button class="swatch" style="background:#2563eb"></button><button class="swatch" style="background:#7c3aed"></button><button class="swatch" style="background:#12b981"></button><button class="swatch" style="background:#f59e0b"></button></div></div>
          <div class="setting-row"><div><strong>Language</strong><p class="muted">Interface and mentor response language.</p></div><select><option>English</option><option>Hindi</option><option>Spanish</option></select></div>
        </div>
        <h2 style="margin-top:22px">Study Preferences</h2>
        <div class="settings-list" style="margin-top:14px">
          ${["Daily learning reminders", "Weekly test nudges", "DSA challenge alerts", "Internship recommendations"].map((item, i) => `<div class="setting-row"><div><strong>${item}</strong><p class="muted">Personalized based on your roadmap activity.</p></div><label class="switch"><input type="checkbox" ${i < 3 ? "checked" : ""}/><span></span></label></div>`).join("")}
        </div>
      </div>
      <aside class="panel dark-card">
        <h2>Notifications</h2>
        <div class="settings-list" style="margin-top:14px">
          ${["Email updates", "Push notifications", "Mentor summaries", "Career alerts"].map((item) => `<div class="setting-row"><strong>${item}</strong><label class="switch"><input type="checkbox" checked/><span></span></label></div>`).join("")}
        </div>
        <h2 style="margin-top:22px">Connected Accounts</h2>
        <div class="list" style="margin-top:14px"><div class="list-item"><p>Google</p><span class="chip green">connected</span></div><div class="list-item"><p>GitHub</p><button class="btn">Connect</button></div><div class="list-item"><p>LinkedIn</p><button class="btn">Connect</button></div></div>
        <h2 style="margin-top:22px">Data & Privacy</h2>
        <div class="settings-list" style="margin-top:14px">
          <div class="setting-row"><div><strong>Profile visibility</strong><p class="muted">Show projects and certificates to recruiters.</p></div><label class="switch"><input type="checkbox" checked/><span></span></label></div>
          <div class="setting-row"><div><strong>Export my data</strong><p class="muted">Download learning, resume and career data.</p></div><button class="btn">Export</button></div>
        </div>
      </aside>
    </div>`, "settings");
}

function adminPage() {
  const resources = ["users", "courses", "roadmaps", "tests", "internships", "hackathons", "certificates", "mentor prompts", "reports", "content"];
  return appLayout(`<div class="page-head">
      <div><h1>Premium Admin Dashboard</h1><p>Manage platform content, students, tests, opportunities, certificates, mentor prompts and reports.</p></div>
      <button class="btn primary">${icon("plus")} Add Content</button>
    </div>
    ${statCards([
      ["Users", 42000, "", "user", "Growing"],
      ["Courses", 86, "", "book", "Published"],
      ["Tests", 240, "", "test", "Live"],
      ["Applications", 9300, "", "briefcase", "Tracked"],
      ["Reports", 128, "", "chart", "Open"],
    ])}
    <div class="admin-layout">
      <aside class="panel">
        <h2>Manage</h2>
        <div class="admin-nav" style="margin-top:14px">${resources.map((item) => `<button class="btn ${adminResource === item ? "active" : ""}" data-admin="${item}">${item}</button>`).join("")}</div>
      </aside>
      <div class="panel">
        <div class="panel-head"><h2>${adminResource.replace(/\b\w/g, (m) => m.toUpperCase())}</h2><div class="filters"><button class="active">All</button><button>Draft</button><button>Published</button></div></div>
        <div class="table-wrap"><table><thead><tr><th>Name</th><th>Status</th><th>Owner</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${["Full Stack Roadmap", "React Weekly Test", "Frontend Internship Feed", "AI Mentor Resume Prompt", "Certificate Templates"].map((item, i) => `<tr><td>${item}</td><td><span class="chip ${i % 2 ? "amber" : "green"}">${i % 2 ? "Review" : "Live"}</span></td><td>Studox Admin</td><td>${i + 1}d ago</td><td><button class="btn">Edit</button></td></tr>`).join("")}</tbody></table></div>
      </div>
    </div>`, "admin");
}

const routeMap = {
  landing: studoxLandingPage,
  about: aboutUsPage,
  counselling: () => {
    ensureCounsellingStarted();
    return counsellingScreen();
  },
  login: () => authPage("login"),
  signup: () => authPage("signup"),
  dashboard: () => "",
  roadmap: () => "",
  courses: coursesPage,
  tests: testsPage,
  dsa: dsaPage,
  resume: resumePage,
  projects: projectsPage,
  internships: internshipsPage,
  hackathons: hackathonsPage,
  certificates: certificatesPage,
  mentor: mentorPage,
  pricing: pricingPage,
  payment: paymentGatewayPage,
  profile: profilePage,
  settings: settingsPage,
  admin: adminPage,
};

function render() {
  const requestedRoute = routeMap[getRoute()] ? getRoute() : "landing";
  if (isAppComingSoonRoute(requestedRoute)) {
    showAppComingSoonModal(requestedRoute);
    window.location.hash = hasDemoSession() ? "dashboard" : "landing";
    return;
  }
  const route = requestedRoute;
  app.innerHTML = routeMap[route]();
  bindPage();
  animateCounters();
}

function bindPage() {
  document.querySelectorAll("[data-toast]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.preventDefault();
      toast(node.dataset.toast);
    });
  });

  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.parentElement.querySelector("input");
      input.type = input.type === "password" ? "text" : "password";
    });
  });

  document.querySelectorAll("[data-user-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("userDropdown")?.classList.toggle("open");
    });
  });

  document.querySelectorAll("[data-mobile-menu]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("sidebar")?.classList.add("open");
      document.querySelector("[data-mobile-close]")?.classList.add("open");
    });
  });

  document.querySelectorAll("[data-mobile-close], .side-link").forEach((node) => {
    node.addEventListener("click", () => {
      document.getElementById("sidebar")?.classList.remove("open");
      document.querySelector("[data-mobile-close]")?.classList.remove("open");
    });
  });

  document.querySelectorAll("[data-form='login']").forEach((form) => {
    form.addEventListener("submit", handleLogin);
  });

  document.querySelectorAll("[data-form='signup']").forEach((form) => {
    form.addEventListener("submit", handleSignup);
  });

  document.querySelectorAll("[data-form='chat']").forEach((form) => {
    form.addEventListener("submit", handleChat);
  });

  document.querySelectorAll("[data-form='counselling-education']").forEach((form) => form.addEventListener("submit", handleCounsellingEducation));
  document.querySelectorAll("[data-form='counselling-skills']").forEach((form) => form.addEventListener("submit", handleCounsellingSkills));
  document.querySelectorAll("[data-action='skip-counselling'], [data-action='start-career-assessment']").forEach((button) => button.addEventListener("click", startCareerAssessment));
  document.querySelectorAll("[data-action='forgot']").forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      const result = await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: "aarav@studox.ai" }),
      });
      toast(result?.message || "OTP sent to your registered email.");
    });
  });

  document.querySelectorAll("[data-action='logout']").forEach((button) => {
    button.addEventListener("click", () => {
      clearDemoSession();
      toast("Logged out.");
      setRoute("landing");
    });
  });

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.querySelector("[data-form='chat'] input");
      if (input) input.value = button.dataset.prompt;
    });
  });

  document.querySelectorAll("[data-admin]").forEach((button) => {
    button.addEventListener("click", () => {
      adminResource = button.dataset.admin;
      render();
    });
  });
}

async function handleLogin(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const result = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (result?.token) {
    localStorage.setItem("studox-token", result.token);
    currentUser = {
      ...currentUser,
      name: result.user?.name || currentUser.name,
      email: result.user?.email || currentUser.email,
    };
    localStorage.setItem("studox-user", JSON.stringify(currentUser));
  }
  toast(result?.message || "Logged in with demo account.");
  setRoute("dashboard");
}

async function handleSignup(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const result = await api("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ ...data, password: "password123" }),
  });
  currentUser = {
    ...currentUser,
    name: data.name,
    email: data.email,
    avatar: data.name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  };
  localStorage.setItem("studox-user", JSON.stringify(currentUser));
  if (result?.token) localStorage.setItem("studox-token", result.token);
  toast(result?.message || "Account created. Your roadmap is ready.");
  setRoute("dashboard");
}

async function handleChat(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = form.message;
  const button = form.querySelector("button");
  const text = input.value.trim();
  if (!text) return;
  if (!mentorLimitTemporarilyDisabled && !isPremiumPlan(getCurrentPlan()) && (functionalState.chats || []).length >= mentorFreeChatLimit) {
    showMentorLimitModal({ used: mentorFreeChatLimit, limit: mentorFreeChatLimit });
    return;
  }
  const windowNode = document.getElementById("chatWindow");
  windowNode.insertAdjacentHTML("beforeend", `<div class="message user">${escapeHtml(text)}</div><div class="message ai" id="typingBubble"><span class="typing"><span></span><span></span><span></span></span></div>`);
  input.value = "";
  if (button) button.disabled = true;
  windowNode.scrollTop = windowNode.scrollHeight;
  const result = await mentorChatRequest(text);
  document.getElementById("typingBubble")?.remove();
  if (button) button.disabled = false;
  if (!result?.ok) {
    if (result?.code === "MENTOR_LIMIT_REACHED") {
      windowNode.insertAdjacentHTML("beforeend", `<div class="message ai error">Free AI Mentor limit reached. Upgrade to continue unlimited mentor chats.</div>`);
      showMentorLimitModal(result);
    } else {
      windowNode.insertAdjacentHTML("beforeend", `<div class="message ai error">${escapeHtml(result?.message || "AI mentor could not respond. Please check backend/API key and try again.")}</div>`);
    }
    windowNode.scrollTop = windowNode.scrollHeight;
    return;
  }
  windowNode.insertAdjacentHTML(
    "beforeend",
    `<div class="message ai">${formatMentorMessage(result.reply)}</div>`,
  );
  windowNode.scrollTop = windowNode.scrollHeight;
  if (!mentorLimitTemporarilyDisabled && !isPremiumPlan(result.usage?.plan) && result.usage?.remaining === 0) {
    showMentorLimitModal({ used: result.usage.used, limit: result.usage.limit });
  }
}

async function mentorChatRequest(message) {
  try {
    const firebaseToken = await getFirebaseIdToken();
    const legacyToken = localStorage.getItem("studox-token");
    const res = await fetch(`${apiBase}/ai-mentor/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: firebaseToken ? `Bearer ${firebaseToken}` : legacyToken ? `Bearer ${legacyToken}` : "",
      },
      body: JSON.stringify({ message }),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    return res.ok ? { ok: true, ...data } : { ok: false, status: res.status, ...data };
  } catch (_error) {
    return { ok: false, message: "Server connection failed. Please check backend is running." };
  }
}

function showMentorLimitModal(data = {}) {
  document.querySelector(".upgrade-modal-backdrop")?.remove();
  const used = data.used ?? mentorFreeChatLimit;
  const limit = data.limit ?? mentorFreeChatLimit;
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="upgrade-modal-backdrop">
      <section class="upgrade-modal">
        <button class="modal-close" data-modal-close aria-label="Close">x</button>
        <div class="modal-orbit"><span>${icon("lock")}</span><i></i><i></i></div>
        <span class="ai-pill">AI MENTOR LIMIT</span>
        <h2>Your free mentor chats are finished</h2>
        <p>You used ${used}/${limit} free AI Mentor conversations. Upgrade to Pro for unlimited mentor access, premium courses, resume review and career tools.</p>
        <div class="modal-meter"><span style="width:${Math.min(100, (used / limit) * 100)}%"></span></div>
        <div class="modal-actions"><button class="btn" data-modal-close>Not now</button><a class="btn primary glow" href="#pricing" data-modal-upgrade>Upgrade Plan</a></div>
      </section>
    </div>`,
  );
  document.querySelectorAll("[data-modal-close]").forEach((node) => node.addEventListener("click", () => document.querySelector(".upgrade-modal-backdrop")?.remove()));
  document.querySelector("[data-modal-upgrade]")?.addEventListener("click", () => {
    document.querySelector(".upgrade-modal-backdrop")?.remove();
  });
}

function animateCounters() {
  document.querySelectorAll(".count-up").forEach((node) => {
    const target = Number(node.dataset.value);
    const duration = 900;
    const start = performance.now();
    function tick(now) {
      const progressValue = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progressValue, 3);
      node.textContent = Math.round(target * eased).toLocaleString();
      if (progressValue < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function formatMentorMessage(text = "") {
  return escapeHtml(String(text))
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^\s*---+\s*$/gm, "<hr />")
    .replace(/\\n/g, "<br />");
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", async () => {
  await waitForFirebaseAuth();
  const route = getRoute();
  if (hasDemoSession()) {
    if (["landing", "login", "signup", "reset"].includes(route)) setRoute("dashboard");
    else window.setTimeout(render, 260);
    return;
  }
  if (protectedRoutes.has(route)) {
    setRoute("landing");
    return;
  }
  window.setTimeout(render, 260);
});

const functionalState = {
  dashboard: null,
  generatedRoadmaps: [],
  previewRoadmapIndex: 0,
  roadmaps: [],
  courses: [],
  courseDetail: null,
  tests: [],
  testResults: [],
  testSession: null,
  latestResult: null,
  dsa: null,
  resume: null,
  ats: null,
  projects: [],
  internships: [],
  hackathons: [],
  certificates: [],
  chats: [],
  profile: null,
  settings: null,
  adminSummary: null,
  adminRows: [],
  adminActivity: {},
  adminHealth: null,
};

api = async function functionalApi(path, options = {}) {
  const firebaseToken = await getFirebaseIdToken();
  const legacyToken = localStorage.getItem("studox-token");
  const headers = {
    "Content-Type": "application/json",
    ...(firebaseToken ? { Authorization: `Bearer ${firebaseToken}` } : legacyToken ? { Authorization: `Bearer ${legacyToken}` } : {}),
    ...(options.headers || {}),
  };
  try {
    const res = await fetch(`${apiBase}${path}`, { ...options, headers });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(userFriendlyApiError(data.error || data.message || "Request failed."));
    return data;
  } catch (error) {
    toast(error.message || "Server se connection nahi ho paaya.");
    return null;
  }
};

function userFriendlyApiError(message) {
  const text = String(message || "");
  if (/quota exceeded|exceeded your current quota|rate-limit|rate limit/i.test(text)) {
    const retry = text.match(/retry in\s+([\d.]+)s/i);
    return `AI limit reached. Please try again${retry ? ` in ${Math.ceil(Number(retry[1]))} seconds` : " after some time"}.`;
  }
  if (/api key|permission|unauthorized|forbidden/i.test(text)) return "AI setup issue. Please check the API key.";
  if (/invalid json|empty response/i.test(text)) return "AI response was incomplete. Please try again.";
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

render = async function functionalRender() {
  const route = routeMap[getRoute()] ? getRoute() : "landing";
  app.innerHTML = loadingView(route);
  await loadFunctionalData(route);
  app.innerHTML = routeMap[route]();
  bindPage();
  animateCounters();
  if (route === "counselling") scrollAssessmentToTop();
};


function maybeShowJarvisWelcome(route) {
  if (route !== "dashboard") return;
  if (localStorage.getItem("studox-jarvis-welcome-pending") !== "true") return;
  if (localStorage.getItem("studox-jarvis-welcome-seen") === "true") return;
  window.setTimeout(showJarvisWelcome, 500);
}

function showJarvisWelcome() {
  localStorage.setItem("studox-jarvis-welcome-seen", "true");
  localStorage.removeItem("studox-jarvis-welcome-pending");
  document.querySelector(".jarvis-welcome-backdrop")?.remove();
  const firstName = (currentUser.name || "Student").split(" ")[0] || "Student";
  const message = `Hey ${firstName}, welcome to Studox.ai. I am your AI mentor. Let us build your roadmap and upgrade your learning journey.`;
  document.body.insertAdjacentHTML("beforeend", `<div class="jarvis-welcome-backdrop">
    <section class="jarvis-welcome-modal">
      <button class="jarvis-skip" type="button" data-jarvis-close>Skip</button>
      <div class="jarvis-face" aria-hidden="true">
        <span class="jarvis-antenna"></span>
        <div class="jarvis-eye left"></div>
        <div class="jarvis-eye right"></div>
        <div class="jarvis-mouth"><i></i><i></i><i></i></div>
        <div class="jarvis-orbit one"></div>
        <div class="jarvis-orbit two"></div>
      </div>
      <span class="jarvis-pill">Studox AI online</span>
      <h2>Hey ${firstName}, welcome to Studox.ai</h2>
      <p>${message}</p>
      <button class="btn primary glow" type="button" data-jarvis-close>Start learning</button>
    </section>
  </div>`);
  speakJarvisMessage(message);
  document.querySelectorAll("[data-jarvis-close]").forEach((button) => button.addEventListener("click", closeJarvisWelcome));
}

function speakJarvisMessage(message) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.rate = 0.92;
  utterance.pitch = 0.78;
  utterance.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((voice) => /male|david|mark|english/i.test(`${voice.name} ${voice.lang}`));
  if (preferred) utterance.voice = preferred;
  utterance.onend = () => document.querySelector(".jarvis-face")?.classList.add("done");
  window.speechSynthesis.speak(utterance);
}

function closeJarvisWelcome() {
  window.speechSynthesis?.cancel?.();
  document.querySelector(".jarvis-welcome-backdrop")?.remove();
}
function loadingView(route) {
  if (route === "landing" || route === "login" || route === "signup" || route === "counselling") {
    return `<div class="skeleton-screen"><div class="skeleton hero-skeleton"></div><div class="skeleton-row"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div>`;
  }
  return appLayout(`<div class="skeleton-screen" style="padding:0"><div class="skeleton" style="height:180px"></div><div class="skeleton-row"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div>`, route);
}

async function loadFunctionalData(route) {
  const loaders = {
    landing: async () => {
      if (!functionalState.courses.length) functionalState.courses = await api("/courses") || [];
      if (!functionalState.tests.length) functionalState.tests = await api("/tests") || [];
    },
    dashboard: async () => {
      functionalState.dashboard = await api("/dashboard/stats");
    },
    roadmap: async () => {
      functionalState.roadmaps = await api("/roadmaps") || [];
    },
    courses: async () => {
      functionalState.courses = await api("/courses") || [];
      const first = functionalState.courses[0];
      functionalState.courseDetail = first ? await api(`/courses/${first.id || first._id || first.slug}`) : null;
    },
    tests: async () => {
      functionalState.tests = await api("/tests") || [];
      functionalState.testResults = await api("/test-results") || [];
    },
    dsa: async () => {
      functionalState.dsa = await api("/dsa/progress");
    },
    resume: async () => {
      functionalState.resume = await api("/resume");
    },
    projects: async () => {
      functionalState.projects = await api("/projects") || [];
    },
    internships: async () => {
      functionalState.internships = await api("/internships") || [];
    },
    hackathons: async () => {
      functionalState.hackathons = await api("/hackathons") || [];
    },
    certificates: async () => {
      functionalState.certificates = await api("/certificates") || [];
    },
    mentor: async () => {
  const [chats, profile, roadmaps, dsa, resume, projects] = await Promise.all([
    api("/ai-mentor/chat"),
    api("/profile"),
    api("/roadmaps"),
    api("/dsa/progress"),
    api("/resume"),
    api("/projects"),
  ]);

  functionalState.chats = chats || [];
  functionalState.profile = profile || {};
  functionalState.roadmaps = roadmaps || [];
  functionalState.dsa = dsa || {};
  functionalState.resume = resume || {};
  functionalState.projects = projects || [];
},
    profile: async () => {
      functionalState.profile = await api("/profile");
    },
    settings: async () => {
      functionalState.settings = await api("/settings");
    },
    admin: async () => {
      functionalState.adminSummary = await api("/admin/summary");
      const resource = normalizeAdminResource(adminResource);
      const [rows, users, courses, roadmaps, notifications, health] = await Promise.all([
        api(`/admin/${resource}`),
        api("/admin/users"),
        api("/admin/courses"),
        api("/admin/roadmaps"),
        api("/admin/notifications"),
        api("/health"),
      ]);
      functionalState.adminRows = rows || [];
      functionalState.adminActivity = {
        users: users || [],
        courses: courses || [],
        roadmaps: roadmaps || [],
        notifications: notifications || [],
      };
      functionalState.adminHealth = health || null;
    },
  };
  if (loaders[route]) await loaders[route]();
}

function dataId(item) {
  return item?._id || item?.id || item?.slug || "";
}

function cleanDate(date) {
  if (!date) return "Recently";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date).slice(0, 12);
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function normalizeAdminResource(resource) {
  return String(resource).trim().toLowerCase().replace(/\s+/g, "-");
}

function emptyState(title, body) {
  return `<div class="empty-state"><div><h3>${title}</h3><p>${body}</p></div></div>`;
}
function mentorSuggestions() {
  const profile = functionalState.profile || {};
  const roadmap = functionalState.roadmaps?.[0] || functionalState.dashboard?.roadmap || {};
  const modules = roadmap.modules || [];
  const activeModule =
    modules.find((item) => item.status === "in-progress" || item.progress < 100) ||
    modules[0] ||
    {};

  const skillPool = [
    ...(activeModule.skills || []),
    ...(profile.skills || []),
    ...((functionalState.projects || []).flatMap((item) => item.skills || [])),
    ...((functionalState.dsa?.topics || []).map((item) => item.name)),
  ].filter(Boolean);

  const uniqueSkills = [...new Set(skillPool)].slice(0, 4);
  const goal = profile.goal || currentUser.goal || roadmap.careerGoal || "career growth";
  const mainSkill = uniqueSkills[0] || activeModule.title || goal;

  return [
    {
      title: `Revise ${mainSkill}`,
      prompt: `Teach me ${mainSkill} from basics to interview level according to my ${goal} roadmap.`,
    },
    {
      title: `Practice ${mainSkill}`,
      prompt: `Give me practice questions and mini tasks for ${mainSkill}. Start from easy and increase difficulty.`,
    },
    {
      title: `Fix weak areas`,
      prompt: `Analyze my current roadmap and skills. Tell me what I should study next for ${goal}.`,
    },
  ];
}

function courseCardFromApi(course) {
  return courseCard({
    title: course.title,
    level: course.level || "Course",
    progress: course.progress || 0,
    students: Number(course.students || 0).toLocaleString(),
    modules: course.modules?.length || 8,
    desc: course.description || course.desc || "Structured learning path with projects and tests.",
  });
}

routeMap.dashboard = function functionalDashboardPage() {
  const data = functionalState.dashboard || {};
  const stats = [
    ["Overall Progress", data.overallProgress || 0, "%", "chart", "Live"],
    ["Tests Completed", data.testsCompleted || 0, "", "test", "Submitted"],
    ["Skills Mastered", data.skillsMastered || 0, "", "star", "From profile"],
    ["XP Points", data.xpPoints || 0, "", "trophy", "Action based"],
    ["Learning Time", data.learningTimeHours || 0, "h", "book", "Calculated"],
  ];
  const recent = data.recentActivity || [];
  const recommended = data.recommendedCourses || [];
  return appLayout(`<div class="welcome-card">
      <h1>Welcome back, ${currentUser.name.split(" ")[0]}</h1>
      <p>Ab dashboard actual actions se update hota hai. Test submit karo, DSA solve karo, project add karo ya internship apply karo - numbers change honge.</p>
      <div class="welcome-meta"><span class="chip">Progress: ${data.overallProgress || 0}%</span><span class="chip">Study streak: ${data.studyStreak || 0} days</span><span class="chip">Applications: ${data.applications || 0}</span></div>
    </div>
    ${statCards(stats)}
    <div class="dash-grid">
      <div class="panel"><div class="panel-head"><h2>Performance Overview</h2><span class="chip purple">Live chart</span></div>${barChart([data.overallProgress || 8, data.testsCompleted * 10 || 10, data.skillsMastered * 4 || 15, data.projectCount * 14 || 12, data.certificatesEarned * 16 || 8, data.studyStreak * 4 || 10, Math.min(96, (data.xpPoints || 100) / 150)])}</div>
      <div class="panel"><div class="panel-head"><h2>Learning Progress</h2><span class="chip green">Action based</span></div><div class="circle-progress" style="--percent:${data.overallProgress || 0}" data-label="${data.overallProgress || 0}%"></div>${progress("Roadmap", data.overallProgress || 0)}${progress("DSA consistency", Math.min(100, data.studyStreak * 5 || 0))}</div>
      <div class="panel"><div class="panel-head"><h2>Upcoming Tests</h2><a href="#tests">Take test</a></div><div class="list">${(data.upcomingTests || []).slice(0, 4).map((item) => testItem([item.title, cleanDate(item.scheduledAt), `${item.durationMinutes || 45} min`, `${item.totalQuestions || 20} questions`])).join("") || emptyState("No tests", "Admin se tests add karo.")}</div></div>
      <div class="panel"><div class="panel-head"><h2>Recent Activity</h2></div><div class="list">${recent.map((item) => `<div class="list-item"><div><h4>${item.title}</h4><p>${cleanDate(item.time)}</p></div><span class="chip purple">${item.type}</span></div>`).join("")}</div></div>
      <div class="panel"><div class="panel-head"><h2>Recommended Courses</h2><a href="#courses">Open</a></div><div class="list">${recommended.slice(0, 4).map((course) => `<div class="list-item"><div><h4>${course.title}</h4><p>${course.description || "Continue learning"}</p></div><span class="chip">${course.progress || 0}%</span></div>`).join("")}</div></div>
      <div class="hero-card"><h2>Next best action</h2><p>Ek test submit karo ya DSA challenge solve karo. Dashboard instantly update hoga.</p><div class="hero-actions"><a class="btn dark" href="#tests">Take Test</a><a class="btn dark" href="#dsa">Solve DSA</a></div></div>
    </div>`, "dashboard");
};

routeMap.roadmap = function functionalRoadmapPage() {
  const roadmap = functionalState.roadmaps[0] || {};
  const roadmapItems = roadmap.weeks?.length ? roadmap.weeks : roadmap.modules || [];
  const liveModules = roadmapItems.map((item, index) => ({
    title: item.title,
    status: item.status === "in-progress" ? "active" : item.status || (index === 0 ? "active" : "locked"),
    progress: item.progress || 0,
    desc: item.description || "",
    estimatedHours: item.estimatedHours || 0,
    tasks: item.tasks || [],
    skills: item.skills || (item.tasks || []).map((task) => task.title).slice(0, 4),
    resources: item.resources || [],
  }));
  const completedModules = liveModules.filter((item) => item.status === "completed").length;
  const activeModule = liveModules.find((item) => item.status === "active") || liveModules[0];
  const hasRoadmap = liveModules.length > 0;
  return appLayout(`<div class="page-head"><div><h1>${roadmap.title || "My Learning Roadmap"}</h1><p>${hasRoadmap ? roadmap.summary || "Follow your saved roadmap week by week." : "Create your personalized roadmap to start learning."}</p></div><div class="toggle-group"><button class="active">Timeline View</button><button>Tree View</button></div></div>
    ${statCards([
      ["Total Modules", liveModules.length, "", "map", roadmap.currentLevel || "Beginner"],
      ["Overall Progress", roadmap.overallProgress || 0, "%", "chart", "Live"],
      ["Time to Goal", roadmap.timeToGoalWeeks || roadmap.estimatedDurationWeeks || 0, "w", "map", "Estimated"],
      ["Skills Learned", roadmap.skillsLearned || 0, "", "book", "Profile"],
      ["Completed Modules", completedModules, "", "trophy", activeModule?.title || "Start"],
    ])}
    <div class="roadmap-layout"><div class="panel"><div class="timeline">${liveModules.map((item) => `<article class="timeline-item ${item.status === "completed" ? "completed" : item.status === "active" ? "active" : ""}"><span class="node"></span><div class="module-card"><header><div><h3>${item.title}</h3><p>${item.desc}</p></div><span class="chip ${item.status === "completed" ? "green" : item.status === "active" ? "purple" : ""}">${item.estimatedHours ? `${item.estimatedHours}h` : item.status}</span></header>${progress("Module progress", item.progress)}<h4>Tasks</h4><div class="skills-row">${item.tasks.length ? item.tasks.map((task) => `<span class="chip">${task.title || task}</span>`).join("") : item.skills.map((skill) => `<span class="chip">${skill}</span>`).join("")}</div><h4 style="margin-top:14px">Resources</h4><div class="skills-row">${item.resources.map((resource) => `<a class="chip" href="${resource.url || "#"}" target="_blank" rel="noopener">${resource.title}</a>`).join("") || `<span class="chip">No resources yet</span>`}</div></div></article>`).join("") || `<div class="empty-state"><div><h3>No roadmap yet</h3><p>Create your personalized roadmap from here.</p><button class="btn primary" type="button" data-action="start-assessment">Create Roadmap</button></div></div>`}</div></div><aside class="panel"><div class="circle-progress" style="--percent:${roadmap.overallProgress || 0}" data-label="${roadmap.overallProgress || 0}%"></div><h3>Next milestone</h3><p class="muted">${roadmap.nextMilestone || roadmap.weeks?.[0]?.title || "Create your roadmap to start."}</p><a class="btn primary" href="${hasRoadmap ? "#courses" : "#assessment"}" ${hasRoadmap ? "" : "data-action=\"start-assessment\""}>${hasRoadmap ? "Continue Course" : "Create Roadmap"}</a></aside></div>`, "roadmap");
};

routeMap.courses = function functionalCoursesPage() {
  const course = functionalState.courseDetail || functionalState.courses[0] || {};
  const modulesList = course.modules || [];
  return appLayout(`<div class="course-layout"><div><div class="hero-card"><span class="chip">${course.level || "Course"}</span><h1>${course.title || "Course"}</h1><p>${course.description || "Continue your course and save progress to backend."}</p><div class="hero-actions"><button class="btn primary" data-action="continue-course" data-course-id="${dataId(course)}">Continue Learning</button><button class="btn dark" data-action="bookmark-course">Bookmark</button><button class="btn dark" data-action="share-course">Share</button></div></div>
      <div class="panel" style="margin-top:16px"><div class="tabs"><button class="active">Course Content</button><button>Projects</button><button>Tests</button><button>Notes</button><button>Discussions</button><button>Resources</button></div><div class="module-list" style="margin-top:16px">${modulesList.map((item, index) => `<div class="module-row"><span class="status-dot ${item.status === "completed" ? "completed" : item.status === "locked" ? "locked" : "progress"}">${item.status === "completed" ? "OK" : item.status === "locked" ? "L" : index + 1}</span><div><h4>${item.title}</h4><p>${item.lessons || 0} lessons - ${item.progress || 0}%</p></div><span class="chip ${item.status === "completed" ? "green" : "purple"}">${item.status}</span></div>`).join("") || emptyState("No modules", "Admin panel se modules add kar sakte ho.")}</div></div></div>
      <aside class="panel"><div class="circle-progress" style="--percent:${course.progress || 0}" data-label="${course.progress || 0}%"></div>${progress("Course completion", course.progress || 0)}<h3 style="margin-top:18px">Instructor</h3><div class="list-item"><div class="list-main"><span class="avatar">${(course.instructor || "AI").split(" ").map((w) => w[0]).join("").slice(0, 2)}</span><div><h4>${course.instructor || "Studox Mentor"}</h4><p>${course.category || "Learning"} mentor</p></div></div></div><div class="hero-card" style="padding:18px;margin-top:16px"><h2>Progress saves now</h2><p>Continue button click karte hi course aur XP update hota hai.</p></div></aside></div>`, "courses");
};

routeMap.tests = function functionalTestsPage() {
  if (functionalState.testSession) return testSessionPage();
  const latest = functionalState.latestResult || functionalState.testResults[0];
  return appLayout(`<div class="page-head"><div><h1>Weekly Tests & AI Test Analysis</h1><p>Ab score tabhi aayega jab test submit karoge. Start Test karke answers choose karo.</p></div></div>
    ${statCards([
      ["Last Score", latest?.score || 0, "/100", "trophy", latest ? "Submitted" : "No test yet"],
      ["Percentile", latest?.percentile || 0, "%", "chart", "Calculated"],
      ["Accuracy", latest?.accuracy || 0, "%", "test", "From answers"],
      ["Time Taken", latest?.timeTakenMinutes || 0, "m", "book", "Tracked"],
      ["Results", functionalState.testResults.length, "", "star", "Saved"],
    ])}
    <div class="dash-grid"><div class="panel"><div class="panel-head"><h2>Available Tests</h2></div><div class="list">${functionalState.tests.map((item) => `<div class="list-item"><div class="list-main"><span class="calendar-tile">${cleanDate(item.scheduledAt).split(" ").pop()}</span><div><h4>${item.title}</h4><p>${item.durationMinutes || 45} min - ${item.totalQuestions || 20} questions</p></div></div><button class="btn primary" data-action="start-test" data-test-id="${dataId(item)}">Start Test</button></div>`).join("")}</div></div><div class="panel"><div class="panel-head"><h2>AI Performance Analysis</h2></div><p class="muted">${latest?.aiSummary || "Pehle test submit karo, phir AI analysis yahan generate hoga."}</p>${progress("Readiness", latest?.score || 0)}${progress("Accuracy", latest?.accuracy || 0)}</div><div class="panel"><div class="panel-head"><h2>Performance Over Time</h2></div>${barChart(functionalState.testResults.slice(0, 7).reverse().map((item) => item.score || 0).concat([0, 0, 0, 0, 0, 0, 0]).slice(0, 7), ["R1", "R2", "R3", "R4", "R5", "R6", "R7"])}</div><div class="panel"><div class="panel-head"><h2>Saved Results</h2></div><div class="list">${functionalState.testResults.map((item) => `<div class="list-item"><div><h4>${item.score}% score</h4><p>${item.aiSummary || "Analysis saved"}</p></div><span class="chip green">${cleanDate(item.createdAt)}</span></div>`).join("") || emptyState("No results yet", "Start Test pe click karo.")}</div></div></div>`, "tests");
};

function testSessionPage() {
  const session = functionalState.testSession;
  return appLayout(`<div class="page-head"><div><h1>${session.title}</h1><p>Answers choose karo, submit karte hi score calculate hoga aur dashboard update hoga.</p></div><button class="btn" data-action="cancel-test">Cancel</button></div><form class="panel form-grid" data-form="test-submit" data-test-id="${session.id}">${session.questions.map((q, index) => `<div class="module-card"><h3>${index + 1}. ${q.prompt}</h3><div class="form-grid" style="margin-top:10px">${(q.options || []).map((option) => `<label class="check-item"><span>${option}</span><input type="radio" name="q_${dataId(q)}" value="${escapeHtml(option)}" required /></label>`).join("")}</div></div>`).join("")}<button class="btn primary" type="submit">Submit Test</button></form>`, "tests");
}

routeMap.dsa = function functionalDsaPage() {
  const dsa = functionalState.dsa || {};
  const topics = dsa.topics || [];
  return appLayout(`<div class="page-head"><div><h1>DSA Practice Platform</h1><p>Solve challenge click karte hi solved count, streak, ranking aur recent problems update honge.</p></div><button class="btn primary" data-action="solve-dsa">Solve Today's Challenge</button></div>
    ${statCards([
      ["Problems Solved", dsa.problemsSolved || 0, "", "code", "Live"],
      ["Acceptance Rate", dsa.acceptanceRate || 0, "%", "chart", "Updated"],
      ["Current Streak", dsa.currentStreak || 0, "d", "trophy", "Action"],
      ["Ranking", dsa.ranking || 0, "", "star", "Improves"],
      ["Total Problems", dsa.totalProblems || 0, "", "book", "Bank"],
    ])}
    <div class="dash-grid"><div class="panel"><div class="panel-head"><h2>Topic Wise Progress</h2></div>${topics.map((topic) => progress(topic.name, Math.round((topic.solved || 0) / (topic.total || 1) * 100))).join("")}</div><div class="panel"><div class="panel-head"><h2>Today's Challenge</h2><span class="chip purple">Functional</span></div><h3>Longest Repeating Character Replacement</h3><p class="muted">Click solve to add it to your real progress.</p><button class="btn primary" data-action="solve-dsa">Mark Solved</button></div><div class="panel"><div class="panel-head"><h2>Recent Problems</h2></div><div class="table-wrap"><table><thead><tr><th>Problem</th><th>Topic</th><th>Level</th><th>Status</th><th>Score</th></tr></thead><tbody>${(dsa.recentProblems || []).map((row) => `<tr><td>${row.title}</td><td>${row.topic}</td><td>${row.level}</td><td><span class="chip green">${row.status}</span></td><td>${row.score}%</td></tr>`).join("")}</tbody></table></div></div><div class="panel"><h2>Badges Earned</h2><div class="skills-row">${(dsa.badges || []).map((badge) => `<span class="chip purple">${badge}</span>`).join("")}</div></div></div>`, "dsa");
};

routeMap.resume = function functionalResumePage() {
  const resume = functionalState.resume || {};
  const ats = functionalState.ats || { score: resume.atsScore || 0, suggestions: resume.analysis || [] };
  const text = `${resume.sections?.summary || "Student developer building MERN projects."} Skills: ${(resume.sections?.skills || ["React", "Node.js"]).join(", ")}`;
  return appLayout(`<div class="page-head"><div><h1>Resume Builder + ATS Score</h1><p>Resume text edit karo aur Scan ATS click karo. Score actual text keywords se calculate hota hai.</p></div><div class="hero-actions"><button class="btn" data-action="download-resume">Download PDF</button><button class="btn" data-action="download-resume">Download DOCX</button></div></div>
    <div class="resume-layout"><div class="panel"><form class="form-grid" data-form="resume-scan"><div class="field"><label>Target role</label><input name="targetRole" value="${resume.targetRole || currentUser.goal}" /></div><div class="field"><label>Resume content</label><textarea name="resumeText">${text}</textarea></div><button class="btn primary" type="submit">Scan ATS & Save Resume</button></form><div class="resume-preview" style="margin-top:16px"><h2>${currentUser.name}</h2><p>${currentUser.goal} - ${currentUser.email}</p><h3>Live Resume Text</h3><p>${escapeHtml(text)}</p></div></div><aside class="panel"><div class="circle-progress" style="--percent:${ats.score || 0}" data-label="${ats.score || 0}"></div><h2>ATS Score</h2><div class="list">${(ats.suggestions || []).map((item) => `<div class="list-item"><p>${item}</p></div>`).join("") || emptyState("No scan yet", "Resume content scan karo.")}</div></aside></div>`, "resume");
};

routeMap.projects = function functionalProjectsPage() {
  return appLayout(`<div class="page-head"><div><h1>Projects Showcase</h1><p>Add project form se backend mein real project create hoga. Feature button project status update karega.</p></div></div>
    ${statCards([
      ["Total Projects", functionalState.projects.length, "", "briefcase", "Saved"],
      ["Featured Projects", functionalState.projects.filter((item) => item.featured).length, "", "star", "Live"],
      ["Profile Views", functionalState.projects.reduce((sum, item) => sum + Number(item.views || 0), 0), "", "chart", "Total"],
      ["Project Likes", functionalState.projects.reduce((sum, item) => sum + Number(item.likes || 0), 0), "", "trophy", "Total"],
      ["Skills in Projects", new Set(functionalState.projects.flatMap((item) => item.skills || [])).size, "", "code", "Mapped"],
    ])}
    <div class="two-column"><form class="panel form-grid" data-form="project-add"><h2>Add New Project</h2><div class="field"><label>Title</label><input name="title" placeholder="Project title" required /></div><div class="field"><label>Description</label><textarea name="description" placeholder="What does it do?" required></textarea></div><div class="field"><label>Skills comma separated</label><input name="skills" placeholder="React, Node, MongoDB" /></div><button class="btn primary" type="submit">Add Project</button></form><div class="hero-card"><h2>Real portfolio state</h2><p>Projects add karne ke baad dashboard, profile strength aur admin data update hota hai.</p></div></div>
    <div class="project-grid" style="margin-top:16px">${functionalState.projects.map((item) => `<article class="card"><div class="course-art"><span class="chip">${item.status || "Published"}</span><strong>${item.views || 0} views</strong></div><h3>${item.title}</h3><p>${item.description}</p><div class="skills-row">${(item.skills || []).map((skill) => `<span class="chip">${skill}</span>`).join("")}</div><div class="form-row"><button class="btn primary" data-action="feature-project" data-project-id="${dataId(item)}">Feature</button><button class="btn">Open</button></div></article>`).join("")}</div>`, "projects");
};

routeMap.internships = function functionalInternshipsPage() {
  return appLayout(`<div class="page-head"><div><h1>Internship Portal</h1><p>Apply button backend mein application save karega. Dashboard application count update hoga.</p></div><span class="chip green">Resume match active</span></div><div class="panel" style="margin-bottom:16px"><div class="filters">${["Domain", "Location", "Duration", "Stipend", "Remote", "Full-time"].map((filter, i) => `<button class="${i === 0 ? "active" : ""}">${filter}</button>`).join("")}</div></div><div class="dash-grid"><div class="panel"><div class="panel-head"><h2>Recommended Internships</h2></div><div class="list">${functionalState.internships.map((item) => `<div class="list-item"><div class="list-main"><span class="stat-icon">${icon("briefcase")}</span><div><h4>${item.role}</h4><p>${item.company} - ${item.location} - ${item.duration} - ${item.stipend}</p></div></div><div class="hero-actions"><span class="chip green">${item.matchScore || 80}% match</span><button class="btn primary" data-action="apply-internship" data-internship-id="${dataId(item)}">Apply</button></div></div>`).join("")}</div></div><div class="panel"><h2>Recent Applications</h2><div class="list">${functionalState.internships.filter((item) => (item.applicants || []).length).map((item) => `<div class="list-item"><h4>${item.company}</h4><span class="chip green">applied</span></div>`).join("") || emptyState("No applications", "Apply pe click karo.")}</div></div></div>`, "internships");
};

routeMap.hackathons = function functionalHackathonsPage() {
  return appLayout(`<div class="page-head"><div><h1>Hackathons</h1><p>Register button actual registration save karega.</p></div><div class="hero-actions"><button class="btn">Find Teammates</button><button class="btn primary">Submit Idea</button></div></div>
    ${statCards([
      ["Available", functionalState.hackathons.length, "", "trophy", "Live"],
      ["Registered", functionalState.hackathons.filter((item) => (item.registrations || []).length).length, "", "briefcase", "Saved"],
      ["Team Invites", 0, "", "user", "Soon"],
      ["Skills Gained", new Set(functionalState.hackathons.flatMap((item) => item.skills || [])).size, "", "star", "Mapped"],
      ["Prizes Won", 0, "", "chart", "Track"],
    ])}
    <div class="hackathon-grid">${functionalState.hackathons.map((item) => `<article class="card"><span class="chip purple">${item.domain}</span><h3>${item.title}</h3><p>${item.duration} - ${item.prize} - Starts ${cleanDate(item.startsAt)}</p>${progress("Team readiness", 76)}<div class="form-row"><button class="btn primary" data-action="register-hackathon" data-hackathon-id="${dataId(item)}">Register</button><button class="btn">Details</button></div></article>`).join("")}</div>`, "hackathons");
};

routeMap.certificates = function functionalCertificatesPage() {
  return appLayout(`<div class="page-head"><div><h1>Certificates & Achievements</h1><p>Share button certificate share count update karega aur share URL return karega.</p></div></div>
    ${statCards([
      ["Certificates Earned", functionalState.certificates.length, "", "star", "Verified"],
      ["Achievements", functionalState.certificates.length * 2, "", "trophy", "Unlocked"],
      ["Skill Badges", functionalState.certificates.length, "", "code", "Mapped"],
      ["Courses Completed", functionalState.certificates.length, "", "book", "Saved"],
      ["Total Shares", functionalState.certificates.reduce((sum, item) => sum + Number(item.shareCount || 0), 0), "", "chart", "Live"],
    ])}
    <div class="certificate-grid">${functionalState.certificates.map((item) => `<article class="card"><div class="course-art"><span class="chip">${item.category}</span><strong>${item.status}</strong></div><h3>${item.title}</h3><p>Issued ${cleanDate(item.issuedAt)} - Shared ${item.shareCount || 0} times.</p><button class="btn primary" data-action="share-certificate" data-certificate-id="${dataId(item)}">Share</button></article>`).join("")}</div>`, "certificates");
};

routeMap.profile = function functionalProfilePage() {
  const profile = functionalState.profile || {};
  return appLayout(`<div class="page-head"><div><h1>Profile Settings</h1><p>Save Profile se backend profile update hoti hai aur user dropdown bhi update hota hai.</p></div></div><div class="roadmap-layout"><form class="panel dark-card form-grid" data-form="profile-save"><div class="profile-cover"><div class="profile-avatar">${currentUser.avatar}</div><div><h2>${currentUser.name}</h2><p>${profile.goal || currentUser.goal} - ${profile.branch || "Branch"} - ${profile.level || "Level"}</p></div></div><div class="two-column"><div class="field"><label>Full name</label><input name="name" value="${currentUser.name}" /></div><div class="field"><label>Username</label><input name="username" value="${profile.username || ""}" /></div><div class="field"><label>Email</label><input name="email" value="${currentUser.email}" /></div><div class="field"><label>Phone</label><input name="phone" value="${profile.phone || ""}" /></div><div class="field"><label>College</label><input name="college" value="${profile.college || ""}" /></div><div class="field"><label>Branch</label><input name="branch" value="${profile.branch || ""}" /></div></div><div class="field"><label>Skills comma separated</label><input name="skills" value="${(profile.skills || []).join(", ")}" /></div><div class="field"><label>Bio</label><textarea name="bio">${profile.bio || ""}</textarea></div><button class="btn primary" type="submit">Save Profile</button></form><aside class="panel dark-card"><h2>Profile Completion</h2><div class="circle-progress" style="--percent:${profile.profileCompletion || 0}" data-label="${profile.profileCompletion || 0}%"></div>${progress("Skills", Math.min(100, (profile.skills || []).length * 18))}${progress("Education", profile.education?.length ? 100 : 20)}<h3 style="margin-top:18px">Activity Summary</h3><p class="muted">XP: ${profile.xp || 0}, Streak: ${profile.streak || 0} days.</p></aside></div>`, "profile");
};

routeMap.settings = function functionalSettingsPage() {
  const settings = functionalState.settings || {};
  const selectedTheme = settings.theme || getStoredTheme();
  return appLayout(`<div class="page-head"><div><h1>Settings</h1><p>Save All Changes se preferences backend mein save hoti hain.</p></div></div><form class="roadmap-layout" data-form="settings-save"><div class="panel dark-card"><h2>Appearance</h2><div class="settings-list" style="margin-top:14px"><div class="setting-row"><div><strong>Theme</strong><p class="muted">Choose light, dark or system mode.</p></div><select name="theme"><option ${selectedTheme === "light" ? "selected" : ""}>light</option><option ${selectedTheme === "dark" ? "selected" : ""}>dark</option><option ${selectedTheme === "system" ? "selected" : ""}>system</option></select></div><div class="setting-row"><div><strong>Accent color</strong><p class="muted">Primary dashboard accent.</p></div><input name="accentColor" value="${settings.accentColor || "#2563eb"}" /></div><div class="setting-row"><div><strong>Language</strong><p class="muted">Interface language.</p></div><select name="language"><option ${settings.language === "English" ? "selected" : ""}>English</option><option ${settings.language === "Hindi" ? "selected" : ""}>Hindi</option><option ${settings.language === "Spanish" ? "selected" : ""}>Spanish</option></select></div></div><h2 style="margin-top:22px">Study Preferences</h2><div class="settings-list" style="margin-top:14px">${["Daily learning reminders", "Weekly test nudges", "DSA challenge alerts", "Internship recommendations"].map((item, i) => `<div class="setting-row"><strong>${item}</strong><label class="switch"><input name="pref_${i}" type="checkbox" checked/><span></span></label></div>`).join("")}</div></div><aside class="panel dark-card"><h2>Notifications</h2><div class="settings-list" style="margin-top:14px">${["Email updates", "Push notifications", "Mentor summaries", "Career alerts"].map((item, i) => `<div class="setting-row"><strong>${item}</strong><label class="switch"><input name="note_${i}" type="checkbox" checked/><span></span></label></div>`).join("")}</div><button class="btn primary" style="margin-top:18px" type="submit">Save All Changes</button></aside></form>`, "settings");
};

routeMap.admin = function functionalAdminPage() {
  const summary = functionalState.adminSummary || {};
  const resources = [
    ["users", "Users"],
    ["courses", "Courses"],
    ["roadmaps", "Roadmaps"],
    ["tests", "Tests"],
    ["internships", "Internships"],
    ["notifications", "Announcements"],
    ["hackathons", "Hackathons"],
    ["certificates", "Certificates"],
    ["mentor-prompts", "Mentor Prompts"],
    ["reports", "Reports"],
    ["content", "Content"],
  ];
  const activeResource = normalizeAdminResource(adminResource);
  const resourceIcons = {
    users: "user",
    courses: "book",
    roadmaps: "map",
    tests: "test",
    internships: "briefcase",
    notifications: "bell",
    hackathons: "trophy",
    certificates: "star",
    "mentor-prompts": "bot",
    reports: "chart",
    content: "resume",
  };
  const activeLabel = resources.find(([key]) => key === activeResource)?.[1] || activeResource.replace(/-/g, " ");
  const normalizedSearch = adminSearchTerm.trim().toLowerCase();
  const filteredRows = functionalState.adminRows.filter((item) => {
    const haystack = [item.title, item.name, item.email, item.role, item.company, item.status, item.category, item.level, item.type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const status = String(item.status || item.role || "Live").toLowerCase();
    const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
    const matchesStatus = adminStatusFilter === "all" || status === adminStatusFilter;
    return matchesSearch && matchesStatus;
  });
  const rowsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  if (adminPageIndex > totalPages) adminPageIndex = totalPages;
  const pageRows = filteredRows.slice((adminPageIndex - 1) * rowsPerPage, adminPageIndex * rowsPerPage);
  const activity = functionalState.adminActivity || {};
  const activityGroups = [
    ["Latest Users", activity.users || [], "user"],
    ["Latest Courses", activity.courses || [], "book"],
    ["Latest Roadmaps", activity.roadmaps || [], "map"],
    ["Latest Announcements", activity.notifications || [], "bell"],
  ];
  const health = functionalState.adminHealth || {};
  const overviewCards = [
    ["Total Students", summary.users || 0, "user", "Real user records"],
    ["Courses", summary.courses || 0, "book", "Published content"],
    ["Roadmaps", summary.roadmaps || 0, "map", "Saved plans"],
    ["Tests", summary.tests || 0, "test", "Assessments"],
    ["Announcements", summary.notifications || 0, "bell", "Notification records"],
    ["Active Admins", summary.admins || 0, "admin", summary.admins ? "Role-based count" : "No admins counted"],
  ];
  return appLayout(`<section class="admin-console">
    <div class="admin-topline">
      <div>
        <span class="admin-kicker">${icon("admin")} Internal Admin</span>
        <h1>Operations</h1>
      </div>
      <div class="admin-top-actions">
        <a class="btn" href="#landing">Visit Website ${icon("arrow-right")}</a>
        <a class="btn" href="#settings">${icon("settings")} Settings</a>
      </div>
    </div>

    <div class="admin-stat-grid">
      ${overviewCards.map(([label, value, iconName, note], index) => `<article class="admin-stat-card panel">
        <span class="admin-stat-icon tone-${index + 1}">${icon(iconName)}</span>
        <div><strong>${value}</strong><span>${label}</span></div>
        <small>${note}</small>
      </article>`).join("")}
    </div>

    <div class="admin-action-strip panel">
      <span>Quick Actions</span>
      ${[
        ["courses", "Add Course", "book"],
        ["roadmaps", "Add Roadmap", "map"],
        ["tests", "Add Test", "test"],
        ["notifications", "Create Announcement", "bell"],
      ].map(([key, label, iconName]) => `<button class="admin-action-chip" data-admin="${key}">${icon(iconName)}${label}</button>`).join("")}
    </div>

    <div class="admin-layout admin-console-grid">
      <aside class="panel admin-control-panel">
        <div class="panel-head"><div><h2>Resources</h2><p class="muted">CRUD manager</p></div></div>
        <div class="admin-nav">${resources.map(([item, label]) => `<button class="btn ${activeResource === item ? "active" : ""}" data-admin="${item}"><span>${icon(resourceIcons[item] || "admin")}</span>${label}</button>`).join("")}</div>
        <form class="form-grid admin-add-card" data-form="admin-add">
          <h3>${activeResource === "notifications" ? "Create Announcement" : "Quick Add"}</h3>
          <p class="muted">${activeResource === "notifications" ? "Create draft or published announcements using generic admin CRUD." : `Creates a new ${activeLabel.toLowerCase()} item with the existing API.`}</p>
          <div class="field"><label>Title / name</label><input name="title" placeholder="New item" required /></div>
          ${activeResource === "notifications" ? `<div class="field"><label>Status</label><select name="status"><option>Draft</option><option>Published</option></select></div>` : ""}
          <button class="btn primary" type="submit">${icon("plus")} ${activeResource === "notifications" ? "Create Announcement" : "Add Item"}</button>
        </form>
      </aside>

      <section class="panel admin-table-panel">
        <div class="panel-head">
          <div><h2>Resource Manager</h2><p class="muted" data-admin-table-count>${activeLabel}: ${filteredRows.length}/${functionalState.adminRows.length} records loaded from backend.</p></div>
          <div class="admin-table-meta" data-admin-table-meta><span class="chip green">Live data</span><span class="chip">Page ${adminPageIndex}/${totalPages}</span></div>
        </div>
        <div class="admin-toolbar">
          <label class="admin-search">${icon("search")}<input data-admin-search value="${adminSearchTerm}" placeholder="Search ${activeLabel.toLowerCase()}..." /></label>
          <select data-admin-filter>
            ${["all", "live", "active", "draft", "published", "review", "admin", "student"].map((item) => `<option value="${item}" ${adminStatusFilter === item ? "selected" : ""}>${item === "all" ? "All status" : item}</option>`).join("")}
          </select>
        </div>
        <div class="table-wrap admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Name</th><th>Status</th><th>Owner</th><th>Updated</th><th>Actions</th></tr></thead>
            <tbody data-admin-table-body>${pageRows.length ? pageRows.map((item) => `<tr>
              <td><strong>${item.title || item.name || item.role || item.company || item.email || "Untitled"}</strong><small>${item.email || item.category || item.level || item.type || "Studox resource"}</small></td>
              <td><span class="chip ${String(item.status || item.role || "Live").toLowerCase().includes("admin") ? "purple" : "green"}">${item.status || item.role || "Live"}</span></td>
              <td>${item.owner || item.instructor || item.company || "Studox Admin"}</td>
              <td>${cleanDate(item.updatedAt || item.createdAt)}</td>
              <td><div class="admin-row-actions"><button class="btn" data-action="admin-edit" data-admin-id="${dataId(item)}">Edit</button><button class="btn danger-light" data-action="admin-delete" data-admin-id="${dataId(item)}">Delete</button></div></td>
            </tr>`).join("") : `<tr><td colspan="5">${emptyState("No records found", normalizedSearch || adminStatusFilter !== "all" ? "Try clearing search or filters." : "Use Quick Add to create the first item for this resource.")}</td></tr>`}</tbody>
          </table>
        </div>
        <div class="admin-pagination" data-admin-pagination>
          <button class="btn" data-action="admin-page" data-page="${Math.max(1, adminPageIndex - 1)}" ${adminPageIndex <= 1 ? "disabled" : ""}>Previous</button>
          <span>Page ${adminPageIndex} of ${totalPages}</span>
          <button class="btn" data-action="admin-page" data-page="${Math.min(totalPages, adminPageIndex + 1)}" ${adminPageIndex >= totalPages ? "disabled" : ""}>Next</button>
        </div>
      </section>

      <aside class="admin-side-stack">
        <section class="panel admin-activity-card">
          <div class="panel-head"><h2>Recent Platform Activity</h2><span class="chip">Real records</span></div>
          <div class="admin-activity-list">${activityGroups.map(([label, rows, iconName]) => {
            const latest = rows[0];
            return `<div><span>${icon(iconName)}</span><p><strong>${label}</strong><small>${latest ? `${latest.title || latest.name || latest.email || "Latest item"} - ${cleanDate(latest.createdAt || latest.updatedAt)}` : "No records yet"}</small></p></div>`;
          }).join("")}</div>
        </section>
        <section class="panel admin-health-card">
          <div class="panel-head"><h2>Basic Platform Status</h2><span class="chip amber">Honest</span></div>
          ${[
            ["Authentication", "Admin route requires backend role guard", "Verified"],
            ["Database", health.database ? `Current mode: ${health.database}` : "Health endpoint unavailable", health.database ? "Verified" : "Pending"],
            ["API Status", health.ok ? "Health endpoint responded" : "Backend integration pending", health.ok ? "Verified" : "Pending"],
          ].map(([title, body, status]) => `<div class="admin-health-row"><span class="${status === "Pending" ? "pending" : ""}"></span><strong>${title}<small>${body}</small></strong><em>${status}</em></div>`).join("")}
        </section>
        <section class="panel admin-security-card">
          <h2>${icon("lock")} Security</h2>
          <p>Admin APIs require login and backend role verification.</p>
          <code>req.user.role === "admin"</code>
        </section>
      </aside>
    </div>
  </section>`, "admin");
};

function getAdminTableState() {
  const resources = [
    ["users", "Users"],
    ["courses", "Courses"],
    ["roadmaps", "Roadmaps"],
    ["tests", "Tests"],
    ["internships", "Internships"],
    ["notifications", "Announcements"],
    ["hackathons", "Hackathons"],
    ["certificates", "Certificates"],
    ["mentor-prompts", "Mentor Prompts"],
    ["reports", "Reports"],
    ["content", "Content"],
  ];
  const activeResource = normalizeAdminResource(adminResource);
  const activeLabel = resources.find(([key]) => key === activeResource)?.[1] || activeResource.replace(/-/g, " ");
  const normalizedSearch = adminSearchTerm.trim().toLowerCase();
  const filteredRows = functionalState.adminRows.filter((item) => {
    const haystack = [item.title, item.name, item.email, item.role, item.company, item.status, item.category, item.level, item.type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const status = String(item.status || item.role || "Live").toLowerCase();
    const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
    const matchesStatus = adminStatusFilter === "all" || status === adminStatusFilter;
    return matchesSearch && matchesStatus;
  });
  const rowsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  if (adminPageIndex > totalPages) adminPageIndex = totalPages;
  const pageRows = filteredRows.slice((adminPageIndex - 1) * rowsPerPage, adminPageIndex * rowsPerPage);
  return { activeLabel, normalizedSearch, filteredRows, totalPages, pageRows };
}

function adminTableRowsHtml(pageRows, normalizedSearch) {
  if (!pageRows.length) {
    return `<tr><td colspan="5">${emptyState("No records found", normalizedSearch || adminStatusFilter !== "all" ? "Try clearing search or filters." : "Use Quick Add to create the first item for this resource.")}</td></tr>`;
  }
  return pageRows.map((item) => `<tr>
    <td><strong>${item.title || item.name || item.role || item.company || item.email || "Untitled"}</strong><small>${item.email || item.category || item.level || item.type || "Studox resource"}</small></td>
    <td><span class="chip ${String(item.status || item.role || "Live").toLowerCase().includes("admin") ? "purple" : "green"}">${item.status || item.role || "Live"}</span></td>
    <td>${item.owner || item.instructor || item.company || "Studox Admin"}</td>
    <td>${cleanDate(item.updatedAt || item.createdAt)}</td>
    <td><div class="admin-row-actions"><button class="btn" data-action="admin-edit" data-admin-id="${dataId(item)}">Edit</button><button class="btn danger-light" data-action="admin-delete" data-admin-id="${dataId(item)}">Delete</button></div></td>
  </tr>`).join("");
}

function adminPaginationHtml(totalPages) {
  return `<button class="btn" data-action="admin-page" data-page="${Math.max(1, adminPageIndex - 1)}" ${adminPageIndex <= 1 ? "disabled" : ""}>Previous</button>
    <span>Page ${adminPageIndex} of ${totalPages}</span>
    <button class="btn" data-action="admin-page" data-page="${Math.min(totalPages, adminPageIndex + 1)}" ${adminPageIndex >= totalPages ? "disabled" : ""}>Next</button>`;
}

function refreshAdminTable() {
  const tableBody = document.querySelector("[data-admin-table-body]");
  const tableCount = document.querySelector("[data-admin-table-count]");
  const tableMeta = document.querySelector("[data-admin-table-meta]");
  const pagination = document.querySelector("[data-admin-pagination]");
  if (!tableBody || !tableCount || !tableMeta || !pagination) return;
  const { activeLabel, normalizedSearch, filteredRows, totalPages, pageRows } = getAdminTableState();
  tableCount.textContent = `${activeLabel}: ${filteredRows.length}/${functionalState.adminRows.length} records loaded from backend.`;
  tableMeta.innerHTML = `<span class="chip green">Live data</span><span class="chip">Page ${adminPageIndex}/${totalPages}</span>`;
  tableBody.innerHTML = adminTableRowsHtml(pageRows, normalizedSearch);
  pagination.innerHTML = adminPaginationHtml(totalPages);
  bindAdminTableActions();
}

function bindAdminTableActions() {
  document.querySelectorAll("[data-action='admin-page']").forEach((button) => button.addEventListener("click", () => {
    adminPageIndex = Math.max(1, Number(button.dataset.page || 1));
    refreshAdminTable();
  }));
  document.querySelectorAll("[data-action='admin-delete']").forEach((button) => button.addEventListener("click", handleAdminDelete));
  document.querySelectorAll("[data-action='admin-edit']").forEach((button) => button.addEventListener("click", handleAdminEdit));
}

bindPage = function functionalBindPage() {
  document.querySelectorAll("[data-toast]").forEach((node) => {
    node.addEventListener("click", (event) => {
      event.preventDefault();
      toast(node.dataset.toast);
    });
  });
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.parentElement.querySelector("input");
      input.type = input.type === "password" ? "text" : "password";
    });
  });
  document.querySelectorAll("[data-user-toggle]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById("userDropdown")?.classList.toggle("open"));
  });
  document.querySelectorAll("[data-mobile-menu]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("sidebar")?.classList.add("open");
      document.querySelector("[data-mobile-close]")?.classList.add("open");
    });
  });
  document.querySelectorAll("[data-mobile-close], .side-link").forEach((node) => {
    node.addEventListener("click", () => {
      document.getElementById("sidebar")?.classList.remove("open");
      document.querySelector("[data-mobile-close]")?.classList.remove("open");
    });
  });
  document.querySelectorAll("[data-form='login']").forEach((form) => form.addEventListener("submit", handleLogin));
  document.querySelectorAll("[data-form='signup']").forEach((form) => form.addEventListener("submit", handleSignup));
  document.querySelectorAll("[data-form='chat']").forEach((form) => form.addEventListener("submit", handleChat));
  document.querySelectorAll("[data-action='start-assessment']").forEach((button) => {
    button.addEventListener("click", beginRoadmapCounselling);
  });
  document.querySelectorAll("[data-form='counselling-education']").forEach((form) => form.addEventListener("submit", handleCounsellingEducation));
  document.querySelectorAll("[data-form='counselling-skills']").forEach((form) => form.addEventListener("submit", handleCounsellingSkills));
  document.querySelectorAll("[data-action='skip-counselling'], [data-action='start-career-assessment']").forEach((button) => button.addEventListener("click", startCareerAssessment));
  document.querySelectorAll("[data-action='forgot']").forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      const result = await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: "aarav@studox.ai" }) });
      toast(result?.message || "OTP generated.");
    });
  });
  document.querySelectorAll("[data-action='logout']").forEach((button) => {
    button.addEventListener("click", () => {
      clearDemoSession();
      toast("Logged out.");
      setRoute("landing");
    });
  });
  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.querySelector("[data-form='chat'] input");
      if (input) input.value = button.dataset.prompt;
    });
  });
  document.querySelectorAll("[data-admin]").forEach((button) => {
    button.addEventListener("click", () => {
      adminResource = normalizeAdminResource(button.dataset.admin);
      adminSearchTerm = "";
      adminStatusFilter = "all";
      adminPageIndex = 1;
      render();
    });
  });
  bindFunctionalActions();

};

function bindFunctionalActions() {
  document.querySelectorAll("[data-action='continue-course']").forEach((button) => button.addEventListener("click", async () => {
    const result = await api(`/courses/${button.dataset.courseId}/continue`, { method: "POST", body: "{}" });
    toast(result?.message || "Progress updated.");
    await render();
  }));
  document.querySelectorAll("[data-action='bookmark-course']").forEach((button) => button.addEventListener("click", () => toast("Course bookmarked locally.")));
  document.querySelectorAll("[data-action='share-course']").forEach((button) => button.addEventListener("click", () => toast("Course share link ready.")));
  document.querySelectorAll("[data-action='start-test']").forEach((button) => button.addEventListener("click", async () => {
    const test = functionalState.tests.find((item) => String(dataId(item)) === String(button.dataset.testId));
    const questions = await api(`/tests/${button.dataset.testId}/questions`) || [];
    functionalState.testSession = { id: button.dataset.testId, title: test?.title || "Weekly Test", questions };
    if (!questions.length) toast("Is test mein questions nahi hain. Admin panel se questions add karo.");
    await render();
  }));
  document.querySelectorAll("[data-action='cancel-test']").forEach((button) => button.addEventListener("click", async () => {
    functionalState.testSession = null;
    await render();
  }));
  document.querySelectorAll("[data-form='test-submit']").forEach((form) => form.addEventListener("submit", handleFunctionalTestSubmit));
  document.querySelectorAll("[data-action='solve-dsa']").forEach((button) => button.addEventListener("click", async () => {
    const result = await api("/dsa/solve-challenge", { method: "POST", body: JSON.stringify({}) });
    toast(result?.message || "DSA progress updated.");
    await render();
  }));
  document.querySelectorAll("[data-form='resume-scan']").forEach((form) => form.addEventListener("submit", handleResumeScan));
  document.querySelectorAll("[data-action='download-resume']").forEach((button) => button.addEventListener("click", () => toast("Download export placeholder ready. PDF/DOCX generator next integration hai.")));
  document.querySelectorAll("[data-form='project-add']").forEach((form) => form.addEventListener("submit", handleProjectAdd));
  document.querySelectorAll("[data-action='feature-project']").forEach((button) => button.addEventListener("click", async () => {
    await api(`/projects/${button.dataset.projectId}`, { method: "PUT", body: JSON.stringify({ featured: true, status: "Featured" }) });
    toast("Project featured.");
    await render();
  }));
  document.querySelectorAll("[data-action='apply-internship']").forEach((button) => button.addEventListener("click", async () => {
    const result = await api(`/internships/${button.dataset.internshipId}/apply`, { method: "POST", body: "{}" });
    toast(result?.message || "Applied.");
    await render();
  }));
  document.querySelectorAll("[data-action='register-hackathon']").forEach((button) => button.addEventListener("click", async () => {
    const result = await api(`/hackathons/${button.dataset.hackathonId}/register`, { method: "POST", body: "{}" });
    toast(result?.message || "Registered.");
    await render();
  }));
  document.querySelectorAll("[data-action='share-certificate']").forEach((button) => button.addEventListener("click", async () => {
    const result = await api(`/certificates/${button.dataset.certificateId}/share`, { method: "POST", body: "{}" });
    toast(result?.message || "Share card generated.");
    await render();
  }));
  document.querySelectorAll("[data-form='profile-save']").forEach((form) => form.addEventListener("submit", handleProfileSave));
  document.querySelectorAll("[data-form='settings-save']").forEach((form) => form.addEventListener("submit", handleSettingsSave));
  document.querySelectorAll("[data-form='admin-add']").forEach((form) => form.addEventListener("submit", handleAdminAdd));
  document.querySelectorAll("[data-admin-search]").forEach((input) => input.addEventListener("input", () => {
    adminSearchTerm = input.value;
    adminPageIndex = 1;
    window.clearTimeout(adminSearchTimer);
    adminSearchTimer = window.setTimeout(refreshAdminTable, 280);
  }));
  document.querySelectorAll("[data-admin-filter]").forEach((select) => select.addEventListener("change", () => {
    adminStatusFilter = select.value || "all";
    adminPageIndex = 1;
    refreshAdminTable();
  }));
  document.querySelectorAll("[data-form='roadmap-assessment']").forEach((form) => form.addEventListener("submit", handleRoadmapAssessmentSubmit));
  document.querySelectorAll("[data-action='assessment-next']").forEach((button) => button.addEventListener("click", handleAssessmentNext));
  document.querySelectorAll("[data-action='assessment-prev']").forEach((button) => button.addEventListener("click", handleAssessmentPrev));
  document.querySelectorAll("[data-form='roadmap-assessment'] input[type='radio']").forEach((input) => input.addEventListener("change", handleAssessmentOptionChange));
  document.querySelectorAll("[data-assessment-field]").forEach((input) => input.addEventListener("input", () => syncAssessmentAnswer(document.querySelector("[data-form='roadmap-assessment']"))));
  document.querySelectorAll("[data-action='preview-roadmap']").forEach((card) => card.addEventListener("click", handleRoadmapPreview));
  document.querySelectorAll("[data-action='choose-roadmap']").forEach((button) => button.addEventListener("click", handleChooseRoadmap));
  document.querySelectorAll("[data-action='choose-roadmap-signup']").forEach((button) => button.addEventListener("click", handleChooseRoadmapSignup));
  bindAdminTableActions();
}

function assessmentTimelineWeeks(value = "") {
  if (value.includes("1 month")) return 4;
  if (value.includes("3 months")) return 12;
  if (value.includes("6 months")) return 24;
  if (value.includes("12 months")) return 48;
  return 12;
}

function assessmentWeeklyHours(value = "") {
  if (value.includes("3-5")) return 4;
  if (value.includes("6-8")) return 7;
  if (value.includes("9-12")) return 10;
  if (value.includes("15")) return 15;
  return 7;
}

function assessmentFieldFromGoal(goal = "") {
  const text = String(goal).toLowerCase();
  if (text.includes("ai") || text.includes("ml")) return "Artificial Intelligence";
  if (text.includes("data")) return "Data Science";
  if (text.includes("cyber")) return "Cybersecurity";
  if (text.includes("design")) return "Design";
  return "Computer Science";
}

function assessmentInputPayload(data = assessmentFormData()) {
  const profile = functionalState.profile || functionalState.dashboard?.profile || {};
  const goal = data.goal || "Full Stack Developer";
  const level = data.level || "Beginner";
  const focus = data.focus || "Job ready skills";
  const field = profile.field || profile.branch || assessmentFieldFromGoal(goal);
  const projectExperience = data.projects || "0 projects";

  return {
    userId: String(currentUser._id || currentUser.id || "guest-roadmap-user"),
    careerGoal: goal,
    currentLevel: level,
    targetTimelineWeeks: assessmentTimelineWeeks(data.timeline || "3 months"),
    weeklyAvailabilityHours: assessmentWeeklyHours(data.hours || "6-8 hours"),
    learningStyle: data.learningStyle || "Mixed learning",
    preferredLanguage: "English",
    background: {
      educationLevel: "undergraduate",
      fieldOfStudy: field,
      workExperience: projectExperience.includes("0") ? "none" : "student projects"
    },
    skills: {
      known: [focus].filter(Boolean),
      weak: ["DSA", "Backend APIs", "Interview confidence"],
      target: [goal, focus, "Portfolio projects"].filter(Boolean)
    },
    constraints: {
      budget: "free",
      deviceAccess: "laptop",
      internetAccess: "stable"
    },
    preferences: {
      includeProjects: true,
      includePracticeTasks: true,
      includeFreeResources: true,
      includeInterviewPrep: true
    }
  };
}

const manualRoadmapDomains = {
  "Full Stack Developer": {
    short: "Full Stack",
    foundations: ["Web foundations", "JavaScript fundamentals", "Frontend structure"],
    intermediate: ["React apps", "Node.js APIs", "MongoDB data models"],
    advanced: ["System design basics", "Authentication and scaling", "Production deployment"],
    projects: ["Portfolio website", "Full stack dashboard", "Production-ready capstone"]
  },
  "AI/ML Engineer": {
    short: "AI/ML",
    foundations: ["Python fundamentals", "Math for ML", "Data handling"],
    intermediate: ["Machine learning models", "Data preprocessing", "Model evaluation"],
    advanced: ["Deep learning basics", "MLOps workflow", "AI portfolio project"],
    projects: ["Prediction model", "Computer vision mini project", "Model deployment demo"]
  },
  "Data Analyst": {
    short: "Data Analyst",
    foundations: ["Excel analytics", "SQL fundamentals", "Data cleaning"],
    intermediate: ["Python analysis", "Statistics basics", "Dashboard building"],
    advanced: ["Business case studies", "Advanced SQL", "BI portfolio"],
    projects: ["Sales dashboard", "Customer analysis", "Business insights report"]
  },
  "Cybersecurity": {
    short: "Cybersecurity",
    foundations: ["Networking basics", "Linux essentials", "Security fundamentals"],
    intermediate: ["Web security", "Threat analysis", "Hands-on labs"],
    advanced: ["Ethical hacking workflow", "Incident response", "Security portfolio"],
    projects: ["Network audit", "Web vulnerability report", "Security lab documentation"]
  },
  "UI/UX Designer": {
    short: "UI/UX",
    foundations: ["Design principles", "Figma basics", "User research"],
    intermediate: ["Wireframes", "Design systems", "Usability testing"],
    advanced: ["Product case studies", "Prototype polish", "Portfolio storytelling"],
    projects: ["Mobile app redesign", "SaaS dashboard design", "UX case study"]
  },
  "Web Development": {
    short: "Web Dev",
    foundations: ["HTML and CSS", "Responsive layouts", "JavaScript basics"],
    intermediate: ["Modern frontend", "API integration", "Web project workflow"],
    advanced: ["Performance", "Accessibility", "Deployment"],
    projects: ["Landing page", "Interactive web app", "Responsive portfolio"]
  }
};

const advancedDurationWeeksByGoal = {
  "Full Stack Developer": 24,
  "AI/ML Engineer": 36,
  "Data Analyst": 20,
  "Cybersecurity": 36,
  "UI/UX Designer": 16,
  "Web Development": 20
};

const recommendedTimelineByGoal = {
  "Full Stack Developer": { beginner: "6 months", intermediate: "3 months", advanced: "6 months" },
  "AI/ML Engineer": { beginner: "12 months", intermediate: "6 months", advanced: "9 months" },
  "Data Analyst": { beginner: "6 months", intermediate: "3 months", advanced: "5 months" },
  "Cybersecurity": { beginner: "12 months", intermediate: "6 months", advanced: "9 months" },
  "UI/UX Designer": { beginner: "6 months", intermediate: "3 months", advanced: "4 months" },
  "Web Development": { beginner: "6 months", intermediate: "3 months", advanced: "5 months" }
};

function normalizedAssessmentLevel(level = "Beginner") {
  const clean = String(level).toLowerCase();
  if (clean.includes("advanced")) return "advanced";
  if (clean.includes("intermediate") || clean.includes("basic")) return "intermediate";
  return "beginner";
}

function timelineMonths(label = "3 months") {
  if (String(label).includes("12")) return 12;
  if (String(label).includes("6")) return 6;
  if (String(label).includes("1")) return 1;
  return 3;
}

function weeklyLoadDetails(hours = "6-8 hours") {
  if (String(hours).includes("3-5")) return { label: "Light", multiplier: 1.25, tasks: 2, note: "lighter weekly tasks with extra revision buffer" };
  if (String(hours).includes("15")) return { label: "Intensive", multiplier: 0.72, tasks: 5, note: "faster progress with a higher weekly workload" };
  if (String(hours).includes("9-12")) return { label: "Focused", multiplier: 0.88, tasks: 4, note: "focused weekly practice and project work" };
  return { label: "Balanced", multiplier: 1, tasks: 3, note: "balanced weekly lessons, practice and projects" };
}

function recommendedTimelineFor(goal, levelKey) {
  return recommendedTimelineByGoal[goal]?.[levelKey] || recommendedTimelineByGoal[goal]?.beginner || "3 months";
}

function adjustedWeeks(data, levelKey) {
  const goal = data.goal || "Full Stack Developer";
  if (levelKey === "advanced") return advancedDurationWeeksByGoal[goal] || 24;

  const chosenWeeks = assessmentTimelineWeeks(data.timeline || recommendedTimelineFor(goal, levelKey));
  const load = weeklyLoadDetails(data.hours || "6-8 hours");
  return Math.max(4, Math.round(chosenWeeks * load.multiplier));
}

function roadmapStagesFor(domain, cardLevel, focus, projects) {
  const foundation = domain.foundations || [];
  const middle = cardLevel === "beginner" ? domain.foundations : domain.intermediate;
  const final = cardLevel === "advanced" ? domain.advanced : domain.projects;
  const optionalFocus = focus || "Job-ready skills";
  const projectBase = projects || "0 projects";
  return [
    foundation[0] || "Foundation setup",
    middle[1] || middle[0] || "Guided practice",
    final[2] || final[0] || "Portfolio project",
    `${optionalFocus} and ${projectBase} level polish`
  ];
}

function createManualRoadmapCard(data, card = {}) {
  const goal = data.goal || "Full Stack Developer";
  const levelKey = card.levelKey || normalizedAssessmentLevel(data.level);
  const domain = manualRoadmapDomains[goal] || manualRoadmapDomains["Full Stack Developer"];
  const load = weeklyLoadDetails(data.hours || "6-8 hours");
  const recommendedTimeline = recommendedTimelineFor(goal, levelKey);
  const chosenTimeline = levelKey === "advanced" ? recommendedTimeline : data.timeline || recommendedTimeline;
  const weeks = adjustedWeeks({ ...data, goal }, levelKey);
  const focus = data.focus || "Job-ready skills";
  const learningStyle = data.learningStyle || "Mixed learning";
  const stages = roadmapStagesFor(domain, levelKey, focus, data.projects);
  const levelLabel = levelKey.charAt(0).toUpperCase() + levelKey.slice(1);
  const intensity = levelKey === "advanced" ? "fixed advanced duration" : chosenTimeline === recommendedTimeline ? "recommended pace" : "custom pace";

  return {
    title: `${goal} ${levelLabel} Roadmap`,
    careerGoal: goal,
    summary: `${levelLabel} ${domain.short} plan with ${load.label.toLowerCase()} workload. Estimated finish: ${weeks} weeks at ${data.hours || "6-8 hours"}/week (${intensity}).`,
    estimatedDurationWeeks: weeks,
    difficulty: levelKey,
    status: card.locked ? "locked" : "draft",
    generatedBy: "manual",
    version: 1,
    generatedAt: new Date().toISOString(),
    recommendedTimeline,
    selectedTimeline: chosenTimeline,
    weeklyLoad: load.label,
    locked: Boolean(card.locked),
    optional: Boolean(card.optional),
    recommended: Boolean(card.recommended),
    lockReason: card.locked ? "Advanced roadmap unlocks after completing intermediate milestones." : "",
    trackLabel: card.label || levelLabel,
    weeks: stages.map((title, index) => ({
      weekId: `manual_${levelKey}_${index + 1}`,
      weekNumber: index + 1,
      title,
      description: `${title} for ${goal} using ${learningStyle.toLowerCase()} and ${load.note}.`,
      estimatedHours: Math.max(4, assessmentWeeklyHours(data.hours || "6-8 hours")),
      tasks: Array.from({ length: Math.min(load.tasks, 3) }, (_, taskIndex) => ({
        taskId: `task_${index + 1}_${taskIndex + 1}`,
        title: `${title} task ${taskIndex + 1}`,
        description: `Complete practical work for ${title.toLowerCase()} in the ${goal} track.`,
        type: taskIndex === 2 ? "project" : "learning",
        estimatedTimeMinutes: 60
      })),
      resources: [{
        resourceId: `resource_${index + 1}`,
        title: `${domain.short} learning resource`,
        url: "https://developer.mozilla.org/",
        type: "documentation"
      }]
    })),
    localPreview: true
  };
}

function buildManualRoadmaps(data = assessmentFormData()) {
  const levelKey = normalizedAssessmentLevel(data.level || "Beginner");
  if (levelKey === "beginner") {
    return [createManualRoadmapCard(data, { levelKey: "beginner", label: "Beginner", recommended: true })];
  }
  if (levelKey === "advanced") {
    return [createManualRoadmapCard(data, { levelKey: "advanced", label: "Advanced", recommended: true })];
  }
  return [
    createManualRoadmapCard(data, { levelKey: "beginner", label: "Beginner Refresh", optional: true }),
    createManualRoadmapCard(data, { levelKey: "intermediate", label: "Intermediate", recommended: true }),
    createManualRoadmapCard(data, { levelKey: "advanced", label: "Advanced", locked: true })
  ];
}

function buildFallbackRoadmaps(data = assessmentFormData()) {
  return buildManualRoadmaps(data);
}

async function requestRoadmapOptions(_payload, data) {
  return { roadmaps: buildManualRoadmaps(data), manual: true };
}
function handleChooseRoadmapSignup(event) {
  const card = event.target.closest("[data-action='choose-roadmap-signup']");
  if (!card) return;

  const index = Number(card.dataset.roadmapIndex || 0);
  const roadmap = functionalState.generatedRoadmaps[index];

  if (roadmap) {
    localStorage.setItem(pendingRoadmapKey, JSON.stringify({
      selectedAt: new Date().toISOString(),
      roadmap,
      assessment: assessmentInputPayload(assessmentFormData())
    }));
  }

  toast("Roadmap selected. Create your account to save it.");
  setRoute("signup");
}

function handleAssessmentOptionChange(event) {
  const form = event.currentTarget.closest("[data-form='roadmap-assessment']");
  syncAssessmentAnswer(form);
  if (assessmentStep < assessmentQuestions.length - 1) {
    assessmentStep = Math.min(assessmentQuestions.length - 1, assessmentStep + 1);
    renderAssessmentScreen();
  }
}

function handleAssessmentNext(event) {
  const form = event.currentTarget.closest("[data-form='roadmap-assessment']");
  if (!validateAssessmentStep(form)) return;
  assessmentStep = Math.min(assessmentQuestions.length - 1, assessmentStep + 1);
  renderAssessmentScreen();
}

function handleAssessmentPrev(event) {
  const form = event.currentTarget.closest("[data-form='roadmap-assessment']");
  if (form) syncAssessmentAnswer(form);
  if ((functionalState.generatedRoadmaps || []).length) functionalState.generatedRoadmaps = [];
  assessmentStep = Math.max(0, assessmentStep - 1);
  renderAssessmentScreen();
}

function handleRoadmapPreview(event) {
  functionalState.previewRoadmapIndex = Number(event.currentTarget.dataset.roadmapIndex || 0);
  renderAssessmentScreen();
}

async function handleChooseRoadmap(event) {
  if (pendingRoadmapSelection) return;
  const selectedRoadmap = (functionalState.generatedRoadmaps || [])[functionalState.previewRoadmapIndex || 0];
  if (!selectedRoadmap) {
    toast("Please preview a roadmap before choosing.");
    return;
  }

  pendingRoadmapSelection = true;
  event.currentTarget.disabled = true;
  event.currentTarget.textContent = "Saving...";

  const result = await api("/roadmaps/select", {
    method: "POST",
    body: JSON.stringify({ roadmap: selectedRoadmap, assessment: assessmentInputPayload(assessmentFormData()) }),
  });

  pendingRoadmapSelection = false;
  if (!result?.roadmap) {
    renderAssessmentScreen();
    return;
  }

  functionalState.roadmaps = [
    result.roadmap,
    ...(functionalState.roadmaps || []).filter((roadmap) => dataId(roadmap) !== dataId(result.roadmap)),
  ];
  functionalState.generatedRoadmaps = [];
  functionalState.previewRoadmapIndex = 0;
  functionalState.dashboard = null;

  toast(result.message || "Roadmap selected successfully.");
  setRoute("dashboard");
}

async function handleRoadmapAssessmentSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!validateRequiredAssessmentAnswers(form)) return;
  const data = assessmentFormData();
  await generateRoadmapsFromAssessment(data, form);
}

async function generateRoadmapsFromAssessment(data, form = null) {
  if (pendingRoadmapGeneration) return false;
  pendingRoadmapGeneration = true;
  functionalState.generatedRoadmaps = [];
  renderAssessmentScreen();

  try {
    const result = await requestRoadmapOptions(null, data);
    functionalState.generatedRoadmaps = (result?.roadmaps || buildFallbackRoadmaps(data)).slice(0, 3);
    functionalState.previewRoadmapIndex = 0;
    clearPendingAssessment();
    toast(result?.manual ? "Your roadmap is ready." : result?.fallback ? "Starter roadmap options are ready." : "Roadmap options received.");
    return true;
  } catch (error) {
    console.error("Roadmap generation failed", error);
    functionalState.generatedRoadmaps = buildFallbackRoadmaps(data).slice(0, 3);
    toast("Your roadmap is ready.");
    return true;
  } finally {
    pendingRoadmapGeneration = false;
    renderAssessmentScreen();
  }
}

async function resumePendingRoadmapGeneration() {
  const pending = getPendingAssessment();
  if (!pending?.data) return false;
  restorePendingAssessment(pending);
  return await generateRoadmapsFromAssessment(pending.data);
}

async function savePendingRoadmapAfterAuth() {
  const pending = getPendingRoadmap();
  if (!pending?.roadmap) return false;

  const result = await api("/roadmaps/select", {
    method: "POST",
    body: JSON.stringify({
      roadmap: pending.roadmap,
      assessment: pending.assessment || {},
    }),
  });

  if (!result?.roadmap) {
    toast(userFriendlyApiError(result?.message || "Roadmap save failed. Please try again."));
    return false;
  }

  clearPendingRoadmap();
  functionalState.roadmaps = [
    result.roadmap,
    ...(functionalState.roadmaps || []).filter((roadmap) => dataId(roadmap) !== dataId(result.roadmap)),
  ];
  functionalState.generatedRoadmaps = [];
  functionalState.previewRoadmapIndex = 0;
  functionalState.dashboard = null;
  toast(result.message || "Roadmap saved successfully.");
  setRoute("dashboard");
  return true;
}

async function handleFunctionalTestSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const answers = Object.entries(values).map(([key, selected]) => ({ question: key.replace("q_", ""), selected }));
  const result = await api(`/tests/${form.dataset.testId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers, timeTakenMinutes: 12 }),
  });
  functionalState.latestResult = result;
  functionalState.testSession = null;
  toast(`Test submitted. Score: ${result?.score || 0}/100`);
  await render();
}

async function handleResumeScan(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const ats = await api("/resume/ats-score", { method: "POST", body: JSON.stringify(data) });
  functionalState.ats = ats;
  await api("/resume", {
    method: "POST",
    body: JSON.stringify({
      targetRole: data.targetRole,
      atsScore: ats?.score || 0,
      analysis: ats?.suggestions || [],
      sections: { summary: data.resumeText, skills: data.resumeText.split(/,|\\n/).map((item) => item.trim()).filter(Boolean).slice(0, 12) },
    }),
  });
  toast(`ATS score updated: ${ats?.score || 0}`);
  await render();
}

async function handleProjectAdd(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  await api("/projects", {
    method: "POST",
    body: JSON.stringify({
      title: data.title,
      description: data.description,
      skills: (data.skills || "").split(",").map((item) => item.trim()).filter(Boolean),
      status: "Published",
      views: 0,
      likes: 0,
      featured: false,
    }),
  });
  toast("Project added.");
  await render();
}

async function handleProfileSave(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const payload = {
    ...data,
    skills: (data.skills || "").split(",").map((item) => item.trim()).filter(Boolean),
    profileCompletion: Math.min(100, 35 + (data.bio ? 20 : 0) + (data.college ? 20 : 0) + ((data.skills || "").split(",").filter(Boolean).length * 5)),
  };
  const saved = await api("/profile", { method: "PUT", body: JSON.stringify(payload) });
  currentUser = {
    ...currentUser,
    name: data.name || currentUser.name,
    email: data.email || currentUser.email,
    avatar: (data.name || currentUser.name).split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase(),
  };
  localStorage.setItem("studox-user", JSON.stringify(currentUser));
  toast(saved ? "Profile saved." : "Profile save failed.");
  await render();
}

async function handleSettingsSave(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const payload = {
    theme: data.theme,
    accentColor: data.accentColor,
    language: data.language,
    studyPreferences: {
      dailyReminders: Boolean(data.pref_0),
      weeklyTests: Boolean(data.pref_1),
      dsaChallenges: Boolean(data.pref_2),
      internshipRecommendations: Boolean(data.pref_3),
    },
    notifications: {
      email: Boolean(data.note_0),
      push: Boolean(data.note_1),
      mentor: Boolean(data.note_2),
      career: Boolean(data.note_3),
    },
  };
  await api("/settings", { method: "PUT", body: JSON.stringify(payload) });
  applyTheme(data.theme || "light");
  toast("Settings saved.");
  await render();
}

async function handleAdminAdd(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const resource = normalizeAdminResource(adminResource);
  const status = data.status || (resource === "notifications" ? "Draft" : "Live");
  await api(`/admin/${resource}`, {
    method: "POST",
    body: JSON.stringify({
      title: data.title,
      name: data.title,
      status,
      owner: "Studox Admin",
      description: resource === "notifications" ? "Announcement created from admin panel" : "Created from admin panel",
      type: resource === "notifications" ? "announcement" : resource,
      read: false,
    }),
  });
  toast(resource === "notifications" ? "Announcement saved." : "Admin item added.");
  await render();
}

async function handleAdminEdit(event) {
  const id = event.currentTarget.dataset.adminId;
  if (!id) {
    toast("This row cannot be edited because it has no saved id.");
    return;
  }
  const row = functionalState.adminRows.find((item) => String(dataId(item)) === String(id));
  const currentTitle = row?.title || row?.name || row?.email || "";
  const nextTitle = window.prompt("Update title / name", currentTitle);
  if (!nextTitle || nextTitle.trim() === currentTitle) return;
  const resource = normalizeAdminResource(adminResource);
  await api(`/admin/${resource}/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      title: nextTitle.trim(),
      name: nextTitle.trim(),
      updatedAt: new Date().toISOString(),
    }),
  });
  toast("Admin item updated.");
  await render();
}

async function handleAdminDelete(event) {
  const id = event.currentTarget.dataset.adminId;
  if (!id) {
    toast("This row cannot be deleted because it has no saved id.");
    return;
  }
  if (!window.confirm("Delete this admin item? This uses the existing admin CRUD delete action.")) return;
  await api(`/admin/${normalizeAdminResource(adminResource)}/${id}`, { method: "DELETE" });
  toast("Admin item deleted.");
  await render();
}

routeMap.dashboard = function beastDashboardPage() {
  const data = functionalState.dashboard || {};
  const liveCourses = data.recommendedCourses || functionalState.courses || [];
  const liveTests = data.upcomingTests || [];
  return appLayout(`<section class="dashboard-beast-panel">
      <div class="beast-copy">
        <span class="ai-pill">AI STUDENT COMMAND CENTER</span>
        <h1>Learn Smarter. <span>Achieve Bigger.</span></h1>
        <p>Every click changes your real progress: tests, DSA, projects, internships, hackathons, resume and mentor chats.</p>
        <div class="hero-actions">
          <a class="btn primary beast-glow" href="#courses">Start Learning Now ${icon("plus")}</a>
          <a class="btn" href="#tests">Take Weekly Test ${icon("test")}</a>
        </div>
      </div>
      <div class="beast-stage dashboard-stage">
        <div class="orb-field"></div>
        <div class="float-badge cap">${icon("book")}</div>
        <div class="float-badge bars">${icon("chart")}</div>
        <div class="float-badge target">${icon("trophy")}</div>
        ${animatedStudent()}
      </div>
      <aside class="learning-stack">
        ${learningOverviewCard(data)}
        <div class="mentor-blue-card">
          <div>
            <h3>AI Mentor</h3>
            <p>${data.recentActivity?.[0]?.title || "Ask for roadmap, DSA, resume or career help."}</p>
            <a class="btn dark" href="#mentor">Chat Now</a>
          </div>
          <div class="mini-bot"><span></span></div>
        </div>
      </aside>
    </section>
    <section class="showcase-feature-rail dashboard-rail">
      ${[
        ["Tests", `${data.testsCompleted || 0} completed`, "test"],
        ["DSA Practice", `${data.dsa?.problemsSolved || 0} solved`, "code"],
        ["Projects", `${data.projectCount || 0} saved`, "briefcase"],
        ["Internships", `${data.applications || 0} applied`, "trophy"],
        ["Certificates", `${data.certificatesEarned || 0} earned`, "star"],
      ].map(([title, text, iconName]) => `<article><span>${icon(iconName)}</span><div><h3>${title}</h3><p>${text}</p></div></article>`).join("")}
    </section>
    <section class="showcase-bottom-grid dashboard-bottom">
      <div class="panel premium-list-panel">
        <div class="panel-head"><h2>Recommended Courses</h2><a href="#courses">View All</a></div>
        <div class="mini-course-row">${liveCourses.slice(0, 5).map((course, index) => miniCourseCard(course, index)).join("")}</div>
      </div>
      <div class="panel premium-list-panel">
        <div class="panel-head"><h2>Upcoming Tests</h2><a href="#tests">Start</a></div>
        <div class="list">${liveTests.slice(0, 3).map((item) => `<div class="test-mini"><span>${icon("test")}</span><div><h4>${item.title}</h4><p>${cleanDate(item.scheduledAt)} - ${item.durationMinutes || 45} min</p></div></div>`).join("")}</div>
      </div>
      <div class="panel achievement-mini">
        <div class="trophy-burst">${icon("trophy")}<i></i><i></i><i></i><i></i></div>
        <h3>Beast Mode Active</h3>
        <p>XP ${Number(data.xpPoints || 0).toLocaleString()} - streak ${data.studyStreak || 0} days.</p>
        <a class="btn primary" href="#dsa">Solve DSA</a>
      </div>
    </section>`, "dashboard");
};

function animatedStudent() {
  return `<div class="student-scene">
    <div class="student-shadow"></div>
    <div class="plant"><span></span><span></span><span></span></div>
    <div class="book-stack"><span></span><span></span><span></span></div>
    <div class="cup"></div>
    <div class="student">
      <div class="hair"></div>
      <div class="face"><span class="eye left"></span><span class="eye right"></span><span class="smile"></span></div>
      <div class="hoodie"><span class="hoodie-logo">S</span><span class="draw left"></span><span class="draw right"></span></div>
      <div class="arm left"></div><div class="arm right"></div>
    </div>
    <div class="laptop"><span>S</span></div>
  </div>`;
}

function learningOverviewCard(data) {
  const progressValue = Math.max(0, Math.min(100, Number(data.overallProgress || 75)));
  return `<div class="learning-card">
    <div class="panel-head"><h3>Your Learning Overview</h3><a href="#dashboard">View All</a></div>
    <div class="overview-main">
      <div><span>Overall Progress</span><strong>${progressValue}%</strong></div>
      <svg viewBox="0 0 120 58" aria-hidden="true"><path d="M8 45 C22 35, 28 42, 39 29 S58 31, 66 20 S85 18, 94 10 S108 18, 114 6" /></svg>
    </div>
    <div class="mini-progress" style="--value:${progressValue}%"><span></span></div>
    <div class="learning-metrics">
      <div><span>Courses Enrolled</span><strong>${data.projectCount || 12}</strong>${icon("book")}</div>
      <div><span>Tests Completed</span><strong>${data.testsCompleted || 24}</strong>${icon("test")}</div>
      <div><span>Streak</span><strong>${data.studyStreak || 12} days</strong>${icon("trophy")}</div>
      <div><span>Skills Mastered</span><strong>${data.skillsMastered || 16}</strong>${icon("star")}</div>
    </div>
  </div>`;
}

function miniCourseCard(course, index) {
  const colors = ["blue", "green", "amber", "purple", "cyan"];
  const title = course.title || "Course";
  const desc = course.category || course.level || "Beginner to Advanced";
  const value = course.progress || [75, 60, 80, 65, 50][index] || 45;
  return `<article class="mini-course-card">
    <span class="course-icon ${colors[index % colors.length]}">${icon(["code", "book", "bot", "admin", "chart"][index % 5])}</span>
    <h3>${title}</h3>
    <p>${desc}</p>
    <div class="mini-progress" style="--value:${value}%"><span></span></div>
    <small>${value}%</small>
  </article>`;
}

routeMap.dashboard = function properStudentDashboardPage() {
  const data = functionalState.dashboard || {};
  const roadmap = data.roadmap || {};
  const hasActiveRoadmap = Boolean(data.hasActiveRoadmap);
  const roadmapWeeks = roadmap.weeks || roadmap.modules || [];
  const roadmapTitle = hasActiveRoadmap ? roadmap.title || "Roadmap" : "No roadmap selected yet";
  const roadmapSummary = hasActiveRoadmap
    ? roadmap.summary || "Your selected roadmap is ready. Continue from the next milestone."
    : "Create your personalized roadmap from the assessment to unlock your dashboard plan.";
  const nextMilestone = hasActiveRoadmap ? roadmap.nextMilestone || roadmapWeeks[0]?.title || "Open roadmap path" : "Create your roadmap";
  const primaryCtaLabel = hasActiveRoadmap ? "Continue Roadmap" : "Create Roadmap";
  const primaryCtaHref = hasActiveRoadmap ? "#roadmap" : "#assessment";
  const liveCourses = data.recommendedCourses || [];
  const liveTests = data.upcomingTests || [];
  const activity = data.recentActivity || [];
  const progressValue = hasActiveRoadmap ? Math.max(0, Math.min(100, Number(data.overallProgress || 0))) : 0;
  const firstName = currentUser.name.split(" ")[0] || "Student";
  const focusScore = Math.min(100, Math.round(progressValue + Math.min(24, (data.studyStreak || 0) * 2)));
  const readinessScore = Math.min(100, Math.round(progressValue / 2 + (data.projectCount || 0) * 6 + (data.certificatesEarned || 0) * 4));
  const weeklyMomentum = Math.min(100, Math.round((data.testsCompleted || 0) * 5 + (data.dsa?.problemsSolved || 0) / 8));
  const stats = [
    ["Overall Progress", progressValue, "%", "chart", "Roadmap"],
    ["Tests Completed", data.testsCompleted || 0, "", "test", "Saved"],
    ["Roadmap Weeks", hasActiveRoadmap ? roadmapWeeks.length : 0, "", "map", "Modules"],
    ["Duration", hasActiveRoadmap ? roadmap.estimatedDurationWeeks || 0 : 0, "w", "trophy", "Estimated"],
  ];

  return appLayout(`<section class="proper-dashboard premium-dashboard">
    <div class="dashboard-aurora" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="dash-welcome-card command-hero">
      <div>
        <span class="ai-pill">AI STUDENT COMMAND CENTER</span>
        <h1>Welcome back, ${firstName}</h1>
        <p>${roadmapSummary}</p>
        <div class="hero-actions">
          <a class="btn primary beast-glow" href="${primaryCtaHref}" ${hasActiveRoadmap ? "" : "data-action=\"start-assessment\""}>${primaryCtaLabel}</a>
          <a class="btn" href="#tests">Start Test</a>
          <a class="btn" href="#dsa">Solve DSA</a>
        </div>
      </div>
      <div class="dash-orbit-card" style="--percent:${progressValue}" aria-label="Animated progress orb">
        <div class="dash-orbit">
          <span></span><span></span><span></span>
          <strong>${progressValue}%</strong>
        </div>
        <p>Roadmap progress</p>
      </div>
    </div>

    <div class="dashboard-command-deck">
      <a class="command-card primary" href="${primaryCtaHref}" ${hasActiveRoadmap ? "" : "data-action=\"start-assessment\""}>
        <span>${icon("map")}</span>
        <div><strong>${roadmapTitle}</strong><small>${nextMilestone}</small></div>
        <b>${progressValue}%</b>
      </a>
      <a class="command-card" href="#tests">
        <span>${icon("test")}</span>
        <div><strong>Weekly Test</strong><small>${liveTests[0]?.title || "React Weekly"} ready</small></div>
        <b>${data.testsCompleted || 0}</b>
      </a>
      <a class="command-card" href="#mentor">
        <span>${icon("bot")}</span>
        <div><strong>AI Mentor</strong><small>Doubts, resume and career help</small></div>
        <b>${focusScore}</b>
      </a>
    </div>

    ${statCards(stats)}

    <div class="momentum-strip">
      <div><span>Focus Score</span><strong>${focusScore}%</strong><i style="--value:${focusScore}%"></i></div>
      <div><span>Career Readiness</span><strong>${readinessScore}%</strong><i style="--value:${readinessScore}%"></i></div>
      <div><span>Weekly Momentum</span><strong>${weeklyMomentum}%</strong><i style="--value:${weeklyMomentum}%"></i></div>
      <div><span>Study Streak</span><strong>${data.studyStreak || 0} days</strong><i style="--value:${Math.min(100, (data.studyStreak || 0) * 7)}%"></i></div>
    </div>

    <div class="proper-dashboard-grid">
      <article class="panel performance-card">
        <div class="panel-head"><h2>Performance Overview</h2><span class="chip purple">Live</span></div>
        ${barChart([
          progressValue || 10,
          Math.min(100, (data.testsCompleted || 0) * 12),
          Math.min(100, (data.dsa?.problemsSolved || 0) / 4),
          Math.min(100, (data.projectCount || 0) * 24),
          Math.min(100, (data.applications || 0) * 32),
          Math.min(100, (data.hackathonRegistrations || 0) * 36),
          Math.min(100, (data.studyStreak || 0) * 5),
        ], ["Progress", "Tests", "DSA", "Projects", "Apps", "Hacks", "Streak"])}
      </article>

      <article class="panel mission-control-card">
        <div class="panel-head"><h2>Mission Control</h2><span class="chip green">Animated</span></div>
        <div class="dashboard-pulse-map" aria-label="Learning signal map">
          <span class="pulse-core">${icon("logo")}</span>
          <i class="signal-ring ring-a"></i>
          <i class="signal-ring ring-b"></i>
          <a class="signal-node node-a" href="#courses">${icon("book")}<small>Courses</small></a>
          <a class="signal-node node-b" href="#dsa">${icon("code")}<small>DSA</small></a>
          <a class="signal-node node-c" href="#projects">${icon("briefcase")}<small>Projects</small></a>
          <a class="signal-node node-d" href="#mentor">${icon("bot")}<small>Mentor</small></a>
        </div>
      </article>

      <article class="panel focus-card">
        <div class="panel-head"><h2>Today's Focus</h2><span class="chip green">${data.studyStreak || 0} day streak</span></div>
        <div class="focus-list">
          <a href="#courses">${icon("book")} Finish one course module <span>+40 XP</span></a>
          <a href="#tests">${icon("test")} Submit weekly test <span>Score report</span></a>
          <a href="#resume">${icon("resume")} Scan resume ATS <span>Career ready</span></a>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head"><h2>Learning Overview</h2><a href="#roadmap">Roadmap</a></div>
        <div class="compact-progress-ring" style="--percent:${progressValue}" data-label="${progressValue}%"></div>
        ${progress("Roadmap", progressValue)}
        ${progress("DSA consistency", Math.min(100, (data.studyStreak || 0) * 5))}
      </article>

      <article class="panel">
        <div class="panel-head"><h2>Upcoming Tests</h2><a href="#tests">Start</a></div>
        <div class="list">${liveTests.slice(0, 4).map((item) => `<div class="test-mini"><span>${icon("test")}</span><div><h4>${item.title}</h4><p>${cleanDate(item.scheduledAt)} - ${item.durationMinutes || 45} min</p></div></div>`).join("") || emptyState("No tests", "Admin se tests add karo.")}</div>
      </article>

      <article class="panel course-dashboard-panel">
        <div class="panel-head"><h2>Recommended Courses</h2><a href="#courses">View All</a></div>
        <div class="dashboard-course-list">${liveCourses.slice(0, 4).map((course, index) => `<a href="#courses" class="dashboard-course-item"><span class="course-icon ${["blue", "green", "amber", "purple"][index % 4]}">${icon(["code", "book", "bot", "chart"][index % 4])}</span><div><h3>${course.title}</h3><p>${course.category || course.level || "Course"} - ${course.progress || 0}% complete</p></div><strong>${course.progress || 0}%</strong></a>`).join("")}</div>
      </article>

      <article class="panel mentor-dashboard-card">
        <div>
          <span class="ai-pill">AI MENTOR</span>
          <h2>Need help?</h2>
          <p>Ask roadmap, DSA, resume or career questions. Your conversations are saved.</p>
          <a class="btn dark" href="#mentor">Chat Now</a>
        </div>
        <div class="mini-bot"><span></span></div>
      </article>

      <article class="panel activity-dashboard-panel">
        <div class="panel-head"><h2>Recent Activity</h2></div>
        <div class="list">${activity.slice(0, 5).map((item) => `<div class="list-item"><div><h4>${item.title}</h4><p>${cleanDate(item.time)}</p></div><span class="chip purple">${item.type}</span></div>`).join("")}</div>
      </article>
    </div>
  </section>`, "dashboard");
};

const protectedRoutes = new Set([
  "dashboard",
  "roadmap",
  "courses",
  "tests",
  "dsa",
  "resume",
  "projects",
  "internships",
  "hackathons",
  "certificates",
  "mentor",
  "profile",
  "settings",
  "admin",
]);

routeMap.login = () => authPage("login");
routeMap.signup = () => authPage("signup");
routeMap.reset = () => authResetPage();

loginForm = function configuredLoginForm() {
  return `<h2>Login to <span>Studox.ai</span></h2>
  <p class="muted">Learn. Practice. Grow. Achieve.</p>
  <form class="form-grid" data-form="login" novalidate>
    <div class="field"><label>Email or phone</label><input name="email" autocomplete="username" placeholder="you@example.com" required /></div>
    <div class="field password-field"><label>Password</label><input name="password" autocomplete="current-password" type="password" placeholder="Enter password" required minlength="8" /><button type="button" class="btn icon ghost" data-password-toggle>${icon("eye")}</button></div>
    <div class="form-row"><label><input name="remember" type="checkbox" checked /> Remember me</label><a href="#reset">Forgot password?</a></div>
    <button class="btn primary glow auth-submit" type="submit">Login ${icon("arrow-right")}</button>
    <div class="form-feedback" data-auth-feedback></div>
  </form>
  <div class="secure-note">${icon("lock")} Secure JWT login connected to Studox.ai backend.</div>
  <p class="muted" style="text-align:center;margin-top:18px">New here? <a href="#signup" style="color:var(--blue);font-weight:800">Create an account</a></p>`;
};

signupForm = function configuredSignupForm() {
  return `<h2>Personal Information</h2>
  <p class="muted">Tell us about yourself</p>
  <div class="stepper">
    <div class="step active"><span></span>Personal Info</div>
    <div class="step active"><span></span>Security</div>
    <div class="step"><span></span>Preferences</div>
  </div>
  <form class="form-grid" data-form="signup" novalidate>
    <div class="field"><label>Full name</label><input name="name" autocomplete="name" placeholder="Your full name" required /></div>
    <div class="two-column">
      <div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" placeholder="you@example.com" required /></div>
      <div class="field"><label>Phone</label><input name="phone" autocomplete="tel" placeholder="+91 98765 43210" required /></div>
    </div>
    <div class="two-column">
      <div class="field password-field"><label>Password</label><input name="password" type="password" autocomplete="new-password" placeholder="Minimum 8 characters" required minlength="8" /><button type="button" class="btn icon ghost" data-password-toggle>${icon("eye")}</button></div>
      <div class="field password-field"><label>Confirm password</label><input name="confirmPassword" type="password" autocomplete="new-password" placeholder="Repeat password" required minlength="8" /><button type="button" class="btn icon ghost" data-password-toggle>${icon("eye")}</button></div>
    </div>
    <label class="secure-note auth-check"><input name="terms" type="checkbox" required /> I agree to Studox.ai learning data and privacy settings.</label>
    <button class="btn primary glow auth-submit" type="submit">Next Step ${icon("arrow-right")}</button>
    <div class="form-feedback" data-auth-feedback></div>
  </form>
  <p class="muted" style="text-align:center;margin-top:18px">Already have an account? <a href="#login" style="color:var(--blue);font-weight:800">Login</a></p>`;
};

function authResetPage() {
  return `<main class="auth-page view">
    <section class="auth-grid">
      <aside class="auth-left">
        ${brand()}
        <div class="auth-visual-card">
          <span class="eyebrow">${icon("lock")} Account Recovery</span>
          <h1>Reset Password</h1>
          <p>Request an OTP on your registered email, enter it below, and create a new secure password.</p>
        </div>
        <div class="auth-features">
          <div class="auth-feature"><strong>Email OTP</strong><span>OTP will arrive in your inbox.</span></div>
          <div class="auth-feature"><strong>Secure Reset</strong><span>OTP expires automatically.</span></div>
        </div>
      </aside>
      <section class="auth-panel">
        <h2>Recover Account</h2>
        <p class="muted">Use your registered email address.</p>
        <form class="form-grid" data-form="otp-request" novalidate>
          <div class="field"><label>Email</label><input name="email" type="email" placeholder="you@example.com" required /></div>
          <button class="btn" type="submit">Send OTP</button>
        </form>
        <div class="divider">then</div>
        <form class="form-grid" data-form="password-reset" novalidate>
          <div class="field"><label>Email</label><input name="email" type="email" placeholder="you@example.com" required /></div>
          <div class="field"><label>OTP</label><input name="otp" inputmode="numeric" placeholder="Enter 6-digit OTP" required /></div>
          <div class="field password-field"><label>New password</label><input name="password" type="password" autocomplete="new-password" placeholder="Minimum 8 characters" minlength="8" required /><button type="button" class="btn icon ghost" data-password-toggle>${icon("eye")}</button></div>
          <button class="btn primary glow" type="submit">Reset Password</button>
          <div class="form-feedback" data-auth-feedback></div>
        </form>
        <p class="muted" style="text-align:center;margin-top:18px"><a href="#login" style="color:var(--blue);font-weight:800">Back to login</a></p>
      </section>
    </section>
  </main>`;
}

render = async function configuredRender() {
  if (!firebaseAuthReady) {
    app.innerHTML = loadingView(getRoute());
    await waitForFirebaseAuth();
  }
  const requestedRoute = routeMap[getRoute()] ? getRoute() : "landing";
  if (isAppComingSoonRoute(requestedRoute)) {
    showAppComingSoonModal(requestedRoute);
    window.location.hash = hasDemoSession() ? "dashboard" : "landing";
    return;
  }
  const route = requestedRoute;
  if (protectedRoutes.has(route) && !hasDemoSession()) {
    setRoute("landing");
    return;
  }
  if (route === "admin" && !isAdminUser()) {
    toast("Admin access is internal only.");
    setRoute("dashboard");
    return;
  }
  app.innerHTML = loadingView(route);
  await loadFunctionalData(route);
  app.innerHTML = routeMap[route]();
  bindPage();
  animateCounters();
  if (route === "counselling") scrollAssessmentToTop();
};

handleLogin = async function configuredHandleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = form.querySelector("[data-auth-feedback]");
  const data = Object.fromEntries(new FormData(form));
  if (!data.email || !data.password) return showAuthFeedback(feedback, "Email and password are required.", true);
  setFormBusy(form, true);
  try {
    let result = null;
    const firebase = await getFirebaseBridge();
    if (firebase) {
      try {
        const credential = await firebase.signInWithEmailAndPassword(data.email, data.password);
        firebaseCurrentUser = credential.user;
        const token = await credential.user.getIdToken();
        result = await authRequest("/auth/firebase", null, token);
      } catch (error) {
        console.warn("Firebase login skipped, falling back to Studox JWT auth.", error.message);
      }
    }
    if (!result?.ok || !result.token) {
      result = await authRequest("/auth/login", { email: data.email, password: data.password });
    }
    if (!result?.ok || !result.token) return showAuthFeedback(feedback, result?.message || "Login failed.", true);
    saveAuthSession(result);
    if (await savePendingRoadmapAfterAuth()) return;
    if (await resumePendingRoadmapGeneration()) return;
    setRoute("dashboard");
  } catch (error) {
    return showAuthFeedback(feedback, error.message || "Login failed.", true);
  } finally {
    setFormBusy(form, false);
  }
};

handleSignup = async function configuredHandleSignup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = form.querySelector("[data-auth-feedback]");
  const data = Object.fromEntries(new FormData(form));
  if (!data.name || !data.email || !data.password) return showAuthFeedback(feedback, "Name, email and password are required.", true);
  if (data.password.length < 8) return showAuthFeedback(feedback, "Password must be at least 8 characters.", true);
  if (data.password !== data.confirmPassword) return showAuthFeedback(feedback, "Password and confirm password do not match.", true);
  if (!data.terms) return showAuthFeedback(feedback, "Please accept the privacy settings to continue.", true);
  setFormBusy(form, true);
  try {
    let result = null;
    const firebase = await getFirebaseBridge();
    if (firebase) {
      try {
        const credential = await firebase.createUserWithEmailAndPassword(data.email, data.password);
        await firebase.updateProfile(credential.user, { displayName: data.name });
        firebaseCurrentUser = credential.user;
        const token = await credential.user.getIdToken(true);
        result = await authRequest("/auth/firebase", null, token);
      } catch (error) {
        console.warn("Firebase signup skipped, falling back to Studox JWT auth.", error.message);
      }
    }
    if (!result?.ok || !result.token) {
      result = await authRequest("/auth/signup", {
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password
      });
    }
    if (!result?.ok || !result.token) return showAuthFeedback(feedback, result?.message || "Signup failed.", true);
    saveAuthSession(result);
    localStorage.setItem("studox-jarvis-welcome-pending", "true");
    localStorage.removeItem("studox-jarvis-welcome-seen");
    if (await savePendingRoadmapAfterAuth()) return;
    setRoute("dashboard");
  } catch (error) {
    return showAuthFeedback(feedback, error.message || "Signup failed.", true);
  } finally {
    setFormBusy(form, false);
  }
};

async function authRequest(path, payload, bearerToken = "") {
  try {
    const res = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    return res.ok ? { ok: true, ...data } : { ok: false, ...data };
  } catch (_error) {
    return { ok: false, message: "Server connection failed. Please check backend is running." };
  }
}

function saveAuthSession(result, goal) {
  localStorage.removeItem("demoSession");
  if (result.token) localStorage.setItem("studox-token", result.token);
  else localStorage.removeItem("studox-token");
  localStorage.setItem("studox-auth-provider", result.token ? "jwt" : "firebase");
  const user = result.user || {};
  currentUser = {
    ...currentUser,
    name: user.name || currentUser.name,
    email: user.email || currentUser.email,
    goal: goal || currentUser.goal,
    plan: user.plan || currentUser.plan || "free",
    role: user.role || currentUser.role || "student",
    avatar: (user.name || currentUser.name)
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  };
  localStorage.setItem("studox-plan", currentUser.plan || "free");
  localStorage.setItem("studox-user", JSON.stringify(currentUser));
}

function handleCheckoutPlan(event) {
  event.preventDefault();
  const plan = event.currentTarget.dataset.plan;
  if (!plan) return;
  if (getCurrentPlan() === plan) {
    toast(`${plan === "elite" ? "Elite" : "Pro"} is already active.`);
    return;
  }
  localStorage.setItem("studox-checkout-plan", plan);
  setRoute("payment");
}


function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector("script[data-razorpay-checkout]");
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

function openRazorpayCheckout(order, plan) {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) return reject(new Error("Razorpay checkout could not load."));
    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency || "INR",
      name: "Studox.ai",
      description: `${order.planName || plan} monthly plan`,
      order_id: order.orderId,
      prefill: {
        name: order.prefill?.name || currentUser.name || "Studox Student",
        email: order.prefill?.email || currentUser.email || "",
      },
      theme: { color: "#4f46e5" },
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
    });
    checkout.open();
  });
}
async function handlePlanUpgrade(event) {
  event.preventDefault();
  const form = event.currentTarget.closest("[data-form='payment-checkout']") || event.currentTarget;
  const plan = form?.dataset.plan || event.currentTarget.dataset.plan || localStorage.getItem("studox-checkout-plan");
  if (!plan) return;
  if (getCurrentPlan() === plan) {
    toast(`${plan === "elite" ? "Elite" : "Pro"} is already active.`);
    return;
  }
  if (form?.reportValidity && !form.reportValidity()) return;
  const button = form?.querySelector?.("button[type='submit']") || event.currentTarget;
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Opening secure payment...";

  const checkoutLoaded = await loadRazorpayCheckout();
  if (!checkoutLoaded) {
    button.disabled = false;
    button.textContent = originalText;
    return toast("Razorpay checkout could not load. Please check internet connection.");
  }

  const order = await api("/payments/create-order", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });

  if (!order?.orderId || !order?.keyId) {
    button.disabled = false;
    button.textContent = originalText;
    return toast(order?.message || "Payment order could not be created.");
  }

  try {
    const paymentResponse = await openRazorpayCheckout(order, plan);
    button.textContent = "Verifying payment...";
    const result = await api("/payments/verify", {
      method: "POST",
      body: JSON.stringify({ plan, ...paymentResponse }),
    });
    button.disabled = false;
    button.textContent = originalText;
    if (!result?.plan) return toast(result?.message || "Payment verification failed.");
    currentUser = { ...currentUser, ...(result.user || {}), plan: result.plan };
    localStorage.setItem("studox-plan", result.plan);
    localStorage.setItem("studox-user", JSON.stringify(currentUser));
    localStorage.removeItem("studox-checkout-plan");
    showPremiumSuccessModal(result.plan);
    window.setTimeout(() => setRoute("dashboard"), 1800);
  } catch (error) {
    button.disabled = false;
    button.textContent = originalText;
    toast(error.message || "Payment was not completed.");
  }
}

function showPremiumSuccessModal(plan = getCurrentPlan()) {
  document.querySelector(".premium-success-backdrop")?.remove();
  const label = String(plan).toLowerCase() === "elite" ? "Elite" : "Premium";
  document.body.insertAdjacentHTML("beforeend", `<div class="premium-success-backdrop">
    <section class="premium-success-modal">
      <div class="premium-success-icon">${icon("trophy")}</div>
      <span>${label} activated</span>
      <h2>Payment successful</h2>
      <p>Your Studox.ai ${label} access is active now. Opening your upgraded dashboard...</p>
      <div class="premium-success-loader"><i></i></div>
    </section>
  </div>`);
  window.setTimeout(() => document.querySelector(".premium-success-backdrop")?.remove(), 1750);
}
function showAuthFeedback(node, message, isError) {
  if (!node) {
    toast(message);
    return;
  }
  node.textContent = message;
  node.className = `form-feedback ${isError ? "error" : "success"}`;
}

function setFormBusy(form, busy) {
  form.querySelectorAll("button, input, select").forEach((node) => {
    node.disabled = busy;
  });
}

const authAwareBindPage = bindPage;
bindPage = function configuredBindPage() {
  authAwareBindPage();
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      const nextTheme = isDarkTheme() ? "light" : "dark";
      applyTheme(nextTheme);
      const settingsSelect = document.querySelector("[name='theme']");
      if (settingsSelect) settingsSelect.value = nextTheme;
      toast(`${nextTheme === "dark" ? "Dark" : "Light"} mode enabled.`);
      await api("/settings", { method: "PUT", body: JSON.stringify({ theme: nextTheme }) });
      await render();
    });
  });
  document.querySelectorAll("a[href='#login'], a[href='#signup']").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setRoute(link.getAttribute("href").slice(1));
    });
  });
  document.querySelectorAll("[data-form='otp-request']").forEach((form) => form.addEventListener("submit", handleOtpRequest));
  document.querySelectorAll("[data-form='password-reset']").forEach((form) => form.addEventListener("submit", handlePasswordReset));
  document.querySelectorAll("[data-action='checkout-plan']").forEach((button) => button.addEventListener("click", handleCheckoutPlan));
  document.querySelectorAll("[data-form='payment-checkout']").forEach((form) => form.addEventListener("submit", handlePlanUpgrade));
  document.querySelectorAll("[data-action='open-upgrade']").forEach((link) => {
    document.querySelectorAll("[data-mentor-suggestion]").forEach((button) => {
  button.addEventListener("click", () => {
    const form = document.querySelector("[data-form='chat']");
    const input = form?.querySelector("input[name='message']");

    if (!form || !input) return;

    input.value = button.dataset.mentorSuggestion;
    form.requestSubmit();
  });
});
    link.addEventListener("click", (event) => {
      event.preventDefault();
      setRoute("pricing");
    });
  });
};

async function handleOtpRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  if (!data.email) return toast("Email is required.");
  setFormBusy(form, true);
  const result = await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: data.email }) });
  setFormBusy(form, false);
  if (!result) return;
  const resetForm = document.querySelector("[data-form='password-reset']");
  if (resetForm) resetForm.email.value = data.email;
  toast(result?.message || "OTP sent to your email. Check inbox or spam.");
}

async function handlePasswordReset(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = form.querySelector("[data-auth-feedback]");
  const data = Object.fromEntries(new FormData(form));
  if (!data.email || !data.otp || !data.password) return showAuthFeedback(feedback, "Email, OTP and new password are required.", true);
  if (data.password.length < 8) return showAuthFeedback(feedback, "Password must be at least 8 characters.", true);
  setFormBusy(form, true);
  const result = await api("/auth/reset-password", { method: "POST", body: JSON.stringify(data) });
  setFormBusy(form, false);
  if (!result) return showAuthFeedback(feedback, "Password reset failed.", true);
  showAuthFeedback(feedback, "Password reset successful. Please login.", false);
  toast(result.message || "Password reset successful.");
  window.setTimeout(() => setRoute("login"), 900);
}

authPage = function cinematicAuthPage(type) {
  const isLogin = type === "login";
  if (isLogin) {
    return `<main class="cinematic-auth cinematic-login view dark-login-refresh">
      <div class="auth-sky"><span></span><span></span><span></span><span></span></div>
      <section class="login-frame">
        <header class="cinematic-auth-head">
          ${brand()}
          <a href="#landing" class="language-pill">${icon("home")} Home</a>
        </header>
        <div class="login-main-grid">
          <div class="login-content">
            <span class="login-dark-kicker">${icon("bot")} AI student cockpit</span>
            <h1>Welcome Back!</h1>
            <p>Login to continue your roadmap, courses, practice streak and AI mentor support.</p>
            <div class="cinematic-login-card dark-login-card">
              ${loginForm()}
            </div>
          </div>
          <div class="cinematic-hero-visual dark-login-visual">
            <div class="neon-ring"></div>
            <div class="scan-orbit orbit-a"></div>
            <div class="scan-orbit orbit-b"></div>
            <div class="floating-ui-card card-a">${icon("book")}</div>
            <div class="floating-ui-card card-b">${icon("code")}</div>
            <div class="floating-ui-card card-c">${icon("chart")}</div>
            <div class="login-status-panel">
              <strong>Roadmap active</strong>
              <span>3 tasks ready today</span>
            </div>
            ${cinematicStudent("boy")}
          </div>
        </div>
        <div class="cinematic-feature-dock dark-login-dock">
          ${[
            ["Personalized Roadmap", "map"],
            ["Progress Tracking", "chart"],
            ["AI Mentor", "bot"],
            ["Career Ready", "trophy"],
          ].map(([label, iconName]) => `<article><span>${icon(iconName)}</span><strong>${label}</strong></article>`).join("")}
        </div>
      </section>
    </main>`;
  }
  return `<main class="cinematic-auth cinematic-signup view">
    <div class="auth-sky"><span></span><span></span><span></span><span></span></div>
    <section class="signup-frame">
      <header class="signup-topline">
        ${brand()}
        <p>Already have an account? <a href="#login">Login</a></p>
      </header>
      <div class="signup-title">
        <h1>Create Your <span>Account</span></h1>
        <p>Start your journey towards success</p>
      </div>
      <div class="cinematic-stepper">
        <div class="active"><span>1</span><strong>Personal Info</strong></div>
        <div><span>2</span><strong>Security</strong></div>
        <div><span>3</span><strong>Preferences</strong></div>
      </div>
      <div class="signup-glass-card">
        <aside class="signup-illustration">
          <div class="signup-doodles"><i></i><i></i><i></i></div>
          ${cinematicStudent("girl")}
          <h2>One Step Closer<br />To Your <span>Dreams</span></h2>
          <ul>
            <li>Personalized Roadmaps</li>
            <li>Expert Guidance</li>
            <li>Hands-on Practice</li>
            <li>Real-time Progress Tracking</li>
          </ul>
        </aside>
        <section class="signup-form-panel">
          ${signupForm()}
        </section>
      </div>
      <div class="signup-secure-note">${icon("lock")} <strong>Your data is secure with us</strong><span>We respect your privacy and protect your information.</span></div>
    </section>
  </main>`;
};

routeMap.login = () => authPage("login");
routeMap.signup = () => authPage("signup");

function cinematicStudent(kind) {
  const girl = kind === "girl";
  return `<div class="cinematic-student ${girl ? "girl" : "boy"}">
    <div class="cinematic-shadow"></div>
    <div class="cinematic-head">
      <span class="cinematic-hair"></span>
      <span class="cinematic-face"><i></i><i></i><b></b></span>
    </div>
    <div class="cinematic-body"><span>S</span></div>
    <div class="cinematic-arm left"></div>
    <div class="cinematic-arm right"></div>
    <div class="cinematic-laptop"><span>Studox.ai</span></div>
  </div>`;
}

window.addEventListener("hashchange", () => {
  render();
});
