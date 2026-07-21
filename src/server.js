require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
const connectDatabase = require("./config/db");
const models = require("./models");
const mockData = require("./data/mockData");

const {
  User,
  StudentProfile,
  Roadmap,
  Course,
  Module: CourseModule,
  Test,
  Question,
  TestResult,
  DSAProgress,
  Resume,
  Project,
  Internship,
  Hackathon,
  Certificate,
  AIMentorChat,
  Notification,
  UserSettings,
  Admin,
} = models;

const app = express();
const port = process.env.PORT || 4000;
const storePath = path.join(__dirname, "data", "runtime-store.json");
const mentorFreeChatLimit = Number(process.env.MENTOR_FREE_CHAT_LIMIT || 10);
const mentorLimitTemporarilyDisabled = true;
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || "";
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
const paymentPlans = {
  pro: { name: "Pro", amount: 35300 },
  elite: { name: "Elite", amount: 70700 },
};
const memory = loadMemoryStore();

const resourceMap = {
  users: { model: User, key: "users" },
  profiles: { model: StudentProfile, key: "profiles" },
  roadmaps: { model: Roadmap, key: "roadmaps" },
  courses: { model: Course, key: "courses" },
  modules: { model: CourseModule, key: "modules" },
  tests: { model: Test, key: "tests" },
  questions: { model: Question, key: "questions" },
  "test-results": { model: TestResult, key: "testResults" },
  dsa: { model: DSAProgress, key: "dsaProgress" },
  resumes: { model: Resume, key: "resumes" },
  projects: { model: Project, key: "projects" },
  internships: { model: Internship, key: "internships" },
  hackathons: { model: Hackathon, key: "hackathons" },
  certificates: { model: Certificate, key: "certificates" },
  "ai-mentor": { model: AIMentorChat, key: "chats" },
  notifications: { model: Notification, key: "notifications" },
  settings: { model: UserSettings, key: "settings" },
  admins: { model: Admin, key: "admins" },
  reports: { model: null, key: "reports" },
  content: { model: null, key: "content" },
  "mentor-prompts": { model: null, key: "content" },
};

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.static(path.join(__dirname, "..", "public")));

function loadMemoryStore() {
  try {
    if (fs.existsSync(storePath)) {
      return JSON.parse(fs.readFileSync(storePath, "utf8"));
    }
  } catch (error) {
    console.warn("Could not read runtime store. Using bundled demo data.");
    console.warn(error.message);
  }
  return JSON.parse(JSON.stringify(mockData));
}

function persistMemory() {
  if (mongoReady()) return;
  try {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(memory, null, 2));
  } catch (error) {
    console.warn("Could not persist runtime store.");
    console.warn(error.message);
  }
}

function mongoReady() {
  return mongoose.connection.readyState === 1;
}

function publicUser(user) {
  if (!user) return null;
  const raw = user.toObject ? user.toObject() : user;
  const { password, resetOtp, resetOtpExpires, ...safe } = raw;
  return safe;
}

async function resolveFirebaseAuthUser(token) {
  let firebase;
  try {
    firebase = require("./config/firebaseAdmin");
  } catch (_error) {
    return null;
  }

  const firebaseApp = firebase.initializeFirebaseAdmin();
  if (!firebaseApp) return null;

  const decoded = await firebase.admin.auth().verifyIdToken(token);
  const user = await syncFirebaseUser(decoded);
  if (!user) return null;
  return {
    id: String(user._id || user.id),
    email: user.email,
    role: user.role || "student",
    firebaseUid: user.firebaseUid,
  };
}

async function syncFirebaseUser(decoded) {
  const firebaseUid = decoded.uid;
  const email = normalizeEmail(decoded.email);
  const name = decoded.name || decoded.displayName || (email ? email.split("@")[0] : "Studox Student");
  const photoURL = decoded.picture || "";
  const now = new Date();

  if (!firebaseUid) return null;
  if (!email) return null;

  let user;
  if (mongoReady()) {
    // Firebase UID is the canonical identity. Always prefer it before any legacy email migration path.
    user = await User.findOne({ firebaseUid });
    if (!user) {
      const legacyUser = await User.findOne({ email });
      if (legacyUser) {
        // TODO (Migration):
        // This email-linking path exists only to migrate legacy users.
        // After all users have migrated to Firebase Authentication,
        // remove this logic entirely.
        user = await User.findByIdAndUpdate(
          legacyUser._id,
          {
            $set: {
              firebaseUid,
              name: legacyUser.name || name,
              photoURL: photoURL || legacyUser.photoURL,
              status: legacyUser.status || "pending",
            },
          },
          { new: true },
        );
      }
    }
    if (!user) {
      user = await User.create({ firebaseUid, email, name, photoURL, role: "student", status: "pending", plan: "free" });
    }

    const updates = {
      lastLoginAt: now,
      email,
      name: user.name || name,
      photoURL: photoURL || user.photoURL,
    };
    // TEMPORARY DEVELOPMENT FLOW:
    // Email verification is not enforced yet, so pending Firebase users become active after login.
    if (user.status === "pending") {
      updates.status = "active";
      if (!user.verifiedAt) updates.verifiedAt = now;
    }
    user = await User.findByIdAndUpdate(user._id, { $set: updates }, { new: true });

    await StudentProfile.findOneAndUpdate(
      { user: user._id },
      {
        $setOnInsert: {
          user: user._id,
          username: email.split("@")[0],
          skills: [],
          level: "Beginner",
          xp: 0,
          profileCompletion: 0,
          streak: 0,
        },
      },
      { upsert: true, new: true },
    );
    await UserSettings.findOneAndUpdate(
      { user: user._id },
      { $setOnInsert: { user: user._id } },
      { upsert: true, new: true },
    );
    return user;
  }

  user = memory.users.find((item) => item.firebaseUid === firebaseUid);
  if (!user) {
    const legacyUser = memory.users.find((item) => item.email === email);
    if (legacyUser) {
      user = legacyUser;
      user.firebaseUid = firebaseUid;
      user.name = user.name || name;
      user.photoURL = photoURL || user.photoURL;
      user.status = user.status || "pending";
    }
  }
  if (!user) {
    user = { id: memoryId("user"), firebaseUid, name, email, photoURL, role: "student", status: "pending", plan: "free" };
    memory.users.push(user);
  }
  user.email = email;
  user.name = user.name || name;
  user.photoURL = photoURL || user.photoURL;
  user.lastLoginAt = now.toISOString();
  // TEMPORARY DEVELOPMENT FLOW:
  // Email verification is not enforced yet, so pending Firebase users become active after login.
  if (user.status === "pending") {
    user.status = "active";
    user.verifiedAt = user.verifiedAt || now.toISOString();
  }

  const userId = user.id || user._id;
  if (!memory.profiles.find((item) => String(item.user) === String(userId))) {
    memory.profiles.push({
      user: userId,
      username: email.split("@")[0],
      skills: [],
      level: "Beginner",
      xp: 0,
      profileCompletion: 0,
      streak: 0,
    });
  }
  if (!memory.settings.find((item) => String(item.user) === String(userId))) {
    memory.settings.push({ user: userId, theme: "system", accentColor: "#2563eb", language: "English" });
  }
  persistMemory();
  return user;
}

async function getFirebaseAuthenticatedMongoUser(token) {
  let firebase;
  try {
    firebase = require("./config/firebaseAdmin");
  } catch (error) {
    error.statusCode = 503;
    error.authCode = "firebase_admin_missing";
    throw error;
  }

  const firebaseApp = firebase.initializeFirebaseAdmin();
  if (!firebaseApp) {
    const error = new Error("Firebase Admin credentials are not configured.");
    error.statusCode = 503;
    error.authCode = "firebase_admin_not_configured";
    throw error;
  }

  // Firebase is verified first because it is the only identity provider in the finalized auth architecture.
  const decoded = await firebase.admin.auth().verifyIdToken(token);
  const firebaseUid = decoded.uid;
  if (!firebaseUid) {
    const error = new Error("Firebase token is missing uid.");
    error.statusCode = 401;
    error.authCode = "missing_firebase_uid";
    throw error;
  }
  if (!mongoReady()) {
    const error = new Error("Database is not connected.");
    error.statusCode = 503;
    error.authCode = "database_unavailable";
    throw error;
  }

  // firebaseUid is canonical. The backend never trusts frontend identity or token role claims.
  const user = await User.findOne({ firebaseUid });
  if (!user) {
    const error = new Error("No Studox account is linked to this Firebase user.");
    error.statusCode = 401;
    error.authCode = "unknown_firebase_uid";
    throw error;
  }

  // TEMPORARY DEVELOPMENT FLOW:
  // Pending users are not blocked until the real email verification flow is implemented.
  if (user.status === "disabled") {
    const error = new Error("Account is disabled.");
    error.statusCode = 403;
    error.authCode = "account_disabled";
    throw error;
  }
  if (user.status === "scheduled_for_deletion") {
    const error = new Error("Account is scheduled for deletion.");
    error.statusCode = 403;
    error.authCode = "account_scheduled_for_deletion";
    throw error;
  }

  // req.user must be the MongoDB user document so role and app status always come from Studox.
  return user;
}

async function authOptional(req, _res, next) {
  const errors = [];
  const token = validateBearerHeader(req, errors, { required: false });
  if (!token) return next();
  try {
    req.user = await resolveFirebaseAuthUser(token);
  } catch (_error) {}
  next();
}

async function authRequired(req, res, next) {
  const errors = [];
  const token = validateBearerHeader(req, errors);
  if (!token && errors.some((error) => error.code === "required")) return res.status(401).json({ message: "Please login to continue." });
  if (errors.length) return validationFailed(res, errors);
  try {
    req.user = await getFirebaseAuthenticatedMongoUser(token);
    return next();
  } catch (error) {
    const status = error.statusCode || 401;
    if (status === 403) return res.status(403).json({ message: error.message });
    if (status === 503) return res.status(503).json({ message: error.message });
    return res.status(401).json({ message: "Session expired. Please login again." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access is internal only." });
  }
  next();
}

function currentUserId(req) {
  return req.user?.id || null;
}

function byUser(list, userId) {
  return (list || []).filter((item) => String(item.user || item.userId || "") === String(userId));
}

function roadmapOwnerQuery(userId) {
  return { $or: [{ user: userId }, { userId }] };
}

function normalizeRoadmapShape(roadmap = {}) {
  const source = roadmap.toObject ? roadmap.toObject() : roadmap;
  const modules = source.modules?.length
    ? source.modules
    : (source.weeks || []).map((week, index) => ({
        title: week.title,
        status: index === 0 ? "in-progress" : "upcoming",
        progress: index === 0 ? Number(source.overallProgress || 0) : 0,
        description: week.description,
        skills: (week.tasks || []).map((task) => task.title).slice(0, 4),
      }));
  const progress = Number(source.overallProgress ?? average(modules.map((module) => module.progress)) ?? 0);
  return {
    ...source,
    user: source.user || source.userId,
    userId: source.userId || source.user,
    title: source.title || `${source.careerGoal || "Career"} Roadmap`,
    currentLevel: source.currentLevel || source.difficulty || "Beginner",
    overallProgress: Math.round(progress),
    timeToGoalWeeks: source.timeToGoalWeeks || source.estimatedDurationWeeks || 12,
    skillsLearned: Number(source.skillsLearned || 0),
    nextMilestone: source.nextMilestone || modules.find((module) => module.status !== "completed")?.title || "Start your first milestone",
    modules,
  };
}


async function activateUserPlan(userId, plan) {
  let user;
  if (mongoReady() && mongoose.isValidObjectId(userId)) {
    user = await User.findByIdAndUpdate(userId, { plan }, { new: true }).lean();
  } else {
    user = memory.users.find((item) => String(item.id || item._id) === String(userId));
    if (user) {
      user.plan = plan;
      persistMemory();
    }
  }
  return user;
}

function razorpayConfigured() {
  return Boolean(razorpayKeyId && razorpayKeySecret);
}

function razorpayAuthHeader() {
  return `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64")}`;
}

async function createRazorpayOrder({ plan, userId }) {
  if (!razorpayConfigured()) {
    const error = new Error("Razorpay keys are not configured.");
    error.status = 503;
    throw error;
  }

  const selectedPlan = paymentPlans[plan];
  if (!selectedPlan) {
    const error = new Error("Please choose a valid premium plan.");
    error.status = 400;
    throw error;
  }

  const receipt = `studox_${plan}_${Date.now()}`.slice(0, 40);
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: razorpayAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: selectedPlan.amount,
      currency: "INR",
      receipt,
      notes: { plan, userId: String(userId), product: "Studox.ai Premium" },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const description = data?.error?.description || "Could not create Razorpay order.";
    const message = /authentication failed/i.test(description) ? "Razorpay authentication failed. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, then restart the server." : description;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const expected = crypto.createHmac("sha256", razorpayKeySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return expected === signature;
}
function isPremiumPlan(plan) {
  return ["pro", "elite"].includes(String(plan || "").toLowerCase());
}

async function getUserPlan(userId) {
  if (mongoReady() && mongoose.isValidObjectId(userId)) {
    const user = await User.findById(userId).select("plan").lean();
    return user?.plan || "free";
  }
  const user = memory.users.find((item) => String(item.id || item._id) === String(userId));
  return user?.plan || "free";
}

async function countMentorChats(userId) {
  if (mongoReady() && mongoose.isValidObjectId(userId)) {
    return AIMentorChat.countDocuments({ user: userId });
  }
  return byUser(memory.chats || [], userId).length;
}

function normalizeGoal(goal = "") {
  const clean = String(goal || "").trim();
  return clean || "Career";
}

function roadmapTemplate(goal = "", field = "") {
  const normalized = `${goal} ${field}`.toLowerCase();
  if (normalized.includes("data") || normalized.includes("machine") || normalized.includes("ml") || normalized.includes("ai")) {
    return {
      title: "Data Science & AI Roadmap",
      timeToGoalWeeks: 24,
      modules: [
        ["Python Foundations", "Learn Python syntax, functions, files, Git and notebooks.", ["Python", "Git", "Jupyter"]],
        ["Math & Statistics", "Build probability, statistics, linear algebra and experiment basics.", ["Statistics", "Probability", "Linear Algebra"]],
        ["Data Analysis", "Use NumPy, Pandas, SQL and visualization for real datasets.", ["NumPy", "Pandas", "SQL", "Visualization"]],
        ["Machine Learning", "Train, evaluate and tune supervised and unsupervised models.", ["Scikit-learn", "Model Evaluation", "Feature Engineering"]],
        ["AI Projects", "Build portfolio projects with datasets, notebooks, APIs and dashboards.", ["Projects", "APIs", "Dashboards"]],
        ["Career Readiness", "Prepare resume, case studies, interview stories and applications.", ["Resume", "Interview", "Portfolio"]],
      ],
    };
  }
  if (normalized.includes("cyber") || normalized.includes("security")) {
    return {
      title: "Cybersecurity Analyst Roadmap",
      timeToGoalWeeks: 22,
      modules: [
        ["Networking Foundations", "Understand TCP/IP, DNS, HTTP, Linux and command-line basics.", ["Networking", "Linux", "HTTP"]],
        ["Security Basics", "Learn CIA triad, threats, controls, IAM and common vulnerabilities.", ["Security Fundamentals", "IAM", "OWASP"]],
        ["Tools & Labs", "Practice Wireshark, Nmap, Burp Suite and basic log analysis.", ["Wireshark", "Nmap", "Burp Suite"]],
        ["Defensive Security", "Work on SIEM basics, incident response and vulnerability management.", ["SIEM", "Incident Response", "Vulnerability Management"]],
        ["Projects & Reports", "Create lab reports, threat writeups and security portfolio proof.", ["Reports", "Labs", "Documentation"]],
        ["Interview Readiness", "Prepare security scenarios, resume keywords and analyst interviews.", ["Resume", "Interview", "Scenarios"]],
      ],
    };
  }
  if (normalized.includes("product")) {
    return {
      title: "Product Engineer Roadmap",
      timeToGoalWeeks: 18,
      modules: [
        ["Programming Foundations", "Strengthen JavaScript, Git, APIs and debugging basics.", ["JavaScript", "Git", "Debugging"]],
        ["Frontend Product UI", "Build responsive, accessible and analytics-ready product screens.", ["React", "UX", "Accessibility"]],
        ["Backend & Data", "Create APIs, auth flows, database models and product events.", ["Node.js", "APIs", "Databases"]],
        ["Product Thinking", "Learn user problems, metrics, funnels, experiments and iteration.", ["Product Metrics", "User Research", "Experiments"]],
        ["Shipping Projects", "Deploy real product features with README, demos and metrics.", ["Deployment", "Projects", "Analytics"]],
        ["Career Readiness", "Prepare portfolio, resume and product engineering interviews.", ["Portfolio", "Resume", "Interview"]],
      ],
    };
  }
  if (normalized.includes("backend")) {
    return {
      title: "Backend Developer Roadmap",
      timeToGoalWeeks: 18,
      modules: [
        ["Programming Foundations", "Strengthen JavaScript, Git, terminal and problem solving.", ["JavaScript", "Git", "CLI"]],
        ["Node.js & Express", "Build REST APIs, middleware, validation and error handling.", ["Node.js", "Express", "REST"]],
        ["Databases", "Model data with MongoDB/SQL, indexes, relations and migrations.", ["MongoDB", "SQL", "Data Modeling"]],
        ["Authentication & Security", "Implement JWT, password hashing, permissions and rate limits.", ["JWT", "Auth", "Security"]],
        ["Testing & Deployment", "Add API tests, logs, monitoring and deploy production services.", ["Testing", "Deployment", "Monitoring"]],
        ["Backend Interviews", "Practice DSA, system design basics and API design questions.", ["DSA", "System Design", "Interview"]],
      ],
    };
  }
  if (normalized.includes("frontend") || normalized.includes("react")) {
    return {
      title: "Frontend Developer Roadmap",
      timeToGoalWeeks: 16,
      modules: [
        ["Web Foundations", "Master HTML, CSS, JavaScript, Git and browser fundamentals.", ["HTML", "CSS", "JavaScript", "Git"]],
        ["Responsive UI", "Build accessible layouts, forms, animations and design systems.", ["Responsive Design", "Accessibility", "CSS"]],
        ["React Core", "Learn components, props, state, effects, routing and forms.", ["React", "Routing", "Forms"]],
        ["API Integration", "Connect APIs, handle loading/errors and manage app state.", ["APIs", "State Management", "Error Handling"]],
        ["Projects & Deployment", "Ship real projects with clean README, demos and hosting.", ["Projects", "Deployment", "Portfolio"]],
        ["Interview Readiness", "Practice JS, React, UI tasks and portfolio walkthroughs.", ["JavaScript", "Interview", "Portfolio"]],
      ],
    };
  }
  return {
    title: "Full Stack Developer Roadmap",
    timeToGoalWeeks: 20,
    modules: [
      ["Web Foundations", "Master HTML, CSS, JavaScript, Git and browser fundamentals.", ["HTML", "CSS", "JavaScript", "Git"]],
      ["Frontend Development", "Build React apps with routing, forms, API calls and polished UI.", ["React", "Routing", "UI Systems"]],
      ["Backend Development", "Create Node.js and Express APIs with validation and error handling.", ["Node.js", "Express", "REST APIs"]],
      ["Databases", "Design MongoDB schemas, relations, indexes and useful queries.", ["MongoDB", "Mongoose", "Data Modeling"]],
      ["Authentication & Security", "Add JWT login, password hashing, roles and protected routes.", ["JWT", "Auth", "Security"]],
      ["Projects & Deployment", "Build, deploy and document portfolio-ready full stack projects.", ["Projects", "Deployment", "Portfolio"]],
      ["Career Readiness", "Prepare resume, GitHub, interview stories and internship applications.", ["Resume", "Interview", "Internships"]],
    ],
  };
}

function buildPersonalRoadmap(goal, field, userId) {
  const cleanGoal = normalizeGoal(goal);
  const template = roadmapTemplate(cleanGoal, field);
  return {
    id: memoryId("roadmap"),
    user: userId,
    userId,
    title: `${cleanGoal} Roadmap`,
    careerGoal: cleanGoal,
    currentLevel: "Beginner",
    overallProgress: 0,
    timeToGoalWeeks: template.timeToGoalWeeks,
    estimatedDurationWeeks: template.timeToGoalWeeks,
    skillsLearned: 0,
    nextMilestone: template.modules[0]?.[0] || "Start foundations",
    status: "active",
    generatedBy: "studox",
    version: 1,
    generatedAt: new Date(),
    modules: template.modules.map(([title, description, skills], index) => ({
      title,
      status: index === 0 ? "in-progress" : "upcoming",
      progress: 0,
      description,
      skills,
    })),
    createdAt: new Date().toISOString(),
  };
}

function roadmapSummary(roadmap = {}) {
  const modules = roadmap.modules || [];
  const completedModules = modules.filter((module) => module.status === "completed" || Number(module.progress || 0) >= 100);
  const activeModule = modules.find((module) => module.status === "in-progress") || modules.find((module) => Number(module.progress || 0) < 100);
  const learnedSkills = new Set(completedModules.flatMap((module) => module.skills || []));
  const progress = modules.length ? Math.round(average(modules.map((module) => Number(module.progress || 0)))) : 0;
  return {
    overallProgress: progress,
    skillsLearned: learnedSkills.size,
    nextMilestone: activeModule?.title || "Roadmap completed",
  };
}

function advanceRoadmapState(roadmap, amount = 8) {
  if (!roadmap) return roadmap;
  const modules = roadmap.modules || [];
  let activeIndex = modules.findIndex((module) => module.status === "in-progress");
  if (activeIndex === -1) activeIndex = modules.findIndex((module) => Number(module.progress || 0) < 100);
  if (activeIndex === -1) return roadmap;
  const activeModule = modules[activeIndex];
  activeModule.status = "in-progress";
  activeModule.progress = Math.min(100, Number(activeModule.progress || 0) + amount);
  if (activeModule.progress >= 100) {
    activeModule.status = "completed";
    const nextModule = modules[activeIndex + 1];
    if (nextModule && nextModule.status !== "completed") nextModule.status = "in-progress";
  }
  const summary = roadmapSummary(roadmap);
  roadmap.overallProgress = summary.overallProgress;
  roadmap.skillsLearned = summary.skillsLearned;
  roadmap.nextMilestone = summary.nextMilestone;
  roadmap.updatedAt = new Date().toISOString();
  return roadmap;
}

function compactMentorText(message = "") {
  return String(message).toLowerCase().trim().replace(/\s+/g, " ");
}

function detectMentorTopic(message = "") {
  const text = compactMentorText(message);
  if (/^(hi|hii+|hello|hey|yo|sup|namaste|namaskar|good morning|good afternoon|good evening|hello bhai|hi bhai)$/.test(text)) return "casual";
  if (/^(kaise ho|kese ho|how are you|how r u|whats up|what's up|kya haal|kya haal hai|aur batao)$/.test(text)) return "casual";
  if (/^(thanks|thank you|thx|shukriya|dhanyawad|ok thanks|okay thanks)$/.test(text)) return "thanks";
  if (text.includes("motivate") || text.includes("motivation") || text.includes("mood") || text.includes("demotivate") || text.includes("tension")) return "motivation";
  if (text.includes("resume") || text.includes("ats")) return "resume";
  if (text.includes("career") || text.includes("internship") || text.includes("job")) return "career";
  if (text.includes("code") || text.includes("bug") || text.includes("error")) return "code";
  if (text.includes("dsa") || text.includes("leetcode") || text.includes("array") || text.includes("tree")) return "dsa";
  if (text.includes("roadmap") || text.includes("course") || text.includes("learn")) return "roadmap";
  if (text.includes("interview")) return "interview";
  return "concept";
}

async function mentorUserContext(userId) {
  if (mongoReady() && mongoose.isValidObjectId(userId)) {
    const user = await User.findById(userId).lean();
    const profile = await StudentProfile.findOne({ user: userId }).lean();
    const roadmap = await Roadmap.findOne(roadmapOwnerQuery(userId)).sort({ updatedAt: -1 }).lean();
    const normalizedRoadmap = normalizeRoadmapShape(roadmap || {});
    return {
      name: user?.name || profile?.username || "there",
      goal: profile?.goal || "career growth",
      field: profile?.field || profile?.branch || "student learning",
      level: profile?.level || normalizedRoadmap.currentLevel || "Beginner",
      skills: profile?.skills || [],
      nextMilestone: normalizedRoadmap.nextMilestone || "finish the next learning milestone",
    };
  }
  const user = (memory.users || []).find((item) => String(item.id || item._id) === String(userId));
  const profile = (memory.profiles || []).find((item) => String(item.user || item.userId) === String(userId));
  const roadmap = (memory.roadmaps || []).find((item) => String(item.user || item.userId) === String(userId));
  return {
    name: user?.name || profile?.username || "there",
    goal: profile?.goal || "career growth",
    field: profile?.field || profile?.branch || "student learning",
    level: profile?.level || roadmap?.currentLevel || "Beginner",
    skills: profile?.skills || [],
    nextMilestone: roadmap?.nextMilestone || "finish the next learning milestone",
  };
}

async function recentMentorMessages(userId) {
  let chats = [];
  if (mongoReady() && mongoose.isValidObjectId(userId)) {
    chats = await AIMentorChat.find({ user: userId }).sort({ createdAt: -1 }).limit(4).lean();
  } else {
    chats = (memory.chats || [])
      .filter((item) => String(item.user || item.userId) === String(userId))
      .slice(0, 4);
  }
  return chats
    .flatMap((chat) => chat.messages || [])
    .slice(-8)
    .map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: String(item.content || "").slice(0, 900) }));
}

function mentorSystemPrompt(context) {
  return [
    "You are Studox.ai AI Mentor, a premium student learning and career mentor.",
    "Give practical, accurate, structured guidance for learning, DSA, projects, resumes, internships, hackathons and interviews.",
    "Keep answers student-friendly, concise and action-oriented.",
    "If the student greets you or wants casual support, respond naturally and personally instead of forcing a study plan.",
    "Match the student's tone and language where reasonable, including simple Hinglish when the student uses it.",
    "When code is useful, include a small code example and explain it.",
    "Never claim to submit applications, certify results or access private accounts.",
    `Student name: ${context.name}.`,
    `Student goal: ${context.goal}. Field: ${context.field}. Level: ${context.level}.`,
    `Known skills: ${(context.skills || []).join(", ") || "not provided"}. Next milestone: ${context.nextMilestone}.`,
  ].join("\n");
}

function localMentorReply(message, context) {
  const topic = detectMentorTopic(message);
  const firstName = String(context.name || "there").split(" ")[0];
  if (topic === "casual") {
    return `Hey ${firstName}! Main yahin hoon. Tum mujhse normal baat bhi kar sakte ho, aur study/career help bhi le sakte ho.\n\nAaj kya karna hai?\n1. Koi concept simple language mein samjhau\n2. DSA problem solve karwaun\n3. Resume ya internship plan banaun\n4. Bas study mood set karne mein help karun`;
  }
  if (topic === "thanks") {
    return `Anytime, ${firstName}. Main tumhare saath hoon. Jab bhi doubt, roadmap, DSA, resume ya career confusion ho, seedha message kar dena.`;
  }
  if (topic === "motivation") {
    return `${firstName}, thoda slow feel hona normal hai. Bas next 25 minutes ka target rakho, poore future ka pressure mat uthao.\n\nAaj ka tiny win:\n1. Ek concept revise karo\n2. Ek small question solve karo\n3. Ek line note likho: "aaj maine kya clear kiya"\n\nMomentum isi tarah banta hai. Batao, abhi tumhara mood low hai ya topic confusing hai?`;
  }
  const base = `Studox.ai Mentor plan for your ${context.goal || "goal"}:\n\n`;
  const topicPlans = {
    resume: [
      "1. Rewrite your summary for one target role.",
      "2. Add measurable project impact: users, speed, accuracy, revenue, rank or score.",
      "3. Match keywords from the internship/job description.",
      "4. Keep ATS format simple: headings, bullets, no heavy graphics.",
      "Next action: paste one resume section and I will rewrite it.",
    ],
    career: [
      "1. Pick one target role for the next 30 days.",
      "2. Finish the roadmap modules that directly map to that role.",
      "3. Publish two proof projects with README, screenshots and deployment links.",
      "4. Apply to 5 matched internships after improving resume score.",
      "Next action: tell me your target role and current skills.",
    ],
    code: [
      "1. Reproduce the bug with the smallest input.",
      "2. Check the exact error line and data shape.",
      "3. Add one guard condition or test before changing logic.",
      "4. Re-run the same failing case, then one normal case.",
      "Next action: paste the error and the function where it happens.",
    ],
    dsa: [
      "1. Identify the pattern first: two pointers, sliding window, stack, BFS/DFS or DP.",
      "2. Write brute force in plain English.",
      "3. Optimize one bottleneck only.",
      "4. Dry-run with 2 examples before coding.",
      "Next action: send the problem statement and your stuck point.",
    ],
    roadmap: [
      "1. Study one concept for 25 minutes.",
      "2. Build one tiny output from it.",
      "3. Solve 3 practice questions.",
      "4. Log one note in your roadmap before moving ahead.",
      `Next milestone: ${context.nextMilestone || "complete the next module"}.`,
    ],
    interview: [
      "1. Prepare a 45-second intro with goal, skills and best project.",
      "2. Practice 5 role-specific technical questions.",
      "3. Prepare STAR stories for teamwork, failure and debugging.",
      "4. Review resume bullets before every mock.",
      "Next action: tell me the company or role and I will run a mock interview.",
    ],
    concept: [
      "1. Start with the simplest definition.",
      "2. Connect it to one real project example.",
      "3. Do one guided example, then one independent practice task.",
      "4. End with a 3-line summary in your own words.",
      "Next action: ask the exact concept you want explained.",
    ],
  };
  return base + (topicPlans[topic] || topicPlans.concept).join("\n");
}

function extractOpenAiText(data) {
  return data?.choices?.[0]?.message?.content?.trim()
    || data?.output_text?.trim()
    || "";
}

async function callOpenAiMentor(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      max_tokens: 5000,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI request failed");
  const reply = extractOpenAiText(data);
  if (!reply) throw new Error("OpenAI returned an empty response");
  return { reply, provider: "openai", model, fallback: false };
}

async function callGeminiMentor(messages) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const prompt = messages.map((item) => `${item.role.toUpperCase()}:\n${item.content}`).join("\n\n");
  const generate = async (text, maxOutputTokens = 6000) => {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { temperature: 0.45, maxOutputTokens },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "Gemini request failed");
    const candidate = data?.candidates?.[0] || {};
    const textReply = (candidate?.content?.parts || []).map((part) => part.text || "").join("").trim();
    return { textReply, finishReason: candidate.finishReason || "" };
  };

  const first = await generate(prompt);
  let reply = first.textReply;
  let finishReason = first.finishReason;

  if (reply && finishReason === "MAX_TOKENS") {
    const continuationPrompt = [
      prompt,
      "\n\nASSISTANT RESPONSE SO FAR:\n",
      reply,
      "\n\nContinue exactly from where the previous answer stopped. Do not restart, do not repeat earlier sections, and finish the remaining explanation clearly.",
    ].join("");
    const second = await generate(continuationPrompt, 4000);
    if (second.textReply) {
      reply = `${reply}\n\n${second.textReply}`;
      finishReason = second.finishReason;
    }
  }

  if (!reply) throw new Error("Gemini returned an empty response");
  return { reply, provider: "gemini", model, fallback: false, finishReason };
}

async function generateMentorReply(message, userId) {
  const context = await mentorUserContext(userId);
  const history = await recentMentorMessages(userId);
  const messages = [
    { role: "system", content: mentorSystemPrompt(context) },
    ...history,
    { role: "user", content: message },
  ];
  const provider = String(process.env.AI_PROVIDER || "").toLowerCase();
  try {
    if (provider === "gemini") return await callGeminiMentor(messages);
    if (provider === "openai" || process.env.OPENAI_API_KEY) return await callOpenAiMentor(messages);
    if (process.env.GEMINI_API_KEY) return await callGeminiMentor(messages);
  } catch (error) {
    console.warn(`AI mentor provider failed: ${error.message}`);
  }
  return {
    reply: localMentorReply(message, context),
    provider: "local",
    model: "studox-local-mentor",
    fallback: true,
  };
}

function roadmapInputErrors(input) {
  const errors = [];
  const requiredStrings = ["userId", "careerGoal", "currentLevel", "learningStyle", "preferredLanguage"];
  requiredStrings.forEach((field) => {
    if (!input[field] || typeof input[field] !== "string") errors.push(`${field} is required.`);
  });
  ["targetTimelineWeeks", "weeklyAvailabilityHours"].forEach((field) => {
    if (typeof input[field] !== "number" || !Number.isFinite(input[field]) || input[field] <= 0) errors.push(`${field} must be a positive number.`);
  });
  if (!input.background || typeof input.background !== "object") errors.push("background is required.");
  else ["educationLevel", "fieldOfStudy", "workExperience"].forEach((field) => {
    if (!input.background[field] || typeof input.background[field] !== "string") errors.push(`background.${field} is required.`);
  });
  if (!input.skills || typeof input.skills !== "object") errors.push("skills is required.");
  else ["known", "weak", "target"].forEach((field) => {
    if (!Array.isArray(input.skills[field])) errors.push(`skills.${field} must be an array.`);
  });
  if (!input.constraints || typeof input.constraints !== "object") errors.push("constraints is required.");
  else ["budget", "deviceAccess", "internetAccess"].forEach((field) => {
    if (!input.constraints[field] || typeof input.constraints[field] !== "string") errors.push(`constraints.${field} is required.`);
  });
  if (!input.preferences || typeof input.preferences !== "object") errors.push("preferences is required.");
  else ["includeProjects", "includePracticeTasks", "includeFreeResources", "includeInterviewPrep"].forEach((field) => {
    if (typeof input.preferences[field] !== "boolean") errors.push(`preferences.${field} must be a boolean.`);
  });
  return errors;
}

function roadmapOutputErrors(roadmap, index) {
  const prefix = `roadmaps.${index}`;
  const errors = [];
  const requiredStrings = ["userId", "title", "careerGoal", "summary", "difficulty", "status", "generatedBy", "generatedAt"];
  requiredStrings.forEach((field) => {
    if (!roadmap[field] || typeof roadmap[field] !== "string") errors.push(`${prefix}.${field} is required.`);
  });
  ["estimatedDurationWeeks", "version"].forEach((field) => {
    if (typeof roadmap[field] !== "number" || !Number.isFinite(roadmap[field])) errors.push(`${prefix}.${field} must be a number.`);
  });
  if (!Array.isArray(roadmap.weeks) || !roadmap.weeks.length) errors.push(`${prefix}.weeks must be a non-empty array.`);
  (roadmap.weeks || []).forEach((week, weekIndex) => {
    const weekPrefix = `${prefix}.weeks.${weekIndex}`;
    ["weekId", "title", "description"].forEach((field) => {
      if (!week[field] || typeof week[field] !== "string") errors.push(`${weekPrefix}.${field} is required.`);
    });
    ["weekNumber", "estimatedHours"].forEach((field) => {
      if (typeof week[field] !== "number" || !Number.isFinite(week[field])) errors.push(`${weekPrefix}.${field} must be a number.`);
    });
    if (!Array.isArray(week.tasks) || !week.tasks.length) errors.push(`${weekPrefix}.tasks must be a non-empty array.`);
    (week.tasks || []).forEach((task, taskIndex) => {
      const taskPrefix = `${weekPrefix}.tasks.${taskIndex}`;
      ["taskId", "title", "description", "type"].forEach((field) => {
        if (!task[field] || typeof task[field] !== "string") errors.push(`${taskPrefix}.${field} is required.`);
      });
      if (typeof task.estimatedTimeMinutes !== "number" || !Number.isFinite(task.estimatedTimeMinutes)) errors.push(`${taskPrefix}.estimatedTimeMinutes must be a number.`);
    });
    if (!Array.isArray(week.resources) || !week.resources.length) errors.push(`${weekPrefix}.resources must be a non-empty array.`);
    (week.resources || []).forEach((resource, resourceIndex) => {
      const resourcePrefix = `${weekPrefix}.resources.${resourceIndex}`;
      ["resourceId", "title", "url", "type"].forEach((field) => {
        if (!resource[field] || typeof resource[field] !== "string") errors.push(`${resourcePrefix}.${field} is required.`);
      });
    });
  });
  return errors;
}

function roadmapOptionErrors(roadmap, index) {
  const prefix = `roadmaps.${index}`;
  const errors = [];
  ["title", "careerGoal", "summary", "difficulty"].forEach((field) => {
    if (!roadmap[field] || typeof roadmap[field] !== "string") errors.push(`${prefix}.${field} is required.`);
  });
  if (typeof roadmap.estimatedDurationWeeks !== "number" || !Number.isFinite(roadmap.estimatedDurationWeeks)) {
    errors.push(`${prefix}.estimatedDurationWeeks must be a number.`);
  }
  if (!Array.isArray(roadmap.weeks) || !roadmap.weeks.length) errors.push(`${prefix}.weeks must be a non-empty array.`);
  (roadmap.weeks || []).forEach((week, weekIndex) => {
    const weekPrefix = `${prefix}.weeks.${weekIndex}`;
    if (typeof week.weekNumber !== "number" || !Number.isFinite(week.weekNumber)) errors.push(`${weekPrefix}.weekNumber must be a number.`);
    if (!week.title || typeof week.title !== "string") errors.push(`${weekPrefix}.title is required.`);
  });
  return errors;
}

function extractJsonArray(text) {
  const clean = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(clean);
  } catch (_error) {
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) throw _error;
    return JSON.parse(clean.slice(start, end + 1));
  }
}

function extractJsonObject(text) {
  const clean = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(clean);
  } catch (_error) {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw _error;
    return JSON.parse(clean.slice(start, end + 1));
  }
}

function roadmapOptionsPrompt(input) {
  return `You are an expert career roadmap generator for Studox.ai.

Use the following INPUT_CONTRACT data to generate personalized roadmap strategies:

${JSON.stringify(input, null, 2)}

Return only valid JSON.
Do not return markdown.
Do not include explanations.
Do not include comments.
Do not include text before or after the JSON.

The response must be a JSON array containing exactly 3 lightweight roadmap option objects.

Each option must include only this structure:

[
 {
  "title": "string",
  "careerGoal": "string",
  "summary": "string",
  "estimatedDurationWeeks": "number",
  "difficulty": "string",
  "weeks": [
    {
      "weekNumber": "number",
      "title": "string"
    }
  ]
 }
]

Generate exactly three different roadmap strategies:
1. A fast-track roadmap.
2. A balanced roadmap.
3. A project-heavy roadmap.

Rules:
- Use the same careerGoal from INPUT_CONTRACT.
- estimatedDurationWeeks must be realistic based on targetTimelineWeeks.
- weeks must contain high-level week titles only.
- Do not include tasks.
- Do not include resources.
- Do not include generatedAt, generatedBy, version, status, userId, descriptions, IDs, or extra fields.`;
}

function completeRoadmapPrompt(input, selectedRoadmap) {
  return `You are an expert career roadmap generator for Studox.ai.

Use the INPUT_CONTRACT and selected lightweight roadmap option to generate one complete roadmap.

INPUT_CONTRACT:
${JSON.stringify(input, null, 2)}

SELECTED_ROADMAP_OPTION:
${JSON.stringify(selectedRoadmap, null, 2)}

Return only valid JSON.
Do not return markdown.
Do not include explanations.
Do not include comments.
Do not include text before or after the JSON.

Return exactly one JSON object matching this ROADMAP_CONTRACT:

{
  "userId": "string",
  "title": "string",
  "careerGoal": "string",
  "summary": "string",
  "estimatedDurationWeeks": "number",
  "difficulty": "string",
  "status": "string",
  "generatedBy": "string",
  "version": "number",
  "generatedAt": "ISO date string",
  "weeks": [
    {
      "weekId": "string",
      "weekNumber": "number",
      "title": "string",
      "description": "string",
      "estimatedHours": "number",
      "tasks": [
        {
          "taskId": "string",
          "title": "string",
          "description": "string",
          "type": "string",
          "estimatedTimeMinutes": "number"
        }
      ],
      "resources": [
        {
          "resourceId": "string",
          "title": "string",
          "url": "string",
          "type": "string"
        }
      ]
    }
  ]
}

Rules:
- Use the same userId from INPUT_CONTRACT.
- Use the selected title, careerGoal, summary, estimatedDurationWeeks and difficulty.
- Set generatedBy to "ai".
- Set version to 1.
- Set status to "draft".
- generatedAt must be a valid ISO date string.
- Expand the selected high-level weeks into complete weeks.
- Keep each week concise: 2 tasks and 1 resource per week.
- Tasks must be practical, specific, and actionable.
- Resources must be real learning resources with valid URLs.
- Prefer free or official documentation resources when possible.
- Do not invent fake domains.
- Do not include fields outside ROADMAP_CONTRACT.`;
}

async function callConfiguredAi(messages) {
  const provider = String(process.env.AI_PROVIDER || "").toLowerCase();
  if (provider === "gemini") return await callGeminiMentor(messages);
  if (provider === "openai" || process.env.OPENAI_API_KEY) return await callOpenAiMentor(messages);
  if (process.env.GEMINI_API_KEY) return await callGeminiMentor(messages);
  throw new Error("AI provider is not configured.");
}

async function generateRoadmapOptions(input) {
  return await callConfiguredAi([
    { role: "system", content: "Return only valid lightweight roadmap options JSON for Studox.ai." },
    { role: "user", content: roadmapOptionsPrompt(input) },
  ]);
}

async function generateCompleteRoadmap(input, selectedRoadmap) {
  return await callConfiguredAi([
    { role: "system", content: "Return only valid complete roadmap JSON for Studox.ai." },
    { role: "user", content: completeRoadmapPrompt(input, selectedRoadmap) },
  ]);
}

function localCounsellingMessages(step, payload = {}) {
  const education = String(payload.education || "").trim();
  const skills = String(payload.skills || "").trim();
  const edu = education.toLowerCase();
  const skillText = skills.toLowerCase();
  const techSkills = ["web", "javascript", "react", "node", "python", "java", "dsa", "data", "sql", "ai", "ml", "cyber", "security", "ui", "ux", "figma", "cloud"];
  const matchedSkill = techSkills.some((skill) => skillText.includes(skill));

  if (step === "education") {
    let insight = "Good. Tumhari current situation ko roadmap ke starting point ki tarah use karenge, so plan realistic aur career-focused rahega.";
    if (edu.includes("bca")) insight = "BCA is a strong base for web development, data analytics, AI basics and software roles. Agar tum projects, GitHub aur internships pe focus karoge to profile kaafi job-ready ban sakti hai.";
    else if (edu.includes("b.tech") || edu.includes("btech") || edu.includes("cse") || edu.includes("computer")) insight = "Computer science background tumhe DSA, development, projects aur system basics combine karne ka advantage deta hai.";
    else if (edu.includes("12") || edu.includes("school")) insight = "School stage se start karna advantage hai. Abhi coding basics, communication aur project habit build karoge to college mein ahead rahoge.";
    else if (edu.includes("diploma")) insight = "Diploma background practical learning ke liye useful hota hai. Skill plus portfolio projects tumhe job-ready track par le ja sakte hain.";
    return [
      "Good, thanks for sharing.",
      insight,
      "Iske saath tumne koi skill sochi hai? Agar sochi hai to likho. Agar nahi sochi, blank chhod sakte ho, main suggest kar dunga."
    ];
  }

  if (!skills) {
    return [
      edu.includes("bca")
        ? "Agar skills decide nahi ki hain, BCA ke saath Web Development + DSA + SQL/Python best start rahega. Isse internship, projects aur placement dono ke liye strong base banega."
        : "Agar skills decide nahi ki hain, main suggest karunga: Web Development foundation, DSA basics, GitHub projects and one specialization like AI/ML, Data Analytics, Cybersecurity or UI/UX.",
      "Now I will send you to the career assignment. Wahan ke answers ke basis par focused roadmap generate hoga."
    ];
  }

  return [
    matchedSkill
      ? `Good choice. ${skills} valuable lag raha hai because it connects with tech careers and future projects. Main assessment mein tumhe focused roadmap choose karne mein help karunga.`
      : `Honestly, ${skills} primary tech career ke liye strongest direction nahi lag raha. Main suggest karunga Web Development, Python, SQL, DSA, AI/ML, Cybersecurity, Data Analytics ya UI/UX mein se ek choose karo.`,
    "Now I will send you to the career assignment. Wahan ke answers ke basis par focused roadmap generate hoga."
  ];
}

function localCounsellingReport(payload = {}) {
  const education = String(payload.education || "").trim();
  const skills = String(payload.skills || "").trim();
  const text = `${education} ${skills}`.toLowerCase();
  const options = ["Full Stack Developer", "AI/ML Engineer", "Data Analyst", "Cybersecurity", "UI/UX Designer", "Web Development"];
  let recommendedTrack = "Full Stack Developer";
  if (text.includes("ui") || text.includes("ux") || text.includes("figma") || text.includes("design")) recommendedTrack = "UI/UX Designer";
  else if (text.includes("cyber") || text.includes("security")) recommendedTrack = "Cybersecurity";
  else if (text.includes("data") || text.includes("sql") || text.includes("analytics")) recommendedTrack = "Data Analyst";
  else if ((text.includes("ai") || text.includes("ml") || text.includes("machine")) && !text.includes("web")) recommendedTrack = "AI/ML Engineer";
  else if (text.includes("web") || text.includes("frontend") || text.includes("html") || text.includes("react")) recommendedTrack = "Web Development";

  const scoreFor = (track) => {
    if (track === recommendedTrack) return 92;
    if (track === "Full Stack Developer" && ["Web Development", "AI/ML Engineer"].includes(recommendedTrack)) return 86;
    if (track === "AI/ML Engineer" && text.includes("ai")) return 84;
    if (track === "Web Development" && text.includes("web")) return 88;
    if (track === "Data Analyst" && text.includes("sql")) return 78;
    return 58 + Math.floor(Math.random() * 12);
  };

  const fitScores = options.map((track) => ({
    track,
    score: Math.min(96, scoreFor(track)),
    reason: track === recommendedTrack ? "Best match based on your current background and skill interest." : "Possible secondary path after building the main foundation."
  })).sort((a, b) => b.score - a.score).slice(0, 4);

  return {
    profileTitle: `${education || "Student"} - ${recommendedTrack} fit`,
    snapshot: [
      education ? `Current status: ${education}` : "Current status: still exploring",
      skills ? `Skill direction: ${skills}` : "Skill direction: not decided yet",
      `Best next move: start with ${recommendedTrack} fundamentals and one portfolio project.`
    ],
    recommendedTrack,
    confidence: recommendedTrack === "Full Stack Developer" ? 78 : 86,
    fitScores,
    miniRoadmap: [
      "Week 1: revise core basics and setup GitHub learning log.",
      `Week 2: learn ${recommendedTrack} fundamentals with daily practice.`,
      "Week 3: build one small portfolio project using real-world features.",
      "Week 4: add deployment, documentation and interview talking points."
    ],
    warnings: skills ? [] : ["Skill direction is still unclear, so assessment answers will refine the roadmap."],
    assessmentDefaults: {
      goal: options.includes(recommendedTrack) ? recommendedTrack : "Full Stack Developer",
      focus: "Portfolio projects",
      timeline: "3 months",
      hours: "6-8 hours"
    }
  };
}

function counsellingPrompt(step, payload = {}) {
  const education = String(payload.education || "").trim();
  const skills = String(payload.skills || "").trim();
  return `You are Studox.ai's premium AI career counsellor for Indian college students.
Reply in Hinglish, warm and practical. Keep it concise. Do not mention that you are rule-based.
Return only JSON. No markdown, no code fences.

Student education/current status: ${education || "not provided"}
Student skill interest: ${skills || "not provided"}
Current counselling step: ${step}

Allowed career tracks: Full Stack Developer, AI/ML Engineer, Data Analyst, Cybersecurity, UI/UX Designer, Web Development.
Allowed assessment focus values: Job-ready skills, Internship preparation, Portfolio projects, DSA and coding, Interview preparation.
Allowed timelines: 1 month, 3 months, 6 months, 12 months.
Allowed weekly hours: 3-5 hours, 6-8 hours, 9-12 hours, 15+ hours.

If step is education, return exactly:
{"messages":["acknowledgement", "education insight", "skill question"], "report": null}

If step is skills, return exactly:
{
  "messages": ["skill fit feedback", "career assignment transition"],
  "report": {
    "profileTitle": "short title",
    "snapshot": ["3 short facts about student"],
    "recommendedTrack": "one allowed career track",
    "confidence": number from 45 to 98,
    "fitScores": [
      {"track":"allowed career track", "score": number from 0 to 100, "reason":"short reason"}
    ],
    "miniRoadmap": ["Week 1 action", "Week 2 action", "Week 3 action", "Week 4 action"],
    "warnings": ["optional caution if any"],
    "assessmentDefaults": {"goal":"allowed career track", "focus":"allowed focus", "timeline":"allowed timeline", "hours":"allowed weekly hours"}
  }
}

For fitScores, include the top 4 tracks only. The best fit must have the highest score.`;
}

async function generateCounsellingReply(step, payload = {}) {
  const normalizedStep = step === "skills" ? "skills" : "education";
  try {
    const aiResult = await callConfiguredAi([
      { role: "system", content: "Return only valid JSON messages for Studox.ai counselling." },
      { role: "user", content: counsellingPrompt(normalizedStep, payload) },
    ]);
    const parsed = JSON.parse(aiResult.reply.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim());
    const messages = Array.isArray(parsed.messages) ? parsed.messages.map((item) => String(item || "").trim()).filter(Boolean) : [];
    if (!messages.length) throw new Error("Gemini returned empty counselling messages.");
    return { messages, report: parsed.report || null, provider: aiResult.provider, model: aiResult.model, fallback: false };
  } catch (error) {
    console.warn(`AI counselling fallback: ${error.message}`);
    return {
      messages: localCounsellingMessages(normalizedStep, payload),
      report: normalizedStep === "skills" ? localCounsellingReport(payload) : null,
      provider: "local",
      model: "studox-local-counsellor",
      fallback: true,
    };
  }
}
function memoryId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hasValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

async function listResource(resource, filter = {}) {
  const config = resourceMap[resource];
  if (!config) return null;
  if (mongoReady() && config.model) {
    const docs = await config.model.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    if (docs.length) return docs;
  }
  return memory[config.key] || [];
}

async function createResource(resource, payload) {
  const config = resourceMap[resource];
  if (!config) return null;
  if (mongoReady() && config.model) return config.model.create(payload);
  const item = { id: memoryId(resource), ...payload, createdAt: new Date().toISOString() };
  memory[config.key] = memory[config.key] || [];
  memory[config.key].unshift(item);
  persistMemory();
  return item;
}

async function updateResource(resource, id, payload) {
  const config = resourceMap[resource];
  if (!config) return null;
  if (mongoReady() && config.model && mongoose.isValidObjectId(id)) {
    return config.model.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
  }
  const list = memory[config.key] || [];
  const index = list.findIndex((item) => item.id === id || item._id === id);
  if (index === -1) return null;
  list[index] = { ...list[index], ...payload, updatedAt: new Date().toISOString() };
  persistMemory();
  return list[index];
}

function isOwnedByUser(item, userId) {
  return Boolean(item && String(item.user || item.userId || "") === String(userId));
}

function pickFields(source = {}, fields = []) {
  return fields.reduce((picked, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) picked[field] = source[field];
    return picked;
  }, {});
}

function validationError(field, message, code = "invalid") {
  return { field, message, code };
}

function validationFailed(res, errors) {
  return res.status(400).json({ message: "Invalid request input.", errors });
}

function hasField(source = {}, field) {
  return Object.prototype.hasOwnProperty.call(source, field);
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype);
}

function validateRequired(source, field, errors) {
  if (!hasField(source, field) || source[field] === undefined || source[field] === null || source[field] === "") {
    errors.push(validationError(field, `${field} is required.`, "required"));
    return false;
  }
  return true;
}

function validateString(source, field, errors, { required = false, min = 0, max = 500, pattern, allowEmpty = true } = {}) {
  if (!hasField(source, field) || source[field] === undefined || source[field] === null) {
    if (required) errors.push(validationError(field, `${field} is required.`, "required"));
    return;
  }
  const value = source[field];
  if (typeof value !== "string") {
    errors.push(validationError(field, `${field} must be a string.`, "type"));
    return;
  }
  if (!allowEmpty && !value.trim()) errors.push(validationError(field, `${field} cannot be empty.`, "required"));
  if (value.length < min) errors.push(validationError(field, `${field} must be at least ${min} characters.`, "min_length"));
  if (value.length > max) errors.push(validationError(field, `${field} must be at most ${max} characters.`, "max_length"));
  if (pattern && value && !pattern.test(value)) errors.push(validationError(field, `${field} has an invalid format.`, "format"));
}

function validateNumber(source, field, errors, { required = false, min, max, integer = false } = {}) {
  if (!hasField(source, field) || source[field] === undefined || source[field] === null || source[field] === "") {
    if (required) errors.push(validationError(field, `${field} is required.`, "required"));
    return;
  }
  const value = source[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(validationError(field, `${field} must be a number.`, "type"));
    return;
  }
  if (integer && !Number.isInteger(value)) errors.push(validationError(field, `${field} must be an integer.`, "integer"));
  if (min !== undefined && value < min) errors.push(validationError(field, `${field} must be at least ${min}.`, "min"));
  if (max !== undefined && value > max) errors.push(validationError(field, `${field} must be at most ${max}.`, "max"));
}

function validateBoolean(source, field, errors, { required = false } = {}) {
  if (!hasField(source, field) || source[field] === undefined || source[field] === null) {
    if (required) errors.push(validationError(field, `${field} is required.`, "required"));
    return;
  }
  if (typeof source[field] !== "boolean") errors.push(validationError(field, `${field} must be a boolean.`, "type"));
}

function validateEnum(source, field, values, errors, { required = false } = {}) {
  if (!hasField(source, field) || source[field] === undefined || source[field] === null || source[field] === "") {
    if (required) errors.push(validationError(field, `${field} is required.`, "required"));
    return;
  }
  if (!values.includes(source[field])) errors.push(validationError(field, `${field} must be one of: ${values.join(", ")}.`, "enum"));
}

function validateArray(source, field, errors, { required = false, max = 50 } = {}) {
  if (!hasField(source, field) || source[field] === undefined || source[field] === null) {
    if (required) errors.push(validationError(field, `${field} is required.`, "required"));
    return;
  }
  if (!Array.isArray(source[field])) {
    errors.push(validationError(field, `${field} must be an array.`, "type"));
    return;
  }
  if (source[field].length > max) errors.push(validationError(field, `${field} must contain at most ${max} items.`, "max_items"));
}

function validatePlainObject(source, field, errors, { required = false } = {}) {
  if (!hasField(source, field) || source[field] === undefined || source[field] === null) {
    if (required) errors.push(validationError(field, `${field} is required.`, "required"));
    return;
  }
  if (!isPlainObject(source[field])) errors.push(validationError(field, `${field} must be a plain object.`, "type"));
}

function validateObject(source, field, errors, options = {}) {
  validatePlainObject(source, field, errors, options);
}

function validateObjectId(source, field, errors, { required = false } = {}) {
  if (!hasField(source, field) || !source[field]) {
    if (required) errors.push(validationError(field, `${field} is required.`, "required"));
    return;
  }
  if (!mongoose.isValidObjectId(String(source[field]))) errors.push(validationError(field, `${field} must be a valid ObjectId.`, "object_id"));
}

function validateIdentifier(source, field, errors, { required = false, max = 100 } = {}) {
  if (!hasField(source, field) || source[field] === undefined || source[field] === null || source[field] === "") {
    if (required) errors.push(validationError(field, `${field} is required.`, "required"));
    return;
  }
  const value = String(source[field]);
  if (value.length > max || !/^[A-Za-z0-9_-]+$/.test(value)) {
    errors.push(validationError(field, `${field} has an invalid format.`, "identifier"));
  }
}

function validateObjectIdOrIdentifier(source, field, errors, options = {}) {
  validateIdentifier(source, field, errors, options);
}

function validateUrl(source, field, errors, { required = false, max = 500 } = {}) {
  if (!hasField(source, field) || !source[field]) {
    if (required) errors.push(validationError(field, `${field} is required.`, "required"));
    return;
  }
  if (typeof source[field] !== "string" || source[field].length > max) {
    errors.push(validationError(field, `${field} must be a valid URL string.`, "url"));
    return;
  }
  try {
    const url = new URL(source[field]);
    if (!["http:", "https:"].includes(url.protocol)) errors.push(validationError(field, `${field} must be an http(s) URL.`, "url"));
  } catch (_error) {
    errors.push(validationError(field, `${field} must be a valid URL.`, "url"));
  }
}

function validateDate(source, field, errors, { required = false } = {}) {
  if (!hasField(source, field) || !source[field]) {
    if (required) errors.push(validationError(field, `${field} is required.`, "required"));
    return;
  }
  const date = new Date(source[field]);
  if (Number.isNaN(date.getTime())) errors.push(validationError(field, `${field} must be a valid date.`, "date"));
}

function validateUuid(source, field, errors, { required = false } = {}) {
  validateString(source, field, errors, {
    required,
    min: 36,
    max: 36,
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  });
}

function validateBearerHeader(req, errors, { required = true } = {}) {
  const header = req.headers.authorization || "";
  if (!header) {
    if (required) errors.push(validationError("authorization", "Authorization header is required.", "required"));
    return "";
  }
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    errors.push(validationError("authorization", "Authorization header must use Bearer token format.", "bearer"));
    return "";
  }
  const token = header.slice(7).trim();
  if (!token) errors.push(validationError("authorization", "Bearer token is required.", "required"));
  return token;
}

function validateAllowedResource(resource, errors) {
  if (!resourceMap[resource]) errors.push(validationError("resource", "Unknown resource.", "enum"));
}

function validateNoDangerousKeys(value, errors, field = "body", depth = 0, maxDepth = 6) {
  if (depth > maxDepth) {
    errors.push(validationError(field, `${field} is too deeply nested.`, "max_depth"));
    return;
  }
  if (field === "body" && depth === 0 && Array.isArray(value)) {
    errors.push(validationError(field, "Request body must be a plain object.", "type"));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoDangerousKeys(item, errors, `${field}.${index}`, depth + 1, maxDepth));
    return;
  }
  if (!value || typeof value !== "object") return;
  if (!isPlainObject(value)) {
    errors.push(validationError(field, `${field} must be a plain object.`, "type"));
    return;
  }
  Object.entries(value).forEach(([key, child]) => {
    const childField = `${field}.${key}`;
    if (key === "__proto__" || key === "prototype" || key === "constructor" || key.startsWith("$") || key.includes(".")) {
      errors.push(validationError(childField, `${childField} is not allowed.`, "dangerous_key"));
      return;
    }
    validateNoDangerousKeys(child, errors, childField, depth + 1, maxDepth);
  });
}

function validateStringArray(source, field, errors, { required = false, max = 30, itemMax = 120 } = {}) {
  validateArray(source, field, errors, { required, max });
  if (!Array.isArray(source[field])) return;
  source[field].forEach((item, index) => {
    if (typeof item !== "string" || item.trim().length > itemMax) {
      errors.push(validationError(`${field}.${index}`, `${field}.${index} must be a string under ${itemMax} characters.`, "type"));
    }
  });
}

function validateEducationItems(items, errors, field = "education") {
  if (!Array.isArray(items)) return;
  items.forEach((item, index) => {
    if (!isPlainObject(item)) {
      errors.push(validationError(`${field}.${index}`, `${field}.${index} must be a plain object.`, "type"));
      return;
    }
    ["school", "degree", "field", "year"].forEach((key) => validateString(item, key, errors, { max: 160 }));
  });
}

function validateProfilePayload(body, errors) {
  validateNoDangerousKeys(body, errors);
  validateString(body, "username", errors, { max: 80 });
  validateString(body, "goal", errors, { max: 180 });
  validateString(body, "field", errors, { max: 120 });
  validateString(body, "college", errors, { max: 160 });
  validateString(body, "branch", errors, { max: 120 });
  validateString(body, "bio", errors, { max: 1000 });
  validateStringArray(body, "skills", errors, { max: 50, itemMax: 80 });
  validateArray(body, "education", errors, { max: 20 });
  validateEducationItems(body.education, errors);
  validateEnum(body, "level", ["Beginner", "Intermediate", "Advanced"], errors);
}

function validateSettingsPayload(body, errors) {
  validateNoDangerousKeys(body, errors);
  validateEnum(body, "theme", ["light", "dark", "system"], errors);
  validateString(body, "accentColor", errors, { max: 32, pattern: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i });
  validateString(body, "language", errors, { max: 60 });
  validatePlainObject(body, "notifications", errors);
  validatePlainObject(body, "privacy", errors);
}

function validateResumePayload(body, errors) {
  validateNoDangerousKeys(body, errors, "body", 0, 7);
  validateString(body, "template", errors, { max: 80 });
  validatePlainObject(body, "sections", errors);
  validateNumber(body, "atsScore", errors, { min: 0, max: 100 });
  validateArray(body, "analysis", errors, { max: 50 });
  if (Array.isArray(body.analysis)) {
    body.analysis.forEach((item, index) => {
      if (typeof item !== "string" || item.length > 300) errors.push(validationError(`analysis.${index}`, "analysis items must be short strings.", "type"));
    });
  }
  validateString(body, "targetRole", errors, { max: 120 });
}

function validateProjectPayload(body, errors, { create = false } = {}) {
  validateNoDangerousKeys(body, errors);
  validateString(body, "title", errors, { required: create, min: 1, max: 160, allowEmpty: false });
  validateString(body, "description", errors, { max: 2000 });
  validateStringArray(body, "skills", errors, { max: 30, itemMax: 80 });
  validateString(body, "status", errors, { max: 40 });
  validatePlainObject(body, "links", errors);
  if (isPlainObject(body.links)) {
    validateUrl(body.links, "github", errors);
    validateUrl(body.links, "demo", errors);
    validateUrl(body.links, "live", errors);
    validateUrl(body.links, "repository", errors);
  }
}

function validateDsaProblem(problem, errors, field = "problem", { required = false } = {}) {
  if (!problem) {
    if (required) errors.push(validationError(field, `${field} is required.`, "required"));
    return;
  }
  if (!isPlainObject(problem)) {
    errors.push(validationError(field, `${field} must be a plain object.`, "type"));
    return;
  }
  validateString(problem, "title", errors, { required, min: required ? 1 : 0, max: 180, allowEmpty: !required });
  validateString(problem, "topic", errors, { required, min: required ? 1 : 0, max: 120, allowEmpty: !required });
  validateEnum(problem, "level", ["Easy", "Medium", "Hard"], errors);
  validateString(problem, "status", errors, { max: 60 });
  validateNumber(problem, "score", errors, { min: 0, max: 100 });
}

function validateDsaPayload(body, errors) {
  validateNoDangerousKeys(body, errors);
  validateNumber(body, "problemsSolved", errors, { min: 0, max: 100000, integer: true });
  validateNumber(body, "acceptanceRate", errors, { min: 0, max: 100 });
  validateNumber(body, "currentStreak", errors, { min: 0, max: 10000, integer: true });
  validateNumber(body, "ranking", errors, { min: 1, max: 10000000, integer: true });
  validateNumber(body, "totalProblems", errors, { min: 0, max: 100000, integer: true });
  validateArray(body, "topics", errors, { max: 100 });
  (body.topics || []).forEach((topic, index) => {
    if (!isPlainObject(topic)) return errors.push(validationError(`topics.${index}`, "topics items must be objects.", "type"));
    validateString(topic, "name", errors, { max: 120 });
    validateNumber(topic, "solved", errors, { min: 0, max: 100000, integer: true });
    validateNumber(topic, "total", errors, { min: 0, max: 100000, integer: true });
  });
  validateArray(body, "recentProblems", errors, { max: 100 });
  (body.recentProblems || []).forEach((problem, index) => validateDsaProblem(problem, errors, `recentProblems.${index}`));
  validateStringArray(body, "badges", errors, { max: 100, itemMax: 80 });
}

function validateTestSubmissionPayload(body, errors) {
  validateNoDangerousKeys(body, errors);
  validateArray(body, "answers", errors, { required: true, max: 200 });
  (body.answers || []).forEach((answer, index) => {
    if (!isPlainObject(answer)) {
      errors.push(validationError(`answers.${index}`, "answers items must be objects.", "type"));
      return;
    }
    validateObjectIdOrIdentifier(answer, "question", errors, { required: true, max: 120 });
    validateString(answer, "selected", errors, { max: 500 });
  });
  validateNumber(body, "timeTakenMinutes", errors, { min: 0, max: 600 });
}

function validateInternshipPayload(body, errors) {
  validateNoDangerousKeys(body, errors);
  validateString(body, "role", errors, { required: true, min: 1, max: 160, allowEmpty: false });
  validateString(body, "company", errors, { required: true, min: 1, max: 160, allowEmpty: false });
  validateString(body, "domain", errors, { max: 120 });
  validateString(body, "location", errors, { max: 160 });
  validateString(body, "duration", errors, { max: 80 });
  validateString(body, "stipend", errors, { max: 80 });
  validateBoolean(body, "remote", errors);
  validateString(body, "type", errors, { max: 80 });
  validateNumber(body, "matchScore", errors, { min: 0, max: 100 });
  validateStringArray(body, "skills", errors, { max: 30, itemMax: 80 });
}

function validateHackathonPayload(body, errors) {
  validateNoDangerousKeys(body, errors);
  validateString(body, "title", errors, { required: true, min: 1, max: 180, allowEmpty: false });
  validateString(body, "domain", errors, { max: 120 });
  validateString(body, "duration", errors, { max: 80 });
  validateString(body, "prize", errors, { max: 120 });
  validateDate(body, "startsAt", errors);
  validateString(body, "mode", errors, { max: 80 });
  validateStringArray(body, "skills", errors, { max: 30, itemMax: 80 });
}

function validateCertificatePayload(body, errors) {
  validateNoDangerousKeys(body, errors);
  validateString(body, "title", errors, { required: true, min: 1, max: 180, allowEmpty: false });
  validateString(body, "category", errors, { max: 80 });
  validateDate(body, "issuedAt", errors);
  validateString(body, "status", errors, { max: 40 });
  validateString(body, "credentialId", errors, { max: 120 });
  validateUrl(body, "badgeUrl", errors);
}

function validateRoadmapGeneratePayload(body, errors) {
  validateNoDangerousKeys(body, errors, "body", 0, 7);
  errors.push(...roadmapInputErrors(body).map((message) => validationError("roadmap", message)));
}

function validateRoadmapSelectPayload(body, errors) {
  validateNoDangerousKeys(body, errors, "body", 0, 8);
  validatePlainObject(body, "roadmap", errors, { required: true });
  if (isPlainObject(body.roadmap)) {
    errors.push(...roadmapOptionErrors(body.roadmap, 0).map((message) => validationError("roadmap", message)));
  }
}

function validateAdminPayload(resource, body, errors) {
  validateNoDangerousKeys(body, errors, "body", 0, 7);
  switch (resource) {
    case "users":
      validateString(body, "name", errors, { max: 120 });
      validateString(body, "email", errors, { max: 180 });
      validateEnum(body, "role", ["student", "admin"], errors);
      validateEnum(body, "status", ["pending", "active", "scheduled_for_deletion", "disabled"], errors);
      validateString(body, "phone", errors, { max: 40 });
      validateUrl(body, "photoURL", errors);
      validateObjectId(body, "activeRoadmapId", errors);
      break;
    case "profiles":
      validateProfilePayload(body, errors);
      break;
    case "settings":
      validateSettingsPayload(body, errors);
      break;
    case "resumes":
      validateResumePayload(body, errors);
      break;
    case "projects":
      validateProjectPayload(body, errors);
      break;
    case "internships":
      validateInternshipPayload(body, errors);
      break;
    case "hackathons":
      validateHackathonPayload(body, errors);
      break;
    case "certificates":
      validateCertificatePayload(body, errors);
      break;
    case "roadmaps":
      validateString(body, "title", errors, { max: 180 });
      validateString(body, "careerGoal", errors, { max: 180 });
      validateString(body, "summary", errors, { max: 2000 });
      validateNumber(body, "estimatedDurationWeeks", errors, { min: 1, max: 260 });
      validateString(body, "difficulty", errors, { max: 80 });
      validateEnum(body, "status", ["draft", "active", "completed", "archived"], errors);
      validateArray(body, "weeks", errors, { max: 104 });
      break;
    case "courses":
      validateString(body, "title", errors, { max: 180 });
      validateString(body, "description", errors, { max: 2000 });
      validateString(body, "level", errors, { max: 80 });
      validateNumber(body, "progress", errors, { min: 0, max: 100 });
      validateStringArray(body, "tags", errors, { max: 30, itemMax: 80 });
      break;
    case "modules":
      validateString(body, "title", errors, { max: 180 });
      validateString(body, "description", errors, { max: 2000 });
      validateNumber(body, "order", errors, { min: 0, max: 1000, integer: true });
      validateNumber(body, "lessons", errors, { min: 0, max: 500, integer: true });
      validateEnum(body, "status", ["completed", "in-progress", "locked"], errors);
      validateNumber(body, "progress", errors, { min: 0, max: 100 });
      validateStringArray(body, "resources", errors, { max: 25, itemMax: 200 });
      break;
    case "tests":
      validateString(body, "title", errors, { max: 180 });
      validateNumber(body, "durationMinutes", errors, { min: 1, max: 600, integer: true });
      validateNumber(body, "totalQuestions", errors, { min: 0, max: 500, integer: true });
      validateDate(body, "scheduledAt", errors);
      validateStringArray(body, "sections", errors, { max: 20, itemMax: 80 });
      break;
    case "questions":
      validateObjectIdOrIdentifier(body, "test", errors);
      validateString(body, "prompt", errors, { max: 2000 });
      validateStringArray(body, "options", errors, { max: 10, itemMax: 500 });
      validateString(body, "answer", errors, { max: 500 });
      break;
    default:
      break;
  }
}

async function findOwnedResource(resource, id, userId) {
  const config = resourceMap[resource];
  if (!config) return null;
  if (mongoReady() && config.model && mongoose.isValidObjectId(id)) {
    const item = await config.model.findById(id).lean();
    return isOwnedByUser(item, userId) ? item : null;
  }
  const list = memory[config.key] || [];
  const item = list.find((entry) => String(entry.id || entry._id) === String(id));
  return isOwnedByUser(item, userId) ? item : null;
}

async function updateOwnedResource(resource, id, userId, payload) {
  const item = await findOwnedResource(resource, id, userId);
  if (!item) return null;
  return updateResource(resource, id, payload);
}

async function deleteResource(resource, id) {
  const config = resourceMap[resource];
  if (!config) return null;
  if (mongoReady() && config.model && mongoose.isValidObjectId(id)) {
    return config.model.findByIdAndDelete(id).lean();
  }
  const list = memory[config.key] || [];
  const index = list.findIndex((item) => item.id === id || item._id === id);
  if (index === -1) return null;
  const deleted = list.splice(index, 1)[0];
  persistMemory();
  return deleted;
}

function removeMemoryUserCascade(userId) {
  if (!userId) return;
  const removeByUser = (key) => {
    memory[key] = (memory[key] || []).filter((item) => String(item.user || item.id) !== String(userId));
  };
  memory.users = (memory.users || []).filter((item) => String(item.id || item._id) !== String(userId));
  ["profiles", "settings", "roadmaps", "testResults", "dsaProgress", "resumes", "projects", "certificates", "chats", "notifications"].forEach(removeByUser);
  persistMemory();
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "Studox.ai API",
    database: mongoReady() ? "mongodb" : "memory",
    time: new Date().toISOString(),
  });
});

app.get("/api/firebase/config", (_req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
  });
});

app.post("/api/auth/firebase", async (req, res) => {
  try {
    const errors = [];
    const token = validateBearerHeader(req, errors);
    if (!token && errors.some((error) => error.code === "required")) return res.status(401).json({ message: "Firebase ID token is required." });
    if (errors.length) return validationFailed(res, errors);

    let firebase;
    try {
      firebase = require("./config/firebaseAdmin");
    } catch (error) {
      return res.status(503).json({ message: "Firebase Admin SDK is not installed.", error: error.message });
    }

    let firebaseApp;
    try {
      firebaseApp = firebase.initializeFirebaseAdmin();
    } catch (error) {
      return res.status(503).json({ message: "Firebase Admin credentials are invalid. Check FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL and FIREBASE_PROJECT_ID in .env.", error: error.message });
    }
    if (!firebaseApp) return res.status(503).json({ message: "Firebase Admin credentials are not configured." });

    const decoded = await firebase.admin.auth().verifyIdToken(token);
    if (!decoded.uid) return res.status(400).json({ message: "Firebase token is missing uid." });
    if (!normalizeEmail(decoded.email)) return res.status(400).json({ message: "Firebase account email is required." });

    const user = await syncFirebaseUser(decoded);
    if (!user) return res.status(401).json({ message: "Firebase authentication failed." });

    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    res.status(401).json({ message: "Firebase authentication failed.", error: error.message });
  }
});

app.get("/api/auth/me", authRequired, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ message: "User not found." });
    return res.json({ user: publicUser(user) });
  }
  const user = memory.users.find((item) => String(item.id || item._id) === String(req.user.id));
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json({ user: publicUser(user) });
});

app.get("/api/billing/plan", authRequired, async (req, res) => {
  const plan = await getUserPlan(req.user.id);
  const used = await countMentorChats(req.user.id);
  res.json({
    plan,
    mentor: {
      used,
      limit: mentorFreeChatLimit,
      locked: !mentorLimitTemporarilyDisabled && !isPremiumPlan(plan) && used >= mentorFreeChatLimit,
      unlimited: isPremiumPlan(plan),
    },
  });
});

app.post("/api/payments/create-order", authRequired, async (req, res) => {
  const errors = [];
  const plan = String(req.body.plan || "").toLowerCase();
  validateEnum({ plan }, "plan", ["pro", "elite"], errors, { required: true });
  if (errors.length) return validationFailed(res, errors);

  try {
    const order = await createRazorpayOrder({ plan, userId: req.user.id });
    const selectedPlan = paymentPlans[plan];
    res.json({
      keyId: razorpayKeyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan,
      planName: selectedPlan.name,
      prefill: { name: req.user.name || "Studox Student", email: req.user.email || "" },
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || "Could not create payment order." });
  }
});

app.post("/api/payments/verify", authRequired, async (req, res) => {
  const errors = [];
  const plan = String(req.body.plan || "").toLowerCase();
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  validateEnum({ plan }, "plan", ["pro", "elite"], errors, { required: true });
  validateString(req.body, "razorpay_order_id", errors, { required: true, min: 3, max: 120, pattern: /^[A-Za-z0-9_:-]+$/ });
  validateString(req.body, "razorpay_payment_id", errors, { required: true, min: 3, max: 120, pattern: /^[A-Za-z0-9_:-]+$/ });
  validateString(req.body, "razorpay_signature", errors, { required: true, min: 32, max: 256, pattern: /^[A-Za-z0-9_=+/-]+$/ });
  if (errors.length) return validationFailed(res, errors);

  if (!["pro", "elite"].includes(plan)) return res.status(400).json({ message: "Please choose a valid premium plan." });
  if (!orderId || !paymentId || !signature) return res.status(400).json({ message: "Payment verification details are missing." });
  if (!razorpayConfigured()) return res.status(503).json({ message: "Razorpay keys are not configured." });
  if (!verifyRazorpaySignature({ orderId, paymentId, signature })) return res.status(400).json({ message: "Payment verification failed." });

  const user = await activateUserPlan(req.user.id, plan);
  if (!user) return res.status(404).json({ message: "User not found." });

  res.json({
    message: `${plan === "elite" ? "Elite" : "Pro"} plan activated. Payment verified successfully.`,
    plan,
    user: publicUser(user),
    payment: { provider: "razorpay", orderId, paymentId, status: "captured", verifiedAt: new Date().toISOString() },
    subscription: { status: "active", startedAt: new Date().toISOString() },
  });
});

app.post("/api/billing/upgrade", authRequired, async (req, res) => {
  if (process.env.NODE_ENV === "production") return res.status(403).json({ message: "Use verified payment checkout to upgrade plans." });

  const errors = [];
  const plan = String(req.body.plan || "").toLowerCase();
  validateEnum({ plan }, "plan", ["pro", "elite"], errors, { required: true });
  if (errors.length) return validationFailed(res, errors);

  const user = await activateUserPlan(req.user.id, plan);
  if (!user) return res.status(404).json({ message: "User not found." });

  res.json({
    message: `${plan === "elite" ? "Elite" : "Pro"} plan activated in local demo mode.`,
    plan,
    user: publicUser(user),
    subscription: { status: "active", startedAt: new Date().toISOString() },
  });
});
app.get("/api/profile", authRequired, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const profile = await StudentProfile.findOne({ user: req.user.id }).lean();
    if (profile) return res.json(profile);
  }
  res.json(memory.profiles.find((profile) => String(profile.user) === String(req.user.id)) || {});
});

app.put("/api/profile", authRequired, async (req, res) => {
  const errors = [];
  validateProfilePayload(req.body, errors);
  if (errors.length) return validationFailed(res, errors);
  const profileUpdate = pickFields(req.body, ["username", "goal", "field", "college", "branch", "bio", "skills", "education", "level"]);
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const profile = await StudentProfile.findOneAndUpdate({ user: req.user.id }, profileUpdate, { new: true, upsert: true }).lean();
    return res.json(profile);
  }
  const profile = memory.profiles.find((item) => String(item.user) === String(req.user.id)) || { user: req.user.id };
  if (!memory.profiles.includes(profile)) memory.profiles.unshift(profile);
  Object.assign(profile, profileUpdate, { updatedAt: new Date().toISOString() });
  persistMemory();
  res.json(profile);
});

app.get("/api/settings", authRequired, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const settings = await UserSettings.findOne({ user: req.user.id }).lean();
    if (settings) return res.json(settings);
  }
  res.json(memory.settings.find((settings) => String(settings.user) === String(req.user.id)) || {});
});

app.put("/api/settings", authRequired, async (req, res) => {
  const errors = [];
  validateSettingsPayload(req.body, errors);
  if (errors.length) return validationFailed(res, errors);
  const settingsUpdate = pickFields(req.body, ["theme", "accentColor", "language", "notifications", "privacy"]);
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const settings = await UserSettings.findOneAndUpdate({ user: req.user.id }, settingsUpdate, { new: true, upsert: true }).lean();
    return res.json(settings);
  }
  const settings = memory.settings.find((item) => String(item.user) === String(req.user.id)) || { user: req.user.id };
  if (!memory.settings.includes(settings)) memory.settings.unshift(settings);
  Object.assign(settings, settingsUpdate, { updatedAt: new Date().toISOString() });
  persistMemory();
  res.json(settings);
});

app.get("/api/dashboard/stats", authRequired, async (req, res) => {
  const userId = currentUserId(req);
  let profile = {};
  let roadmap = {};
  let userResults = [];
  let userProjects = [];
  let userCertificates = [];
  let dsa = {};
  let hasActiveRoadmap = false;

  if (mongoReady() && mongoose.isValidObjectId(userId)) {
    const user = await User.findById(userId).select("activeRoadmapId").lean();
    if (user?.activeRoadmapId) {
      roadmap = await Roadmap.findById(user.activeRoadmapId).lean();
      hasActiveRoadmap = Boolean(roadmap);
    }
    if (!roadmap) {
      roadmap = await Roadmap.findOne({ userId, status: "active" }).sort({ createdAt: -1 }).lean();
      hasActiveRoadmap = Boolean(roadmap);
    }
    if (!roadmap) {
      roadmap = await Roadmap.findOne({ userId }).sort({ createdAt: -1 }).lean();
    }
    [profile, userResults, userProjects, userCertificates, dsa] = await Promise.all([
      StudentProfile.findOne({ user: userId }).lean(),
      TestResult.find({ user: userId }).sort({ createdAt: -1 }).limit(100).lean(),
      Project.find({ user: userId }).sort({ createdAt: -1 }).limit(100).lean(),
      Certificate.find({ user: userId }).sort({ createdAt: -1 }).limit(100).lean(),
      DSAProgress.findOne({ user: userId }).lean(),
    ]);
  } else {
    profile = memory.profiles.find((item) => String(item.user) === String(userId)) || {};
    roadmap = memory.roadmaps.find((item) => String(item.user || item.userId) === String(userId)) || {};
    hasActiveRoadmap = Boolean(roadmap?.title);
    userResults = byUser(memory.testResults, userId);
    userProjects = byUser(memory.projects, userId);
    userCertificates = byUser(memory.certificates, userId);
    dsa = memory.dsaProgress.find((item) => String(item.user || item.userId) === String(userId)) || {};
  }

  profile = profile || {};
  roadmap = roadmap || {};
  userResults = Array.isArray(userResults) ? userResults : [];
  userProjects = Array.isArray(userProjects) ? userProjects : [];
  userCertificates = Array.isArray(userCertificates) ? userCertificates : [];
  roadmap = hasActiveRoadmap ? normalizeRoadmapShape(roadmap) : {};
  dsa = dsa || {};
  const appliedInternships = (memory.internships || []).filter((item) => (item.applicants || []).includes(userId));
  const registeredHackathons = (memory.hackathons || []).filter((item) => (item.registrations || []).includes(userId));
  const skills = new Set([...(profile.skills || []), ...((roadmap.modules || []).flatMap((module) => module.progress > 40 ? module.skills || [] : []))]);
  const overallProgress = Math.round(Number(roadmap.overallProgress ?? average((roadmap.modules || []).map((module) => module.progress)) ?? 0));
  const xpPoints = Number(profile.xp || 0) + userResults.length * 120 + Number(dsa.problemsSolved || 0) * 8 + userProjects.length * 90 + userCertificates.length * 150;
  const courses = await listResource("courses");
  const tests = await listResource("tests");
  res.json({
    hasActiveRoadmap,
    overallProgress,
    testsCompleted: userResults.length,
    skillsMastered: skills.size,
    xpPoints,
    learningTimeHours: Math.round(userResults.length * 1.5 + Number(dsa.problemsSolved || 0) / 8 + userProjects.length * 2),
    studyStreak: dsa.currentStreak || profile.streak || 0,
    applications: appliedInternships.length,
    hackathonRegistrations: registeredHackathons.length,
    projectCount: userProjects.length,
    certificatesEarned: userCertificates.length,
    upcomingTests: tests,
    recentActivity: buildActivity(userId),
    recommendedCourses: courses,
    profile,
    roadmap,
    dsa,
  });
});

function average(values) {
  const clean = values.filter((value) => Number.isFinite(Number(value)));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + Number(value), 0) / clean.length;
}

function buildActivity(userId) {
  const activity = [];
  byUser(memory.testResults, userId).slice(0, 3).forEach((item) => activity.push({ title: `Submitted test with ${item.score}% score`, time: item.createdAt || "Recently", type: "test" }));
  byUser(memory.projects, userId).slice(0, 3).forEach((item) => activity.push({ title: `Added project: ${item.title}`, time: item.createdAt || "Recently", type: "project" }));
  (memory.internships || []).filter((item) => (item.applicants || []).includes(userId)).slice(0, 3).forEach((item) => activity.push({ title: `Applied to ${item.role}`, time: "Recently", type: "internship" }));
  (memory.hackathons || []).filter((item) => (item.registrations || []).includes(userId)).slice(0, 3).forEach((item) => activity.push({ title: `Registered for ${item.title}`, time: "Recently", type: "hackathon" }));
  return activity.length ? activity : [
    { title: "Start your first weekly test", time: "Now", type: "test" },
    { title: "Solve today's DSA challenge", time: "Now", type: "dsa" },
    { title: "Add your first portfolio project", time: "Now", type: "project" },
  ];
}

app.get("/api/roadmaps", authRequired, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const user = await User.findById(req.user.id).select("activeRoadmapId").lean();
    let activeRoadmap = null;
    if (user?.activeRoadmapId) {
      activeRoadmap = await Roadmap.findById(user.activeRoadmapId).lean();
    }
    if (!activeRoadmap) {
      activeRoadmap = await Roadmap.findOne({ userId: req.user.id, status: "active" }).sort({ createdAt: -1 }).lean();
    }
    const roadmaps = await Roadmap.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    const orderedRoadmaps = activeRoadmap
      ? [activeRoadmap, ...roadmaps.filter((roadmap) => String(roadmap._id) !== String(activeRoadmap._id))]
      : roadmaps;
    if (!orderedRoadmaps.length) return res.json([]);
    return res.json(orderedRoadmaps.map(normalizeRoadmapShape));
  }
  let roadmaps = byUser(memory.roadmaps || [], req.user.id);
  const activeRoadmap = roadmaps.find((roadmap) => roadmap.status === "active") || roadmaps[0];
  roadmaps = activeRoadmap ? [activeRoadmap, ...roadmaps.filter((roadmap) => String(roadmap.id || roadmap._id) !== String(activeRoadmap.id || activeRoadmap._id))] : [];
  res.json(roadmaps.map(normalizeRoadmapShape));
});

app.post("/api/roadmaps/generate", authRequired, async (req, res) => {
  try {
    const input = { ...req.body, userId: req.user.id };
    const errors = [];
    validateRoadmapGeneratePayload(input, errors);
    if (errors.length) return validationFailed(res, errors);

    const aiResult = await generateRoadmapOptions(input);
    let roadmaps;
    try {
      roadmaps = extractJsonArray(aiResult.reply);
    } catch (_error) {
      return res.status(502).json({ message: "AI returned invalid JSON." });
    }

    if (!Array.isArray(roadmaps) || roadmaps.length !== 3) {
      return res.status(502).json({ message: "AI must return exactly three roadmaps." });
    }

    const outputErrors = roadmaps.flatMap((roadmap, index) => roadmapOptionErrors(roadmap, index));
    if (outputErrors.length) {
      return res.status(502).json({ message: "AI returned invalid roadmap option data.", errors: outputErrors });
    }

    res.json({ roadmaps });
  } catch (error) {
    res.status(500).json({ message: "Roadmap generation failed.", error: error.message });
  }
});

app.post("/api/roadmaps/select", authRequired, async (req, res) => {
  try {
    if (!mongoReady() || !mongoose.isValidObjectId(req.user.id)) {
      return res.status(400).json({ message: "Valid logged-in user is required." });
    }

    const errors = [];
    validateRoadmapSelectPayload(req.body, errors);
    if (errors.length) return validationFailed(res, errors);

    const selectedRoadmap = req.body.roadmap;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    const { localPreview, locked, optional, recommended, lockReason, trackLabel, selectedAt, ...roadmapPayload } = selectedRoadmap;
    const completedRoadmap = {
      ...roadmapPayload,
      userId: req.user.id,
      status: "active",
      generatedBy: selectedRoadmap.generatedBy || "manual",
      version: selectedRoadmap.version || 1,
      generatedAt: selectedRoadmap.generatedAt || new Date(),
    };
    const fullErrors = roadmapOutputErrors(completedRoadmap, 0);
    if (fullErrors.length) {
      return res.status(400).json({ message: "Invalid roadmap data.", errors: fullErrors });
    }

    if (user.activeRoadmapId) {
      await Roadmap.findByIdAndUpdate(user.activeRoadmapId, { status: "archived" }, { runValidators: true });
    }

    const roadmap = await Roadmap.create(completedRoadmap);

    user.activeRoadmapId = roadmap._id;
    await user.save();
    await StudentProfile.findOneAndUpdate(
      { user: req.user.id },
      { goal: completedRoadmap.careerGoal },
      { upsert: true, new: true },
    );

    res.status(201).json({
      message: "Roadmap selected successfully.",
      activeRoadmapId: roadmap._id,
      roadmap,
    });
  } catch (error) {
    res.status(500).json({ message: "Roadmap selection failed.", error: error.message });
  }
});

app.get("/api/roadmaps/:id/progress", authRequired, async (req, res) => {
  const errors = [];
  validateObjectIdOrIdentifier(req.params, "id", errors, { required: true });
  if (errors.length) return validationFailed(res, errors);
  let roadmap;
  if (mongoReady() && mongoose.isValidObjectId(req.user.id) && mongoose.isValidObjectId(req.params.id)) {
    roadmap = await Roadmap.findOne({ _id: req.params.id, ...roadmapOwnerQuery(req.user.id) }).lean();
  } else {
    roadmap = byUser(memory.roadmaps || [], req.user.id).find((item) => String(item._id || item.id) === req.params.id);
  }
  if (!roadmap) return res.status(404).json({ message: "Roadmap not found." });
  roadmap = normalizeRoadmapShape(roadmap);
  res.json({
    roadmapId: roadmap?._id || roadmap?.id,
    overallProgress: roadmap?.overallProgress || 0,
    modules: roadmap?.modules || [],
    nextMilestone: roadmap?.nextMilestone || "Start your first milestone",
  });
});

app.get("/api/courses", async (_req, res) => {
  res.json(await listResource("courses"));
});

app.get("/api/courses/:id", async (req, res) => {
  const errors = [];
  validateObjectIdOrIdentifier(req.params, "id", errors, { required: true });
  if (errors.length) return validationFailed(res, errors);
  const courses = await listResource("courses");
  const course = courses.find((item) => String(item._id || item.id || item.slug) === req.params.id) || courses[0];
  const modules = await listResource("modules", mongoReady() && course?._id ? { course: course._id } : {});
  res.json({ ...course, modules: modules.filter((module) => !module.course || module.course === course.id || String(module.course) === String(course._id)) });
});

app.patch("/api/courses/:courseId/modules/:moduleId", authRequired, requireAdmin, async (req, res) => {
  const errors = [];
  validateObjectIdOrIdentifier(req.params, "courseId", errors, { required: true });
  validateObjectIdOrIdentifier(req.params, "moduleId", errors, { required: true });
  validateAdminPayload("modules", req.body, errors);
  if (errors.length) return validationFailed(res, errors);
  const moduleUpdate = pickFields(req.body, ["title", "description", "order", "lessons", "status", "progress", "resources"]);
  const updated = await updateResource("modules", req.params.moduleId, moduleUpdate);
  res.json(updated || { message: "Module progress updated in demo mode.", ...moduleUpdate });
});

app.post("/api/courses/:courseId/continue", authRequired, async (req, res) => {
  const errors = [];
  validateObjectIdOrIdentifier(req.params, "courseId", errors, { required: true });
  if (errors.length) return validationFailed(res, errors);
  const sourceCourse = memory.courses.find((item) => String(item.id || item._id || item.slug) === String(req.params.courseId)) || memory.courses[0];
  const course = sourceCourse ? { ...sourceCourse } : null;
  const courseId = course?.id || course?._id || req.params.courseId;
  const sourceModule = memory.modules.find((item) => String(item.course) === String(courseId) && item.status !== "completed") || memory.modules.find((item) => String(item.course) === String(courseId)) || memory.modules[0];
  const module = sourceModule ? { ...sourceModule } : null;
  if (module) {
    module.status = module.progress >= 75 ? "completed" : "in-progress";
    module.progress = Math.min(100, Number(module.progress || 0) + 12);
    if (module.progress >= 100) module.status = "completed";
    module.updatedAt = new Date().toISOString();
  }
  if (course) course.progress = Math.min(100, Number(course.progress || 0) + 4);
  let roadmap;
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const roadmapDoc = await Roadmap.findOne(roadmapOwnerQuery(req.user.id)).sort({ createdAt: -1 });
    if (roadmapDoc) {
      advanceRoadmapState(roadmapDoc, 8);
      roadmapDoc.markModified("modules");
      await roadmapDoc.save();
      roadmap = roadmapDoc.toObject();
    }
    await StudentProfile.findOneAndUpdate({ user: req.user.id }, { $inc: { xp: 40 } });
  } else {
    roadmap = memory.roadmaps.find((item) => String(item.user || item.userId) === String(currentUserId(req)));
    if (roadmap) advanceRoadmapState(roadmap, 8);
    const profile = memory.profiles.find((item) => String(item.user) === String(currentUserId(req)));
    if (profile) profile.xp = Number(profile.xp || 0) + 40;
    persistMemory();
  }
  res.json({ message: "Learning progress updated.", course, module, roadmap });
});

app.get("/api/tests", async (_req, res) => {
  res.json(await listResource("tests"));
});

app.get("/api/tests/:id/questions", async (req, res) => {
  const errors = [];
  validateObjectIdOrIdentifier(req.params, "id", errors, { required: true });
  if (errors.length) return validationFailed(res, errors);
  const questions = await listResource("questions");
  res.json(questions.filter((question) => String(question.test) === req.params.id || String(question.test?._id) === req.params.id));
});

app.post("/api/tests/:id/submit", authRequired, async (req, res) => {
  const errors = [];
  validateObjectIdOrIdentifier(req.params, "id", errors, { required: true });
  validateTestSubmissionPayload(req.body, errors);
  if (errors.length) return validationFailed(res, errors);
  const answers = req.body.answers || [];
  const questions = (await listResource("questions")).filter((question) => String(question.test) === req.params.id);
  const correct = answers.filter((answer) => {
    const question = questions.find((item) => String(item.id || item._id) === String(answer.question));
    return question && question.answer === answer.selected;
  }).length;
  const total = questions.length || answers.length || 20;
  const score = questions.length ? Math.round((correct / total) * 100) : Math.round((answers.length / total) * 100);
  const result = await createResource("test-results", {
    user: req.user.id,
    test: req.params.id,
    score,
    percentile: Math.min(99, Math.max(1, score + 5)),
    accuracy: Math.max(0, score - 3),
    timeTakenMinutes: req.body.timeTakenMinutes || 38,
    answers,
    aiSummary: "AI analysis: strong fundamentals. Review slow or incorrect sections before the next weekly test.",
  });
  res.status(201).json(result);
});

app.get("/api/test-results", authRequired, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const results = await TestResult.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
    return res.json(results);
  }
  res.json(byUser(memory.testResults || [], req.user.id));
});

app.get("/api/dsa/progress", authRequired, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const progress = await DSAProgress.findOne({ user: req.user.id }).lean();
    return res.json(progress || {});
  }
  res.json(memory.dsaProgress.find((item) => String(item.user) === String(req.user.id)) || {});
});

app.put("/api/dsa/progress", authRequired, async (req, res) => {
  let current;
  const errors = [];
  validateDsaPayload(req.body, errors);
  if (errors.length) return validationFailed(res, errors);
  const dsaUpdate = pickFields(req.body, ["problemsSolved", "acceptanceRate", "currentStreak", "ranking", "totalProblems", "topics", "recentProblems", "badges"]);
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    current = await DSAProgress.findOneAndUpdate(
      { user: req.user.id },
      { ...dsaUpdate, user: req.user.id, updatedAt: new Date() },
      { new: true, upsert: true, runValidators: true },
    ).lean();
    return res.json(current);
  }
  current = memory.dsaProgress.find((item) => String(item.user) === String(req.user.id));
  if (!current) {
    current = { user: req.user.id };
    memory.dsaProgress.unshift(current);
  }
  Object.assign(current, dsaUpdate, { updatedAt: new Date().toISOString() });
  persistMemory();
  res.json(current);
});

app.post("/api/dsa/solve-challenge", authRequired, (req, res) => {
  const errors = [];
  validateNoDangerousKeys(req.body, errors);
  validateDsaProblem(req.body.problem, errors, "problem");
  if (errors.length) return validationFailed(res, errors);
  const userId = currentUserId(req);
  let current = memory.dsaProgress.find((item) => String(item.user || "") === String(userId));
  if (!current) {
    current = { user: userId, problemsSolved: 0, acceptanceRate: 0, currentStreak: 0, ranking: 5000, totalProblems: 760, topics: [], recentProblems: [], badges: [] };
    memory.dsaProgress.push(current);
  }
  const problem = req.body.problem || {
    title: "Longest Repeating Character Replacement",
    topic: "Sliding Window",
    level: "Medium",
    status: "Solved",
    score: 88,
  };
  current.problemsSolved = Number(current.problemsSolved || 0) + 1;
  current.currentStreak = Number(current.currentStreak || 0) + 1;
  current.acceptanceRate = Math.min(99, Math.round((Number(current.acceptanceRate || 70) * 0.92) + 8));
  current.ranking = Math.max(1, Number(current.ranking || 5000) - 7);
  current.recentProblems = [problem, ...(current.recentProblems || [])].slice(0, 10);
  const topic = (current.topics || []).find((item) => item.name === problem.topic);
  if (topic) topic.solved = Number(topic.solved || 0) + 1;
  else current.topics = [...(current.topics || []), { name: problem.topic, solved: 1, total: 40 }];
  if (current.currentStreak >= 20 && !(current.badges || []).includes("Streak 20")) current.badges.push("Streak 20");
  persistMemory();
  res.json({ message: "Problem solved and DSA progress updated.", progress: current });
});

app.get("/api/resume", authRequired, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const resume = await Resume.findOne({ user: req.user.id }).sort({ createdAt: -1 }).lean();
    return res.json(resume || {});
  }
  res.json(memory.resumes.find((item) => String(item.user) === String(req.user.id)) || {});
});

app.post("/api/resume", authRequired, async (req, res) => {
  const errors = [];
  validateResumePayload(req.body, errors);
  if (errors.length) return validationFailed(res, errors);
  res.status(201).json(await createResource("resumes", { user: req.user.id, ...pickFields(req.body, ["template", "sections", "atsScore", "analysis", "targetRole"]) }));
});

app.put("/api/resume/:id", authRequired, async (req, res) => {
  const errors = [];
  validateObjectIdOrIdentifier(req.params, "id", errors, { required: true });
  validateResumePayload(req.body, errors);
  if (errors.length) return validationFailed(res, errors);
  const updated = await updateOwnedResource("resumes", req.params.id, req.user.id, pickFields(req.body, ["template", "sections", "atsScore", "analysis", "targetRole"]));
  if (!updated) return res.status(403).json({ message: "Forbidden." });
  res.json(updated);
});

app.post("/api/resume/ats-score", authRequired, (req, res) => {
  const errors = [];
  validateString(req.body, "resumeText", errors, { required: true, min: 1, max: 50000, allowEmpty: false });
  if (errors.length) return validationFailed(res, errors);
  const resumeText = `${req.body.resumeText || ""}`.toLowerCase();
  const keywords = ["react", "node", "mongodb", "api", "project", "internship", "dsa"];
  const matches = keywords.filter((keyword) => resumeText.includes(keyword)).length;
  const score = Math.max(68, Math.min(96, 68 + matches * 4));
  res.json({
    score,
    suggestions: [
      "Add measurable impact to project bullets.",
      "Include role-specific technical keywords.",
      "Keep the template clean with clear section headings.",
    ],
  });
});

app.get("/api/projects", authRequired, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const projects = await Project.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
    return res.json(projects);
  }
  res.json(byUser(memory.projects || [], req.user.id));
});

app.post("/api/projects", authRequired, async (req, res) => {
  const errors = [];
  validateProjectPayload(req.body, errors, { create: true });
  if (errors.length) return validationFailed(res, errors);
  res.status(201).json(await createResource("projects", { user: req.user.id, ...pickFields(req.body, ["title", "description", "skills", "status", "links"]) }));
});

app.put("/api/projects/:id", authRequired, async (req, res) => {
  const errors = [];
  validateObjectIdOrIdentifier(req.params, "id", errors, { required: true });
  validateProjectPayload(req.body, errors);
  if (errors.length) return validationFailed(res, errors);
  const updated = await updateOwnedResource("projects", req.params.id, req.user.id, pickFields(req.body, ["title", "description", "skills", "status", "links"]));
  if (!updated) return res.status(403).json({ message: "Forbidden." });
  res.json(updated);
});

app.get("/api/internships", async (_req, res) => {
  res.json(await listResource("internships"));
});

app.post("/api/internships", authRequired, requireAdmin, async (req, res) => {
  const errors = [];
  validateInternshipPayload(req.body, errors);
  if (errors.length) return validationFailed(res, errors);
  res.status(201).json(await createResource("internships", pickFields(req.body, ["role", "company", "domain", "location", "duration", "stipend", "remote", "type", "matchScore", "skills"])));
});

app.post("/api/internships/:id/apply", authRequired, async (req, res) => {
  const errors = [];
  validateObjectIdOrIdentifier(req.params, "id", errors, { required: true });
  if (errors.length) return validationFailed(res, errors);
  const internship = memory.internships.find((item) => item.id === req.params.id);
  if (internship) {
    internship.applicants = internship.applicants || [];
    if (!internship.applicants.includes(req.user.id)) internship.applicants.push(req.user.id);
    persistMemory();
  }
  res.json({ message: "Application submitted.", internshipId: req.params.id, resumeMatchScore: internship?.matchScore || 88 });
});

app.get("/api/hackathons", async (_req, res) => {
  res.json(await listResource("hackathons"));
});

app.post("/api/hackathons", authRequired, requireAdmin, async (req, res) => {
  const errors = [];
  validateHackathonPayload(req.body, errors);
  if (errors.length) return validationFailed(res, errors);
  res.status(201).json(await createResource("hackathons", pickFields(req.body, ["title", "domain", "duration", "prize", "startsAt", "mode", "skills"])));
});

app.post("/api/hackathons/:id/register", authRequired, (req, res) => {
  const errors = [];
  validateObjectIdOrIdentifier(req.params, "id", errors, { required: true });
  if (errors.length) return validationFailed(res, errors);
  const hackathon = memory.hackathons.find((item) => item.id === req.params.id);
  if (hackathon) {
    hackathon.registrations = hackathon.registrations || [];
    if (!hackathon.registrations.includes(req.user.id)) hackathon.registrations.push(req.user.id);
    persistMemory();
  }
  res.json({ message: "Hackathon registration confirmed.", hackathonId: req.params.id, user: req.user.id });
});

app.get("/api/certificates", authRequired, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const certificates = await Certificate.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
    return res.json(certificates);
  }
  res.json(byUser(memory.certificates || [], req.user.id));
});

app.post("/api/certificates", authRequired, async (req, res) => {
  const errors = [];
  validateCertificatePayload(req.body, errors);
  if (errors.length) return validationFailed(res, errors);
  res.status(201).json(await createResource("certificates", { user: req.user.id, ...pickFields(req.body, ["title", "category", "issuedAt", "status", "credentialId", "badgeUrl"]) }));
});

app.post("/api/certificates/:id/share", authRequired, async (req, res) => {
  const errors = [];
  validateObjectIdOrIdentifier(req.params, "id", errors, { required: true });
  if (errors.length) return validationFailed(res, errors);
  const certificate = await findOwnedResource("certificates", req.params.id, req.user.id);
  if (!certificate) return res.status(403).json({ message: "Forbidden." });
  if (!mongoReady()) {
    certificate.shareCount = Number(certificate.shareCount || 0) + 1;
    persistMemory();
  }
  res.json({ message: "Share card generated.", shareUrl: `${req.protocol}://${req.get("host")}/certificate/${req.params.id}` });
});

app.post("/api/ai/counselling", authOptional, async (req, res) => {
  const errors = [];
  validateNoDangerousKeys(req.body, errors);
  validateEnum(req.body, "step", ["education", "skills"], errors);
  validateString(req.body, "education", errors, { max: 800 });
  validateString(req.body, "skills", errors, { max: 800 });
  if (errors.length) return validationFailed(res, errors);
  const step = String(req.body.step || "education").trim();
  const education = String(req.body.education || "").trim();
  const skills = String(req.body.skills || "").trim();
  if (!["education", "skills"].includes(step)) return res.status(400).json({ message: "Invalid counselling step." });
  if (step === "education" && !education) return res.status(400).json({ message: "Education/current status is required." });
  if (education.length > 800 || skills.length > 800) return res.status(400).json({ message: "Counselling answer is too long." });
  const result = await generateCounsellingReply(step, { education, skills });
  res.json(result);
});
app.get("/api/ai-mentor/chat", authRequired, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const chats = await AIMentorChat.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(25).lean();
    return res.json(chats);
  }
  res.json(byUser(memory.chats || [], req.user.id).slice(0, 25));
});

app.post("/api/ai-mentor/chat", authRequired, async (req, res) => {
  const errors = [];
  validateNoDangerousKeys(req.body, errors);
  validateString(req.body, "message", errors, { required: true, min: 1, max: 2000, allowEmpty: false });
  validateString(req.body, "topic", errors, { max: 120 });
  if (errors.length) return validationFailed(res, errors);
  const message = String(req.body.message || "").trim();
  const plan = await getUserPlan(req.user.id);
  const used = await countMentorChats(req.user.id);
  if (!mentorLimitTemporarilyDisabled && !isPremiumPlan(plan) && used >= mentorFreeChatLimit) {
    return res.status(402).json({
      code: "MENTOR_LIMIT_REACHED",
      message: `Free AI Mentor limit reached. You used ${mentorFreeChatLimit}/${mentorFreeChatLimit} chats. Upgrade to Pro for unlimited mentor access.`,
      used,
      limit: mentorFreeChatLimit,
      plan,
      upgradeUrl: "#pricing",
    });
  }
  const mentor = await generateMentorReply(message, req.user.id);
  const chat = await createResource("ai-mentor", {
    user: req.user.id,
    topic: req.body.topic || detectMentorTopic(message),
    messages: [
      { role: "user", content: message, createdAt: new Date() },
      { role: "assistant", content: mentor.reply, createdAt: new Date() },
    ],
    metadata: {
      provider: mentor.provider,
      model: mentor.model,
      fallback: mentor.fallback,
    },
  });
  res.status(201).json({
    reply: mentor.reply,
    chat,
    provider: mentor.provider,
    model: mentor.model,
    fallback: mentor.fallback,
    usage: {
      used: used + 1,
      limit: mentorFreeChatLimit,
      remaining: isPremiumPlan(plan) ? null : Math.max(0, mentorFreeChatLimit - used - 1),
      plan,
    },
  });
});

app.get("/api/notifications", authRequired, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
    return res.json(notifications);
  }
  res.json(byUser(memory.notifications || [], req.user.id));
});

app.patch("/api/notifications/:id/read", authRequired, async (req, res) => {
  const errors = [];
  validateObjectIdOrIdentifier(req.params, "id", errors, { required: true });
  if (errors.length) return validationFailed(res, errors);
  const updated = await updateOwnedResource("notifications", req.params.id, req.user.id, { read: true });
  if (!updated) return res.status(403).json({ message: "Forbidden." });
  res.json(updated);
});

app.get("/api/admin/summary", authRequired, requireAdmin, async (_req, res) => {
  const activeAdmins = mongoReady()
    ? await User.countDocuments({ role: "admin" })
    : (memory.users || []).filter((user) => user.role === "admin").length;
  res.json({
    users: (await listResource("users")).length,
    courses: (await listResource("courses")).length,
    roadmaps: (await listResource("roadmaps")).length,
    tests: (await listResource("tests")).length,
    internships: (await listResource("internships")).length,
    hackathons: (await listResource("hackathons")).length,
    certificates: (await listResource("certificates")).length,
    notifications: (await listResource("notifications")).length,
    admins: activeAdmins,
    reports: memory.reports.length,
  });
});

app.get("/api/admin/:resource", authRequired, requireAdmin, async (req, res) => {
  const errors = [];
  validateAllowedResource(req.params.resource, errors);
  if (errors.length) return validationFailed(res, errors);
  const data = await listResource(req.params.resource);
  if (!data) return res.status(404).json({ message: "Unknown admin resource." });
  res.json(data);
});

app.post("/api/admin/:resource", authRequired, requireAdmin, async (req, res) => {
  const errors = [];
  validateAllowedResource(req.params.resource, errors);
  validateAdminPayload(req.params.resource, req.body, errors);
  if (errors.length) return validationFailed(res, errors);
  const item = await createResource(req.params.resource, req.body);
  if (!item) return res.status(404).json({ message: "Unknown admin resource." });
  res.status(201).json(item);
});

app.put("/api/admin/:resource/:id", authRequired, requireAdmin, async (req, res) => {
  const errors = [];
  validateAllowedResource(req.params.resource, errors);
  validateObjectIdOrIdentifier(req.params, "id", errors, { required: true });
  validateAdminPayload(req.params.resource, req.body, errors);
  if (errors.length) return validationFailed(res, errors);
  const item = await updateResource(req.params.resource, req.params.id, req.body);
  if (!item) return res.status(404).json({ message: "Resource item not found." });
  res.json(item);
});

app.delete("/api/admin/:resource/:id", authRequired, requireAdmin, async (req, res) => {
  const errors = [];
  validateAllowedResource(req.params.resource, errors);
  validateObjectIdOrIdentifier(req.params, "id", errors, { required: true });
  if (errors.length) return validationFailed(res, errors);
  const item = await deleteResource(req.params.resource, req.params.id);
  if (!item) return res.status(404).json({ message: "Resource item not found." });
  res.json({ message: "Deleted.", item });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

async function start() {
  await connectDatabase();
  app.listen(port, () => {
    console.log(`Studox.ai running at http://localhost:${port}`);
  });
}

start();
