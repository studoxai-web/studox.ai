require("dotenv").config();

const path = require("path");
const fs = require("fs");
const dns = require("dns").promises;
const crypto = require("crypto");
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
const mentorFreeChatLimit = Number(process.env.MENTOR_FREE_CHAT_LIMIT || 10);
const mentorLimitTemporarilyDisabled = true;
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || "";
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
const paymentPlans = {
  pro: { name: "Pro", amount: 35300 },
  elite: { name: "Elite", amount: 70700 },
};
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
    const { name, phone, password, field } = req.body;
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
        field,
        skills: [],
        level: "Beginner",
        xp: 0,
        profileCompletion: 0,
        streak: 0,
      });
      await UserSettings.create({ user: user._id });
    } else {
      const exists = memory.users.find((item) => item.email === email);
      if (exists) return res.status(409).json({ message: "Account already exists. Please login instead." });
      user = { id: memoryId("user"), name, email, phone, password: hashed, role: "student", plan: "free" };
      memory.users.push(user);
      memory.profiles.push({
        user: user.id,
        username: email.split("@")[0],
        field,
        skills: [],
        level: "Beginner",
        xp: 0,
        profileCompletion: 0,
        streak: 0,
      });
      memory.settings.push({ user: user.id, theme: "system", accentColor: "#2563eb", language: "English" });
      persistMemory();
    }

    let welcomeEmailSent = false;
    let emailWarning = "";
    try {
      await sendWelcomeEmail({ to: email, name, goal: "your learning goal" });
      welcomeEmailSent = true;
    } catch (error) {
      emailWarning = error.code === "EMAIL_NOT_CONFIGURED"
        ? "Signup email is not configured. Please contact admin."
        : "We could not send welcome email right now. Account was created.";
      console.warn(emailWarning);
      console.warn(error.message);
    }

    res.status(201).json({
      message: welcomeEmailSent ? "Account created. Welcome email sent." : "Account created.",
      token: signToken(user),
      user: publicUser(user),
      welcomeEmailSent,
      emailWarning,
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
  const plan = String(req.body.plan || "").toLowerCase();
  if (!["pro", "elite"].includes(plan)) {
    return res.status(400).json({ message: "Please choose a valid premium plan." });
  }

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
  const plan = String(req.body.plan || "").toLowerCase();
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;

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

  const plan = String(req.body.plan || "").toLowerCase();
  if (!["pro", "elite"].includes(plan)) {
    return res.status(400).json({ message: "Please choose a valid premium plan." });
  }

  const user = await activateUserPlan(req.user.id, plan);
  if (!user) return res.status(404).json({ message: "User not found." });

  res.json({
    message: `${plan === "elite" ? "Elite" : "Pro"} plan activated in local demo mode.`,
    plan,
    user: publicUser(user),
    subscription: { status: "active", startedAt: new Date().toISOString() },
  });
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

app.post("/api/roadmaps/generate", authOptional, async (req, res) => {
  try {
    const input = { ...req.body, userId: req.user.id };
    const errors = roadmapInputErrors(input);
    if (errors.length) return res.status(400).json({ message: "Invalid roadmap input.", errors });

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

    const selectedRoadmap = req.body.roadmap;
    if (!selectedRoadmap || typeof selectedRoadmap !== "object" || Array.isArray(selectedRoadmap)) {
      return res.status(400).json({ message: "Roadmap is required." });
    }
    const optionErrors = roadmapOptionErrors(selectedRoadmap, 0);
    if (optionErrors.length) {
      return res.status(400).json({ message: "Invalid roadmap option.", errors: optionErrors });
    }

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
  const courses = await listResource("courses");
  const course = courses.find((item) => String(item._id || item.id || item.slug) === req.params.id) || courses[0];
  const modules = await listResource("modules", mongoReady() && course?._id ? { course: course._id } : {});
  res.json({ ...course, modules: modules.filter((module) => !module.course || module.course === course.id || String(module.course) === String(course._id)) });
});

app.patch("/api/courses/:courseId/modules/:moduleId", authRequired, async (req, res) => {
  const updated = await updateResource("modules", req.params.moduleId, req.body);
  res.json(updated || { message: "Module progress updated in demo mode.", ...req.body });
});

app.post("/api/courses/:courseId/continue", authRequired, async (req, res) => {
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

app.post("/api/ai/counselling", authOptional, async (req, res) => {
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
  const message = String(req.body.message || "").trim();
  if (!message) return res.status(400).json({ message: "Message is required." });
  if (message.length > 2000) return res.status(400).json({ message: "Message is too long. Keep it under 2000 characters." });
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
