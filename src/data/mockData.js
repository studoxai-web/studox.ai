const now = new Date();

const mockData = {
  users: [
    {
      id: "user_demo",
      name: "Aarav Sharma",
      email: "aarav@studox.ai",
      phone: "+91 98765 43210",
      password: "$2a$10$VlFtbubhwtdXCVX6ORgsp.BlMNNQdHoI.EOMqVpxiQCobqBERtJ6m",
      role: "student",
    },
  ],
  profiles: [
    {
      user: "user_demo",
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
    },
  ],
  roadmaps: [
    {
      id: "roadmap_full_stack",
      title: "Full Stack Developer Roadmap",
      currentLevel: "Intermediate",
      overallProgress: 72,
      timeToGoalWeeks: 9,
      skillsLearned: 36,
      nextMilestone: "React master checkpoint",
      modules: [
        {
          title: "Foundations",
          status: "completed",
          progress: 100,
          description: "HTML, CSS, JavaScript, Git and browser fundamentals.",
          skills: ["HTML", "CSS", "Git", "JavaScript"],
        },
        {
          title: "Frontend Development",
          status: "in-progress",
          progress: 68,
          description: "React, routing, state, forms, APIs and UI systems.",
          skills: ["React", "Routing", "State"],
        },
        {
          title: "Backend Development",
          status: "upcoming",
          progress: 24,
          description: "Node.js, Express, authentication and REST APIs.",
          skills: ["Node.js", "Express", "JWT"],
        },
        {
          title: "Databases",
          status: "upcoming",
          progress: 8,
          description: "MongoDB schema design, indexes and aggregation.",
          skills: ["MongoDB", "Mongoose"],
        },
      ],
    },
  ],
  courses: [
    {
      id: "course_full_stack",
      title: "Full Stack Developer",
      slug: "full-stack-developer",
      description: "Build production-ready web apps using React, Node.js, Express and MongoDB.",
      level: "Intermediate",
      category: "Web Development",
      instructor: "Nisha Thomas",
      students: 12400,
      progress: 64,
      tags: ["React", "Node", "MongoDB"],
    },
    {
      id: "course_dsa",
      title: "Data Structures Mastery",
      slug: "data-structures-mastery",
      description: "Master arrays, trees, graphs, dynamic programming and interview patterns.",
      level: "Core",
      category: "Programming",
      instructor: "Rohan Mehta",
      students: 9200,
      progress: 48,
      tags: ["DSA", "Algorithms", "Interviews"],
    },
  ],
  modules: [
    { id: "module_1", course: "course_full_stack", title: "HTML, CSS and responsive systems", order: 1, lessons: 8, status: "completed", progress: 100 },
    { id: "module_2", course: "course_full_stack", title: "JavaScript fundamentals", order: 2, lessons: 12, status: "completed", progress: 100 },
    { id: "module_3", course: "course_full_stack", title: "React components and routing", order: 3, lessons: 14, status: "in-progress", progress: 62 },
    { id: "module_4", course: "course_full_stack", title: "Node.js and Express APIs", order: 4, lessons: 11, status: "in-progress", progress: 38 },
  ],
  tests: [
    { id: "test_react_weekly", title: "React Weekly Test", description: "Hooks, routing and state", durationMinutes: 45, scheduledAt: now, totalQuestions: 20, sections: ["React", "JavaScript"] },
    { id: "test_dsa_arrays", title: "DSA Arrays Sprint", description: "Array and sliding window patterns", durationMinutes: 60, scheduledAt: now, totalQuestions: 18, sections: ["DSA"] },
  ],
  questions: [
    { id: "q1", test: "test_react_weekly", prompt: "What does useEffect cleanup do?", options: ["Runs before rerender", "Runs before effect reruns and unmount", "Only runs on mount"], answer: "Runs before effect reruns and unmount", section: "React", difficulty: "Medium" },
    { id: "q2", test: "test_dsa_arrays", prompt: "Which pattern fits maximum sum subarray of fixed size?", options: ["DFS", "Sliding window", "Binary search"], answer: "Sliding window", section: "DSA", difficulty: "Easy" },
  ],
  testResults: [
    {
      id: "result_1",
      user: "user_demo",
      test: "test_react_weekly",
      score: 91,
      percentile: 96,
      accuracy: 88,
      timeTakenMinutes: 38,
      sections: [{ name: "React", score: 92 }, { name: "JavaScript", score: 87 }, { name: "DSA", score: 81 }],
      answers: [],
      aiSummary: "Strong in hooks and component composition. Revise async state and nested route edge cases.",
    },
  ],
  dsaProgress: [
    {
      user: "user_demo",
      problemsSolved: 320,
      acceptanceRate: 78,
      currentStreak: 18,
      ranking: 1840,
      totalProblems: 760,
      topics: [
        { name: "Arrays", solved: 88, total: 100 },
        { name: "Strings", solved: 72, total: 100 },
        { name: "Trees", solved: 54, total: 100 },
      ],
      recentProblems: [
        { title: "Two Sum", topic: "Array", level: "Easy", status: "Solved", score: 98 },
        { title: "Longest Substring", topic: "String", level: "Medium", status: "Review", score: 72 },
      ],
      badges: ["Array Ace", "Streak 15", "Tree Climber"],
    },
  ],
  resumes: [
    {
      user: "user_demo",
      template: "Modern",
      targetRole: "Full Stack Developer",
      atsScore: 86,
      sections: {
        summary: "Student developer building MERN projects with strong React, DSA and product thinking.",
        skills: ["React", "Node.js", "Express", "MongoDB", "DSA"],
      },
      analysis: ["Add measurable impact to project bullets.", "Mention authentication and MongoDB schema design."],
    },
  ],
  projects: [
    { id: "project_1", user: "user_demo", title: "AI Study Planner", description: "Adaptive planner with progress analytics.", skills: ["React", "Node", "MongoDB"], status: "Featured", views: 1800, likes: 420, featured: true },
    { id: "project_2", user: "user_demo", title: "DSA Visualizer", description: "Animated algorithm explorer.", skills: ["JavaScript", "Canvas"], status: "Published", views: 920, likes: 210, featured: false },
  ],
  internships: [
    { id: "intern_1", role: "Frontend Developer Intern", company: "BluePeak Labs", domain: "Web", location: "Remote", duration: "3 months", stipend: "$600/mo", remote: true, type: "Part-time", matchScore: 94, skills: ["React", "CSS"] },
    { id: "intern_2", role: "MERN Stack Intern", company: "NovaWorks", domain: "Web", location: "Bengaluru", duration: "6 months", stipend: "$800/mo", remote: false, type: "Full-time", matchScore: 89, skills: ["React", "Node", "MongoDB"] },
  ],
  hackathons: [
    { id: "hack_1", title: "Build for Campus", domain: "AI + Education", duration: "48 hours", prize: "$8,000 prizes", startsAt: now, mode: "Online", skills: ["AI", "Product", "Pitch"] },
    { id: "hack_2", title: "Climate Code Sprint", domain: "Sustainability", duration: "72 hours", prize: "$12,000 prizes", startsAt: now, mode: "Hybrid", skills: ["APIs", "Data", "Design"] },
  ],
  certificates: [
    { id: "cert_1", user: "user_demo", title: "React Foundations", category: "Frontend", issuedAt: now, status: "Verified", credentialId: "STX-RF-1001" },
    { id: "cert_2", user: "user_demo", title: "DSA 100 Problems", category: "Programming", issuedAt: now, status: "Verified", credentialId: "STX-DSA-100" },
  ],
  chats: [
    {
      id: "chat_1",
      user: "user_demo",
      topic: "React",
      messages: [
        { role: "user", content: "Explain useEffect cleanup." },
        { role: "assistant", content: "Cleanup runs before the effect reruns and when a component unmounts." },
      ],
    },
  ],
  notifications: [
    { id: "note_1", user: "user_demo", title: "React Weekly Test", body: "Your test is scheduled this week.", type: "test", read: false },
    { id: "note_2", user: "user_demo", title: "Resume match improved", body: "Your ATS score increased to 86.", type: "resume", read: false },
  ],
  settings: [
    {
      user: "user_demo",
      theme: "system",
      accentColor: "#2563eb",
      language: "English",
      studyPreferences: { reminders: true, weeklyTests: true, dsaChallenges: true },
      notifications: { email: true, push: true, mentor: true, career: true },
      privacy: { profileVisible: true, recruiterVisible: true },
      connectedAccounts: { google: true, github: false, linkedin: false },
    },
  ],
  admins: [
    {
      id: "admin_demo",
      name: "Studox Admin",
      email: "admin@studox.ai",
      permissions: ["users", "courses", "tests", "content", "reports"],
    },
  ],
  reports: [
    { id: "report_1", title: "Weekly engagement report", status: "Open", owner: "Studox Admin" },
  ],
  content: [
    { id: "content_1", title: "Landing hero copy", status: "Live", owner: "Studox Admin" },
  ],
};

module.exports = mockData;
