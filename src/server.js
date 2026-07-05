require("dotenv").config();

const path = require("path");
const fs = require("fs");
const dns = require("dns").promises;
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const connectDatabase = require("./config/db");
const { sendOtpEmail, sendWelcomeEmail } = require("./config/mailer");
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
const jwtSecret = process.env.JWT_SECRET || "studox_local_secret";
const storePath = path.join(__dirname, "data", "runtime-store.json");
const demoPasswordHash = "$2a$10$VlFtbubhwtdXCVX6ORgsp.BlMNNQdHoI.EOMqVpxiQCobqBERtJ6m";
const memory = loadMemoryStore();
ensureDemoAccount();

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

function ensureDemoAccount() {
  if (process.env.NODE_ENV === "production") return;
  const demoUser = memory.users?.find((user) => user.email === "aarav@studox.ai");
  if (demoUser && demoUser.password !== demoPasswordHash) {
    demoUser.password = demoPasswordHash;
    persistMemory();
  }
}

function mongoReady() {
  return mongoose.connection.readyState === 1;
}

function signToken(user) {
  const id = user._id || user.id || "user_demo";
  return jwt.sign({ id, email: user.email, role: user.role || "student" }, jwtSecret, { expiresIn: "7d" });
}

function publicUser(user) {
  if (!user) return null;
  const raw = user.toObject ? user.toObject() : user;
  const { password, resetOtp, resetOtpExpires, ...safe } = raw;
  return safe;
}

function authOptional(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    req.user = { id: "user_demo", email: "aarav@studox.ai", role: "student" };
    return next();
  }
  try {
    req.user = jwt.verify(token, jwtSecret);
  } catch (_error) {
    req.user = { id: "user_demo", email: "aarav@studox.ai", role: "student" };
  }
  next();
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Please login to continue." });
  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Session expired. Please login again." });
  }
}

function findMemoryUser(emailOrPhone) {
  return memory.users.find((user) => user.email === emailOrPhone || user.phone === emailOrPhone);
}

function currentUserId(req) {
  return req.user?.id || "user_demo";
}

function byUser(list, userId) {
  return (list || []).filter((item) => String(item.user || item.userId || "user_demo") === String(userId));
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

async function validateEmailDomain(email) {
  const normalized = normalizeEmail(email);
  if (!hasValidEmailFormat(normalized)) {
    return { ok: false, message: "Please enter a valid email address." };
  }

  const domain = normalized.split("@")[1];
  const typoDomains = {
    "gamil.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gmai.com": "gmail.com",
    "gnail.com": "gmail.com",
    "gmail.co": "gmail.com",
    "yaho.com": "yahoo.com",
    "yahoo.co": "yahoo.com",
    "outlok.com": "outlook.com",
    "hotmial.com": "hotmail.com",
  };

  if (typoDomains[domain]) {
    return { ok: false, message: `Email domain looks wrong. Did you mean ${typoDomains[domain]}?` };
  }

  try {
    const mx = await dns.resolveMx(domain);
    if (!mx.length) return { ok: false, message: "This email domain cannot receive emails." };
    return { ok: true };
  } catch (_error) {
    return { ok: false, message: "This email domain does not exist or cannot receive emails." };
  }
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

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, phone, password, goal, field } = req.body;
    const email = normalizeEmail(req.body.email);
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }
    const emailCheck = await validateEmailDomain(email);
    if (!emailCheck.ok) {
      return res.status(400).json({ message: emailCheck.message });
    }

    const hashed = await bcrypt.hash(password, 10);
    let user;
    let createdUserId;

    if (mongoReady()) {
      const exists = await User.findOne({ email });
      if (exists) return res.status(409).json({ message: "Account already exists. Please login instead." });
      user = await User.create({ name, email, phone, password: hashed });
      createdUserId = user._id;
      await StudentProfile.create({
        user: user._id,
        username: email.split("@")[0],
        goal,
        field,
        skills: [],
        profileCompletion: 42,
      });
      await UserSettings.create({ user: user._id });
    } else {
      const exists = memory.users.find((item) => item.email === email);
      if (exists) return res.status(409).json({ message: "Account already exists. Please login instead." });
      user = { id: memoryId("user"), name, email, phone, password: hashed, role: "student" };
      memory.users.push(user);
      memory.profiles.push({
        user: user.id,
        username: email.split("@")[0],
        goal,
        field,
        skills: ["HTML", "CSS"],
        level: "Beginner",
        xp: 250,
        profileCompletion: 42,
        streak: 1,
      });
      memory.settings.push({ user: user.id, theme: "system", accentColor: "#2563eb", language: "English" });
      memory.roadmaps.push({
        id: memoryId("roadmap"),
        user: user.id,
        title: `${goal || "Career"} Roadmap`,
        currentLevel: "Beginner",
        overallProgress: 8,
        timeToGoalWeeks: 16,
        skillsLearned: 2,
        nextMilestone: "Complete foundations",
        modules: [
          { title: "Foundations", status: "in-progress", progress: 8, description: "Start HTML, CSS, JavaScript and Git.", skills: ["HTML", "CSS"] },
          { title: "Core Skills", status: "upcoming", progress: 0, description: "Learn the core stack for your goal.", skills: [] },
        ],
      });
      persistMemory();
    }

    let welcomeEmailSent = false;
    try {
      await sendWelcomeEmail({ to: email, name, goal: goal || "your learning goal" });
      welcomeEmailSent = true;
    } catch (error) {
      const emailWarning = error.code === "EMAIL_NOT_CONFIGURED"
        ? "Signup email is not configured. Please contact admin."
        : "We could not send email to this address. Please check your email and try again.";
      console.warn(emailWarning);
      console.warn(error.message);
      if (mongoReady() && createdUserId) {
        await Promise.all([
          User.findByIdAndDelete(createdUserId),
          StudentProfile.deleteMany({ user: createdUserId }),
          UserSettings.deleteMany({ user: createdUserId }),
          Roadmap.deleteMany({ user: createdUserId }),
        ]);
      } else {
        removeMemoryUserCascade(user.id);
      }
      return res.status(400).json({ message: emailWarning });
    }

    res.status(201).json({
      message: welcomeEmailSent ? "Account created. Welcome email sent." : "Account created.",
      token: signToken(user),
      user: publicUser(user),
      welcomeEmailSent,
    });
  } catch (error) {
    res.status(500).json({ message: "Signup failed.", error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const emailOrPhone = req.body.email || req.body.phone;
    const password = req.body.password || "";
    if (!emailOrPhone || !password) return res.status(400).json({ message: "Email or phone and password are required." });

    let user;
    if (mongoReady()) user = await User.findOne({ $or: [{ email: emailOrPhone }, { phone: emailOrPhone }] });
    else user = findMemoryUser(emailOrPhone);

    if (!user) return res.status(404).json({ message: "Account not found." });
    const valid = await bcrypt.compare(password, user.password || "");
    if (!valid) return res.status(401).json({ message: "Invalid password." });

    if (mongoReady() && user._id) await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
    res.json({ message: "Logged in successfully.", token: signToken(user), user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Login failed.", error: error.message });
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

app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required." });
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpExpiresAt = new Date(Date.now() + Number(process.env.OTP_EXPIRY_MINUTES || 10) * 60 * 1000);
  let user;

  if (mongoReady()) {
    user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "No account found with this email." });
    user.resetOtp = otp;
    user.resetOtpExpires = otpExpiresAt;
    await user.save();
  } else {
    user = findMemoryUser(email);
    if (!user) return res.status(404).json({ message: "No account found with this email." });
    user.resetOtp = otp;
    user.resetOtpExpires = otpExpiresAt.toISOString();
    persistMemory();
  }

  try {
    await sendOtpEmail({ to: email, otp, name: user.name });
    res.json({ message: "OTP sent to your registered email." });
  } catch (error) {
    res.status(error.code === "EMAIL_NOT_CONFIGURED" ? 500 : 502).json({
      message: error.code === "EMAIL_NOT_CONFIGURED"
        ? "Email OTP is not configured. Add SMTP settings in .env."
        : "Could not send OTP email. Please check SMTP settings.",
      error: error.message,
    });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { email, otp, password } = req.body;
  if (!email || !otp || !password) return res.status(400).json({ message: "Email, OTP and new password are required." });
  if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
  const hashed = await bcrypt.hash(password, 10);

  if (mongoReady()) {
    const user = await User.findOne({ email, resetOtp: otp, resetOtpExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: "Invalid or expired OTP." });
    user.password = hashed;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();
  } else {
    const user = findMemoryUser(email);
    const expiresAt = user?.resetOtpExpires ? new Date(user.resetOtpExpires).getTime() : 0;
    if (!user || user.resetOtp !== otp || expiresAt < Date.now()) return res.status(400).json({ message: "Invalid or expired OTP." });
    user.password = hashed;
    delete user.resetOtp;
    delete user.resetOtpExpires;
    persistMemory();
  }

  res.json({ message: "Password reset successfully." });
});

app.get("/api/profile", authOptional, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const profile = await StudentProfile.findOne({ user: req.user.id }).lean();
    if (profile) return res.json(profile);
  }
  res.json(memory.profiles.find((profile) => profile.user === req.user.id) || memory.profiles[0]);
});

app.put("/api/profile", authOptional, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const profile = await StudentProfile.findOneAndUpdate({ user: req.user.id }, req.body, { new: true, upsert: true }).lean();
    return res.json(profile);
  }
  const profile = memory.profiles.find((item) => item.user === req.user.id) || memory.profiles[0];
  Object.assign(profile, req.body, { updatedAt: new Date().toISOString() });
  if (req.body.name || req.body.email || req.body.phone) {
    const user = memory.users.find((item) => item.id === req.user.id);
    if (user) Object.assign(user, { name: req.body.name || user.name, email: req.body.email || user.email, phone: req.body.phone || user.phone });
  }
  persistMemory();
  res.json(profile);
});

app.get("/api/settings", authOptional, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const settings = await UserSettings.findOne({ user: req.user.id }).lean();
    if (settings) return res.json(settings);
  }
  res.json(memory.settings.find((settings) => settings.user === req.user.id) || memory.settings[0]);
});

app.put("/api/settings", authOptional, async (req, res) => {
  if (mongoReady() && mongoose.isValidObjectId(req.user.id)) {
    const settings = await UserSettings.findOneAndUpdate({ user: req.user.id }, req.body, { new: true, upsert: true }).lean();
    return res.json(settings);
  }
  const settings = memory.settings.find((item) => item.user === req.user.id) || memory.settings[0];
  Object.assign(settings, req.body, { updatedAt: new Date().toISOString() });
  persistMemory();
  res.json(settings);
});

app.get("/api/dashboard/stats", authOptional, (req, res) => {
  const userId = currentUserId(req);
  const profile = memory.profiles.find((item) => String(item.user) === String(userId)) || memory.profiles[0] || {};
  const roadmap = memory.roadmaps.find((item) => String(item.user || "user_demo") === String(userId)) || memory.roadmaps[0] || {};
  const userResults = byUser(memory.testResults, userId);
  const userProjects = byUser(memory.projects, userId);
  const userCertificates = byUser(memory.certificates, userId);
  const dsa = memory.dsaProgress.find((item) => String(item.user || "user_demo") === String(userId)) || memory.dsaProgress[0] || {};
  const appliedInternships = (memory.internships || []).filter((item) => (item.applicants || []).includes(userId));
  const registeredHackathons = (memory.hackathons || []).filter((item) => (item.registrations || []).includes(userId));
  const skills = new Set([...(profile.skills || []), ...((roadmap.modules || []).flatMap((module) => module.progress > 40 ? module.skills || [] : []))]);
  const overallProgress = Math.round(roadmap.overallProgress || average((roadmap.modules || []).map((module) => module.progress)) || profile.profileCompletion || 0);
  const xpPoints = Number(profile.xp || 0) + userResults.length * 120 + Number(dsa.problemsSolved || 0) * 8 + userProjects.length * 90 + userCertificates.length * 150;
  res.json({
    overallProgress,
    testsCompleted: userResults.length,
    skillsMastered: skills.size,
    xpPoints,
    learningTimeHours: Math.round(18 + userResults.length * 1.5 + Number(dsa.problemsSolved || 0) / 8),
    studyStreak: dsa.currentStreak || profile.streak || 0,
    applications: appliedInternships.length,
    hackathonRegistrations: registeredHackathons.length,
    projectCount: userProjects.length,
    certificatesEarned: userCertificates.length,
    upcomingTests: memory.tests,
    recentActivity: buildActivity(userId),
    recommendedCourses: memory.courses,
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

app.get("/api/roadmaps", authOptional, async (_req, res) => {
  res.json(await listResource("roadmaps"));
});

app.get("/api/roadmaps/:id/progress", authOptional, async (req, res) => {
  const roadmaps = await listResource("roadmaps");
  const roadmap = roadmaps.find((item) => String(item._id || item.id) === req.params.id) || roadmaps[0];
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
  const courses = await listResource("courses");
  const course = courses.find((item) => String(item._id || item.id || item.slug) === req.params.id) || courses[0];
  const modules = await listResource("modules", mongoReady() && course?._id ? { course: course._id } : {});
  res.json({ ...course, modules: modules.filter((module) => !module.course || module.course === course.id || String(module.course) === String(course._id)) });
});

app.patch("/api/courses/:courseId/modules/:moduleId", authOptional, async (req, res) => {
  const updated = await updateResource("modules", req.params.moduleId, req.body);
  res.json(updated || { message: "Module progress updated in demo mode.", ...req.body });
});

app.post("/api/courses/:courseId/continue", authOptional, async (req, res) => {
  const course = memory.courses.find((item) => String(item.id || item._id || item.slug) === String(req.params.courseId)) || memory.courses[0];
  const courseId = course?.id || course?._id || req.params.courseId;
  const module = memory.modules.find((item) => String(item.course) === String(courseId) && item.status !== "completed") || memory.modules.find((item) => String(item.course) === String(courseId)) || memory.modules[0];
  if (module) {
    module.status = module.progress >= 75 ? "completed" : "in-progress";
    module.progress = Math.min(100, Number(module.progress || 0) + 12);
    if (module.progress >= 100) module.status = "completed";
    module.updatedAt = new Date().toISOString();
  }
  if (course) course.progress = Math.min(100, Number(course.progress || 0) + 4);
  const roadmap = memory.roadmaps.find((item) => String(item.user || "user_demo") === String(currentUserId(req))) || memory.roadmaps[0];
  if (roadmap) {
    roadmap.overallProgress = Math.min(100, Number(roadmap.overallProgress || 0) + 3);
    const activeModule = (roadmap.modules || []).find((item) => item.status === "in-progress" || item.status === "active") || roadmap.modules?.[0];
    if (activeModule) {
      activeModule.progress = Math.min(100, Number(activeModule.progress || 0) + 8);
      if (activeModule.progress >= 100) activeModule.status = "completed";
    }
    roadmap.updatedAt = new Date().toISOString();
  }
  const profile = memory.profiles.find((item) => String(item.user) === String(currentUserId(req))) || memory.profiles[0];
  if (profile) profile.xp = Number(profile.xp || 0) + 40;
  persistMemory();
  res.json({ message: "Learning progress updated.", course, module });
});

app.get("/api/tests", async (_req, res) => {
  res.json(await listResource("tests"));
});

app.get("/api/tests/:id/questions", async (req, res) => {
  const questions = await listResource("questions");
  res.json(questions.filter((question) => String(question.test) === req.params.id || String(question.test?._id) === req.params.id));
});

app.post("/api/tests/:id/submit", authOptional, async (req, res) => {
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

app.get("/api/test-results", authOptional, async (_req, res) => {
  res.json(await listResource("test-results"));
});

app.get("/api/dsa/progress", authOptional, async (_req, res) => {
  const list = await listResource("dsa");
  res.json(list[0]);
});

app.put("/api/dsa/progress", authOptional, async (req, res) => {
  const current = memory.dsaProgress[0];
  Object.assign(current, req.body, { updatedAt: new Date().toISOString() });
  persistMemory();
  res.json(current);
});

app.post("/api/dsa/solve-challenge", authOptional, (req, res) => {
  const userId = currentUserId(req);
  let current = memory.dsaProgress.find((item) => String(item.user || "user_demo") === String(userId));
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

app.get("/api/resume", authOptional, async (_req, res) => {
  const list = await listResource("resumes");
  res.json(list[0]);
});

app.post("/api/resume", authOptional, async (req, res) => {
  res.status(201).json(await createResource("resumes", { user: req.user.id, ...req.body }));
});

app.put("/api/resume/:id", authOptional, async (req, res) => {
  res.json(await updateResource("resumes", req.params.id, req.body));
});

app.post("/api/resume/ats-score", authOptional, (req, res) => {
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

app.get("/api/projects", authOptional, async (_req, res) => {
  res.json(await listResource("projects"));
});

app.post("/api/projects", authOptional, async (req, res) => {
  res.status(201).json(await createResource("projects", { user: req.user.id, ...req.body }));
});

app.put("/api/projects/:id", authOptional, async (req, res) => {
  res.json(await updateResource("projects", req.params.id, req.body));
});

app.get("/api/internships", async (_req, res) => {
  res.json(await listResource("internships"));
});

app.post("/api/internships", authOptional, async (req, res) => {
  res.status(201).json(await createResource("internships", req.body));
});

app.post("/api/internships/:id/apply", authOptional, async (req, res) => {
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

app.post("/api/hackathons", authOptional, async (req, res) => {
  res.status(201).json(await createResource("hackathons", req.body));
});

app.post("/api/hackathons/:id/register", authOptional, (req, res) => {
  const hackathon = memory.hackathons.find((item) => item.id === req.params.id);
  if (hackathon) {
    hackathon.registrations = hackathon.registrations || [];
    if (!hackathon.registrations.includes(req.user.id)) hackathon.registrations.push(req.user.id);
    persistMemory();
  }
  res.json({ message: "Hackathon registration confirmed.", hackathonId: req.params.id, user: req.user.id });
});

app.get("/api/certificates", authOptional, async (_req, res) => {
  res.json(await listResource("certificates"));
});

app.post("/api/certificates", authOptional, async (req, res) => {
  res.status(201).json(await createResource("certificates", { user: req.user.id, ...req.body }));
});

app.post("/api/certificates/:id/share", authOptional, (req, res) => {
  const certificate = memory.certificates.find((item) => item.id === req.params.id);
  if (certificate) {
    certificate.shareCount = Number(certificate.shareCount || 0) + 1;
    persistMemory();
  }
  res.json({ message: "Share card generated.", shareUrl: `${req.protocol}://${req.get("host")}/certificate/${req.params.id}` });
});

app.get("/api/ai-mentor/chat", authOptional, async (_req, res) => {
  res.json(await listResource("ai-mentor"));
});

app.post("/api/ai-mentor/chat", authOptional, async (req, res) => {
  const message = req.body.message || "";
  const lower = message.toLowerCase();
  let reply = `For "${message}", start with the core definition, then do one guided example and one independent practice task. I saved this as a mentor conversation so you can review it later.`;
  if (lower.includes("resume")) reply = "Resume improvement plan: add role keywords, quantify project impact, keep sections ATS-friendly, and move strongest MERN/DSA projects near the top.";
  if (lower.includes("career") || lower.includes("internship")) reply = "Career plan: pick one target role, finish the matching roadmap modules, publish two projects, improve ATS score above 85, then apply to 5 matched internships.";
  if (lower.includes("code") || lower.includes("bug")) reply = "Code help plan: isolate the failing input, read the error, check data shape, then write a small test case before changing the implementation.";
  const chat = await createResource("ai-mentor", {
    user: req.user.id,
    topic: req.body.topic || "general",
    messages: [
      { role: "user", content: message, createdAt: new Date() },
      { role: "assistant", content: reply, createdAt: new Date() },
    ],
  });
  res.status(201).json({ reply, chat });
});

app.get("/api/notifications", authOptional, async (_req, res) => {
  res.json(await listResource("notifications"));
});

app.patch("/api/notifications/:id/read", authOptional, async (req, res) => {
  res.json(await updateResource("notifications", req.params.id, { read: true }));
});

app.get("/api/admin/summary", authOptional, async (_req, res) => {
  res.json({
    users: (await listResource("users")).length,
    courses: (await listResource("courses")).length,
    roadmaps: (await listResource("roadmaps")).length,
    tests: (await listResource("tests")).length,
    internships: (await listResource("internships")).length,
    hackathons: (await listResource("hackathons")).length,
    certificates: (await listResource("certificates")).length,
    reports: memory.reports.length,
  });
});

app.get("/api/admin/:resource", authOptional, async (req, res) => {
  const data = await listResource(req.params.resource);
  if (!data) return res.status(404).json({ message: "Unknown admin resource." });
  res.json(data);
});

app.post("/api/admin/:resource", authOptional, async (req, res) => {
  const item = await createResource(req.params.resource, req.body);
  if (!item) return res.status(404).json({ message: "Unknown admin resource." });
  res.status(201).json(item);
});

app.put("/api/admin/:resource/:id", authOptional, async (req, res) => {
  const item = await updateResource(req.params.resource, req.params.id, req.body);
  if (!item) return res.status(404).json({ message: "Resource item not found." });
  res.json(item);
});

app.delete("/api/admin/:resource/:id", authOptional, async (req, res) => {
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
