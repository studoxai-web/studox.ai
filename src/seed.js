require("dotenv").config();

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDatabase = require("./config/db");
const {
  User,
  StudentProfile,
  Roadmap,
  Course,
  Module,
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
} = require("./models");

async function seed() {
  const connected = await connectDatabase();
  if (!connected) {
    console.log("Set MONGO_URI before running npm run seed.");
    process.exit(0);
  }

  await Promise.all([
    User.deleteMany({}),
    StudentProfile.deleteMany({}),
    Roadmap.deleteMany({}),
    Course.deleteMany({}),
    Module.deleteMany({}),
    Test.deleteMany({}),
    Question.deleteMany({}),
    TestResult.deleteMany({}),
    DSAProgress.deleteMany({}),
    Resume.deleteMany({}),
    Project.deleteMany({}),
    Internship.deleteMany({}),
    Hackathon.deleteMany({}),
    Certificate.deleteMany({}),
    AIMentorChat.deleteMany({}),
    Notification.deleteMany({}),
    UserSettings.deleteMany({}),
    Admin.deleteMany({}),
  ]);

  const password = await bcrypt.hash("password123", 10);
  const user = await User.create({
    name: "Aarav Sharma",
    email: "aarav@studox.ai",
    phone: "+91 98765 43210",
    password,
    role: "student",
  });

  await Admin.create({
    name: "Studox Admin",
    email: "admin@studox.ai",
    password,
    permissions: ["users", "courses", "roadmaps", "tests", "internships", "hackathons", "certificates", "reports"],
  });

  await StudentProfile.create({
    user: user._id,
    username: "aarav.dev",
    goal: "Full Stack Developer",
    field: "Computer Science",
    college: "Studox Institute of Technology",
    branch: "Computer Science",
    bio: "Student developer focused on full stack engineering, AI products and DSA interview readiness.",
    skills: ["React", "Node.js", "MongoDB", "DSA"],
    education: [{ title: "B.Tech", institution: "Studox Institute of Technology", year: "2026", score: "8.8 CGPA" }],
    level: "Intermediate",
    xp: 12840,
    profileCompletion: 86,
    streak: 18,
  });

  await UserSettings.create({
    user: user._id,
    theme: "system",
    accentColor: "#2563eb",
    language: "English",
    studyPreferences: { reminders: true, weeklyTests: true, dsaChallenges: true },
    notifications: { email: true, push: true, mentor: true, career: true },
    privacy: { profileVisible: true, recruiterVisible: true },
    connectedAccounts: { google: true, github: false, linkedin: false },
  });

  await Roadmap.create({
    user: user._id,
    userId: user._id,
    title: "Full Stack Developer Roadmap",
    currentLevel: "Intermediate",
    overallProgress: 72,
    timeToGoalWeeks: 12,
    skillsLearned: 36,
    nextMilestone: "React application basics",
    careerGoal: "Full Stack Developer",
    summary: "A practical roadmap for building production-ready MERN applications with projects, testing and deployment basics.",
    estimatedDurationWeeks: 12,
    difficulty: "intermediate",
    status: "active",
    generatedBy: "seed",
    version: 1,
    generatedAt: new Date(),
    modules: [
      { title: "Frontend Foundations", status: "completed", progress: 100, description: "HTML, CSS, JavaScript, Git and browser fundamentals.", skills: ["HTML", "CSS", "Git", "JavaScript"] },
      { title: "React Application Basics", status: "in-progress", progress: 68, description: "Components, hooks, routing, forms and API-driven UI patterns.", skills: ["React", "Hooks", "Routing"] },
      { title: "Node, Express and MongoDB", status: "upcoming", progress: 24, description: "APIs, authentication, MongoDB models and backend validation.", skills: ["Node.js", "Express", "MongoDB"] },
      { title: "Projects and Deployment", status: "upcoming", progress: 0, description: "Ship portfolio-ready apps with deployment and documentation.", skills: ["Deployment", "Projects", "CI"] },
    ],
    weeks: [
      {
        weekId: "week_1",
        weekNumber: 1,
        title: "Frontend Foundations",
        description: "Refresh HTML, CSS, JavaScript, Git and browser fundamentals before moving into React.",
        estimatedHours: 10,
        tasks: [
          {
            taskId: "task_1",
            title: "Build a responsive landing page",
            description: "Create a clean responsive page using semantic HTML, modern CSS and reusable layout sections.",
            type: "project",
            estimatedTimeMinutes: 180,
          },
          {
            taskId: "task_2",
            title: "Practice JavaScript fundamentals",
            description: "Revise arrays, objects, functions, async code and DOM events with small exercises.",
            type: "practice",
            estimatedTimeMinutes: 150,
          },
        ],
        resources: [
          {
            resourceId: "resource_1",
            title: "MDN JavaScript Guide",
            url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
            type: "documentation",
          },
        ],
      },
      {
        weekId: "week_2",
        weekNumber: 2,
        title: "React Application Basics",
        description: "Learn components, props, state, effects, routing and API-driven UI patterns.",
        estimatedHours: 12,
        tasks: [
          {
            taskId: "task_3",
            title: "Build a React dashboard screen",
            description: "Create reusable cards, lists and loading states powered by mock API data.",
            type: "project",
            estimatedTimeMinutes: 240,
          },
          {
            taskId: "task_4",
            title: "Study hooks and routing",
            description: "Practice useState, useEffect and route-based rendering with small feature examples.",
            type: "learning",
            estimatedTimeMinutes: 180,
          },
        ],
        resources: [
          {
            resourceId: "resource_2",
            title: "React Learn Docs",
            url: "https://react.dev/learn",
            type: "documentation",
          },
        ],
      },
      {
        weekId: "week_3",
        weekNumber: 3,
        title: "Node, Express and MongoDB",
        description: "Create backend APIs with Express, model data with MongoDB and connect frontend flows to real endpoints.",
        estimatedHours: 14,
        tasks: [
          {
            taskId: "task_5",
            title: "Create CRUD APIs",
            description: "Build list, create, update and delete endpoints for one learning resource.",
            type: "backend",
            estimatedTimeMinutes: 240,
          },
          {
            taskId: "task_6",
            title: "Model MongoDB data",
            description: "Design Mongoose schemas, references and validation rules for user-owned data.",
            type: "database",
            estimatedTimeMinutes: 180,
          },
        ],
        resources: [
          {
            resourceId: "resource_3",
            title: "Mongoose Documentation",
            url: "https://mongoosejs.com/docs/guide.html",
            type: "documentation",
          },
        ],
      },
    ],
  });

  const fullStack = await Course.create({
    title: "Full Stack Developer",
    slug: "full-stack-developer",
    description: "Build production-ready web apps using React, Node.js, Express and MongoDB.",
    level: "Intermediate",
    category: "Web Development",
    instructor: "Nisha Thomas",
    students: 12400,
    progress: 64,
    tags: ["React", "Node", "MongoDB"],
  });

  await Module.insertMany([
    { course: fullStack._id, title: "HTML, CSS and responsive systems", order: 1, lessons: 8, status: "completed", progress: 100 },
    { course: fullStack._id, title: "JavaScript fundamentals", order: 2, lessons: 12, status: "completed", progress: 100 },
    { course: fullStack._id, title: "React components and routing", order: 3, lessons: 14, status: "in-progress", progress: 62 },
    { course: fullStack._id, title: "Node.js and Express APIs", order: 4, lessons: 11, status: "in-progress", progress: 38 },
  ]);

  const reactTest = await Test.create({
    title: "React Weekly Test",
    description: "Hooks, routing and state",
    durationMinutes: 45,
    scheduledAt: new Date(),
    totalQuestions: 20,
    sections: ["React", "JavaScript"],
  });

  await Question.insertMany([
    {
      test: reactTest._id,
      prompt: "What does useEffect cleanup do?",
      options: ["Runs only on mount", "Runs before effect reruns and unmount", "Runs after every click"],
      answer: "Runs before effect reruns and unmount",
      section: "React",
      difficulty: "Medium",
      explanation: "Cleanup removes subscriptions, listeners and timers before the next effect or unmount.",
    },
    {
      test: reactTest._id,
      prompt: "Which hook is commonly used for local component state?",
      options: ["useState", "useFetch", "useServer"],
      answer: "useState",
      section: "React",
      difficulty: "Easy",
    },
  ]);

  await TestResult.create({
    user: user._id,
    test: reactTest._id,
    score: 91,
    percentile: 96,
    accuracy: 88,
    timeTakenMinutes: 38,
    sections: [{ name: "React", score: 92 }, { name: "JavaScript", score: 87 }, { name: "DSA", score: 81 }],
    aiSummary: "Strong in hooks and component composition. Revise async state and nested route edge cases.",
  });

  await DSAProgress.create({
    user: user._id,
    problemsSolved: 320,
    acceptanceRate: 78,
    currentStreak: 18,
    ranking: 1840,
    totalProblems: 760,
    topics: [{ name: "Arrays", solved: 88, total: 100 }, { name: "Strings", solved: 72, total: 100 }, { name: "Trees", solved: 54, total: 100 }],
    recentProblems: [{ title: "Two Sum", topic: "Array", level: "Easy", status: "Solved", score: 98 }],
    badges: ["Array Ace", "Streak 15", "Tree Climber"],
  });

  await Resume.create({
    user: user._id,
    template: "Modern",
    targetRole: "Full Stack Developer",
    atsScore: 86,
    sections: { summary: "Student developer building MERN projects.", skills: ["React", "Node.js", "MongoDB"] },
    analysis: ["Add measurable impact to project bullets.", "Mention authentication and schema design."],
  });

  await Project.insertMany([
    { user: user._id, title: "AI Study Planner", description: "Adaptive planner with progress analytics.", skills: ["React", "Node", "MongoDB"], status: "Featured", views: 1800, likes: 420, featured: true },
    { user: user._id, title: "DSA Visualizer", description: "Animated algorithm explorer.", skills: ["JavaScript", "Canvas"], status: "Published", views: 920, likes: 210, featured: false },
  ]);

  await Internship.insertMany([
    { role: "Frontend Developer Intern", company: "BluePeak Labs", domain: "Web", location: "Remote", duration: "3 months", stipend: "$600/mo", remote: true, type: "Part-time", matchScore: 94, skills: ["React", "CSS"] },
    { role: "MERN Stack Intern", company: "NovaWorks", domain: "Web", location: "Bengaluru", duration: "6 months", stipend: "$800/mo", remote: false, type: "Full-time", matchScore: 89, skills: ["React", "Node", "MongoDB"] },
  ]);

  await Hackathon.insertMany([
    { title: "Build for Campus", domain: "AI + Education", duration: "48 hours", prize: "$8,000 prizes", startsAt: new Date(), mode: "Online", skills: ["AI", "Product", "Pitch"] },
    { title: "Climate Code Sprint", domain: "Sustainability", duration: "72 hours", prize: "$12,000 prizes", startsAt: new Date(), mode: "Hybrid", skills: ["APIs", "Data", "Design"] },
  ]);

  await Certificate.insertMany([
    { user: user._id, title: "React Foundations", category: "Frontend", issuedAt: new Date(), status: "Verified", credentialId: "STX-RF-1001" },
    { user: user._id, title: "DSA 100 Problems", category: "Programming", issuedAt: new Date(), status: "Verified", credentialId: "STX-DSA-100" },
  ]);

  await AIMentorChat.create({
    user: user._id,
    topic: "React",
    messages: [
      { role: "user", content: "Explain useEffect cleanup." },
      { role: "assistant", content: "Cleanup runs before the effect reruns and when the component unmounts." },
    ],
  });

  await Notification.insertMany([
    { user: user._id, title: "React Weekly Test", body: "Your test is scheduled this week.", type: "test", read: false },
    { user: user._id, title: "Resume match improved", body: "Your ATS score increased to 86.", type: "resume", read: false },
  ]);

  console.log("Studox.ai seed complete.");
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
