const mongoose = require("mongoose");

const { Schema } = mongoose;

function model(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

const User = model(
  "User",
  new Schema(
    {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, unique: true, lowercase: true, trim: true },
      phone: { type: String, trim: true },
      password: { type: String, required: true },
      role: { type: String, enum: ["student", "admin"], default: "student" },
      plan: { type: String, enum: ["free", "pro", "elite"], default: "free" },
      resetOtp: String,
      resetOtpExpires: Date,
      lastLoginAt: Date,
    },
    { timestamps: true },
  ),
);

const StudentProfile = model(
  "StudentProfile",
  new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: "User" },
      username: String,
      goal: String,
      field: String,
      college: String,
      branch: String,
      bio: String,
      skills: [String],
      education: [
        {
          title: String,
          institution: String,
          year: String,
          score: String,
        },
      ],
      level: { type: String, default: "Beginner" },
      xp: { type: Number, default: 0 },
      profileCompletion: { type: Number, default: 35 },
      streak: { type: Number, default: 0 },
    },
    { timestamps: true },
  ),
);

const Roadmap = model(
  "Roadmap",
  new Schema(
    {
      userId: { type: Schema.Types.ObjectId, ref: "User" },
      title: String,
      careerGoal: String,
      summary: String,
      estimatedDurationWeeks: Number,
      difficulty: String,
      status: { type: String, enum: ["draft", "active", "completed", "archived"], default: "draft" },
      generatedBy: String,
      version: Number,
      generatedAt: Date,
      weeks: [
        {
          weekId: String,
          weekNumber: Number,
          title: String,
          description: String,
          estimatedHours: Number,
          tasks: [
            {
              taskId: String,
              title: String,
              description: String,
              type: { type: String },
              estimatedTimeMinutes: Number,
            },
          ],
          resources: [
            {
              resourceId: String,
              title: String,
              url: String,
              type: { type: String },
            },
          ],
        },
      ],
    },
    { timestamps: true },
  ),
);

const Course = model(
  "Course",
  new Schema(
    {
      title: String,
      slug: { type: String, index: true },
      description: String,
      level: String,
      category: String,
      instructor: String,
      students: Number,
      progress: Number,
      tags: [String],
      isPublished: { type: Boolean, default: true },
    },
    { timestamps: true },
  ),
);

const Module = model(
  "Module",
  new Schema(
    {
      course: { type: Schema.Types.ObjectId, ref: "Course" },
      title: String,
      description: String,
      order: Number,
      lessons: Number,
      status: { type: String, enum: ["completed", "in-progress", "locked"], default: "locked" },
      progress: Number,
      resources: [String],
    },
    { timestamps: true },
  ),
);

const Test = model(
  "Test",
  new Schema(
    {
      title: String,
      description: String,
      durationMinutes: Number,
      scheduledAt: Date,
      totalQuestions: Number,
      sections: [String],
      isPublished: { type: Boolean, default: true },
    },
    { timestamps: true },
  ),
);

const Question = model(
  "Question",
  new Schema(
    {
      test: { type: Schema.Types.ObjectId, ref: "Test" },
      prompt: String,
      options: [String],
      answer: String,
      section: String,
      difficulty: String,
      explanation: String,
    },
    { timestamps: true },
  ),
);

const TestResult = model(
  "TestResult",
  new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: "User" },
      test: { type: Schema.Types.ObjectId, ref: "Test" },
      score: Number,
      percentile: Number,
      accuracy: Number,
      timeTakenMinutes: Number,
      sections: [{ name: String, score: Number }],
      answers: [{ question: String, selected: String, correct: Boolean }],
      aiSummary: String,
    },
    { timestamps: true },
  ),
);

const DSAProgress = model(
  "DSAProgress",
  new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: "User" },
      problemsSolved: Number,
      acceptanceRate: Number,
      currentStreak: Number,
      ranking: Number,
      totalProblems: Number,
      topics: [{ name: String, solved: Number, total: Number }],
      recentProblems: [{ title: String, topic: String, level: String, status: String, score: Number }],
      badges: [String],
    },
    { timestamps: true },
  ),
);

const Resume = model(
  "Resume",
  new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: "User" },
      template: String,
      sections: Schema.Types.Mixed,
      atsScore: Number,
      analysis: [String],
      targetRole: String,
    },
    { timestamps: true },
  ),
);

const Project = model(
  "Project",
  new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: "User" },
      title: String,
      description: String,
      skills: [String],
      status: String,
      views: Number,
      likes: Number,
      featured: Boolean,
      links: { demo: String, github: String },
    },
    { timestamps: true },
  ),
);

const Internship = model(
  "Internship",
  new Schema(
    {
      role: String,
      company: String,
      domain: String,
      location: String,
      duration: String,
      stipend: String,
      remote: Boolean,
      type: String,
      matchScore: Number,
      skills: [String],
      applicants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    },
    { timestamps: true },
  ),
);

const Hackathon = model(
  "Hackathon",
  new Schema(
    {
      title: String,
      domain: String,
      duration: String,
      prize: String,
      startsAt: Date,
      mode: String,
      skills: [String],
      registrations: [{ type: Schema.Types.ObjectId, ref: "User" }],
    },
    { timestamps: true },
  ),
);

const Certificate = model(
  "Certificate",
  new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: "User" },
      title: String,
      category: String,
      issuedAt: Date,
      status: String,
      credentialId: String,
      badgeUrl: String,
    },
    { timestamps: true },
  ),
);

const AIMentorChat = model(
  "AIMentorChat",
  new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: "User" },
      topic: String,
      messages: [{ role: String, content: String, createdAt: { type: Date, default: Date.now } }],
      metadata: Schema.Types.Mixed,
    },
    { timestamps: true },
  ),
);

const Notification = model(
  "Notification",
  new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: "User" },
      title: String,
      body: String,
      type: String,
      read: { type: Boolean, default: false },
    },
    { timestamps: true },
  ),
);

const UserSettings = model(
  "UserSettings",
  new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: "User" },
      theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
      accentColor: { type: String, default: "#2563eb" },
      language: { type: String, default: "English" },
      studyPreferences: Schema.Types.Mixed,
      notifications: Schema.Types.Mixed,
      privacy: Schema.Types.Mixed,
      connectedAccounts: Schema.Types.Mixed,
    },
    { timestamps: true },
  ),
);

const Admin = model(
  "Admin",
  new Schema(
    {
      name: String,
      email: { type: String, unique: true, sparse: true },
      password: String,
      permissions: [String],
    },
    { timestamps: true },
  ),
);

module.exports = {
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
};
