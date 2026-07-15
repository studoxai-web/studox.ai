# Studox.ai Architecture Guide

Last updated: July 15, 2026

This document explains how the current Studox.ai project works so a new developer can join without guessing the system design. It is documentation only and does not change runtime behavior.

## 1. Project Overview

Studox.ai is a single-page student learning platform with:

- Landing page and assessment flow
- Login/signup with JWT authentication
- AI roadmap generation
- Dashboard and roadmap pages
- Courses, tests, DSA, resume, projects, internships, hackathons, certificates, AI mentor, profile, settings, and admin screens
- Express backend
- MongoDB/Mongoose database with in-memory fallback

The app currently uses a simple architecture:

```text
Browser SPA
  public/index.html
  public/app.js
        |
        | HTTP /api/*
        v
Express API
  src/server.js
        |
        | Mongoose models
        v
MongoDB Atlas
  or in-memory demo data fallback
```

## 2. Main Folder Structure

```text
studox.ai/
  public/
    index.html
    app.js
  src/
    server.js
    seed.js
    config/
      db.js
      mailer.js
    data/
      mockData.js
      runtime-store.json
    models/
      index.js
  contracts/
    INPUT_CONTRACT.md
    ROADMAP_CONTRACT.md
    AI_PROMPT_CONTRACT.md
    ROADMAP_SELECTION_CONTRACT.md
  scripts/
    free-port.js
  architecture/
    ARCHITECTURE.md
  package.json
  .env
  .env.example
```

## 3. Frontend Architecture

The frontend is mostly contained in:

```text
public/app.js
```

It is a plain JavaScript SPA. There is no React/Vue framework. The app builds HTML strings and inserts them into:

```js
const app = document.getElementById("app");
```

### Routing

Routing is hash-based:

```text
/#landing
/#login
/#signup
/#dashboard
/#roadmap
```

Important routing functions:

- `getRoute()`
- `setRoute(route)`
- `render()`
- `routeMap`
- `bindPage()`

The route map decides which function renders each page.

Examples:

```js
routeMap.landing = studoxLandingPage
routeMap.dashboard = properStudentDashboardPage
routeMap.roadmap = functionalRoadmapPage
routeMap.login = () => authPage("login")
routeMap.signup = () => authPage("signup")
```

### Frontend State

Frontend state is stored in the `functionalState` object.

Important fields:

```js
functionalState.dashboard
functionalState.generatedRoadmaps
functionalState.previewRoadmapIndex
functionalState.roadmaps
functionalState.courses
functionalState.tests
functionalState.profile
functionalState.settings
```

Assessment answers are stored in:

```js
assessmentAnswers
```

Pending assessment data is stored temporarily in:

```js
sessionStorage["studox-pending-assessment"]
```

This allows a user to complete the assessment before login, then resume roadmap generation after login.

## 4. Authentication Flow

Authentication uses JWT stored in browser localStorage:

```text
studox-token
studox-user
studox-plan
```

Frontend auth check:

```js
hasDemoSession()
```

This currently checks whether `studox-token` exists.

Backend auth middleware:

```js
authRequired(req, res, next)
authOptional(req, res, next)
```

`authRequired` expects:

```text
Authorization: Bearer <jwt>
```

When valid, it populates:

```js
req.user
```

The important user id field is:

```js
req.user.id
```

## 5. Backend Architecture

The backend entry point is:

```text
src/server.js
```

It contains:

- Express setup
- Middleware
- Auth helpers
- AI helper functions
- Generic CRUD helpers
- API routes
- Static frontend serving

Database connection is handled by:

```text
src/config/db.js
```

If `MONGO_URI` is missing or MongoDB fails, the backend falls back to in-memory demo data.

## 6. Environment Variables

Important `.env` values:

```env
PORT=4000
JWT_SECRET=...
MONGO_URI=...
MONGO_DB_NAME=studox_ai

AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-flash-latest

OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

Only one AI provider is needed. Current local setup uses Gemini.

## 7. Database Architecture

All Mongoose models are defined in:

```text
src/models/index.js
```

Main models:

- `User`
- `StudentProfile`
- `Roadmap`
- `Course`
- `Module`
- `Test`
- `Question`
- `TestResult`
- `DSAProgress`
- `Resume`
- `Project`
- `Internship`
- `Hackathon`
- `Certificate`
- `AIMentorChat`
- `Notification`
- `UserSettings`
- `Admin`

### User Model

Important fields:

```js
name
email
phone
password
role
plan
activeRoadmapId
```

`activeRoadmapId` references the currently selected roadmap.

### Roadmap Model

The AI-generated roadmap is stored in the `Roadmap` model.

Important fields:

```js
userId
title
careerGoal
summary
estimatedDurationWeeks
difficulty
status
generatedBy
version
generatedAt
weeks
```

Each week contains:

```js
weekId
weekNumber
title
description
estimatedHours
tasks
resources
```

Each task contains:

```js
taskId
title
description
type
estimatedTimeMinutes
```

Each resource contains:

```js
resourceId
title
url
type
```

Roadmap status can be:

```text
draft
active
completed
archived
```

## 8. Roadmap Generation Architecture

The roadmap feature uses a two-stage AI flow to avoid Gemini token limits.

### Stage 1: Generate Lightweight Options

Frontend:

```text
Assessment submit
```

calls:

```text
POST /api/roadmaps/generate
```

Backend:

```js
roadmapInputErrors()
generateRoadmapOptions()
roadmapOptionsPrompt()
callConfiguredAi()
callGeminiMentor() or callOpenAiMentor()
roadmapOptionErrors()
```

Returns:

```json
{
  "roadmaps": [
    {
      "title": "string",
      "careerGoal": "string",
      "summary": "string",
      "estimatedDurationWeeks": 12,
      "difficulty": "beginner",
      "weeks": [
        {
          "weekNumber": 1,
          "title": "Week title"
        }
      ]
    }
  ]
}
```

These are preview options only. They are not saved yet.

### Stage 2: Select and Complete Roadmap

Frontend:

```text
Choose Roadmap
```

calls:

```text
POST /api/roadmaps/select
```

Backend:

```js
roadmapOptionErrors()
generateCompleteRoadmap()
completeRoadmapPrompt()
callConfiguredAi()
extractJsonObject()
roadmapOutputErrors()
Roadmap.create()
User.activeRoadmapId = roadmap._id
user.save()
```

The backend:

1. Receives the selected lightweight roadmap.
2. Calls AI again for one full roadmap.
3. Validates the full ROADMAP_CONTRACT.
4. Archives the previous active roadmap if needed.
5. Saves the new roadmap with `status: "active"`.
6. Updates `User.activeRoadmapId`.
7. Returns the saved roadmap.

Response:

```json
{
  "message": "Roadmap selected successfully.",
  "activeRoadmapId": "...",
  "roadmap": {}
}
```

## 9. Assessment to Dashboard Flow

Current intended user flow:

```text
Landing
  -> Start Assessment
  -> Answer assessment questions
  -> Generate Roadmap
  -> Show 3 roadmap options
  -> Preview roadmap
  -> Choose Roadmap
  -> Save full roadmap
  -> Dashboard
  -> Dashboard loads active roadmap
```

If the user is not logged in:

```text
Assessment complete
  -> Save assessment in sessionStorage
  -> Redirect to Login
  -> Login succeeds
  -> Resume roadmap generation
  -> Show 3 roadmap options
```

## 10. Dashboard and Roadmap Display

Dashboard data is loaded from:

```text
GET /api/dashboard/stats
```

The backend loads roadmap data in this order:

1. `User.activeRoadmapId`
2. newest active roadmap with `{ userId, status: "active" }`
3. latest roadmap with `{ userId }`

The dashboard uses:

```js
functionalState.dashboard
```

The roadmap page loads:

```text
GET /api/roadmaps
```

The frontend maps AI `weeks` into the existing timeline UI.

Mapping:

```text
week.title -> module title
week.description -> module description
week.estimatedHours -> metadata
week.tasks -> chips/task labels
week.resources -> resource links
```

## 11. Main API Routes

### Auth

```text
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Dashboard and Roadmap

```text
GET  /api/dashboard/stats
GET  /api/roadmaps
POST /api/roadmaps/generate
POST /api/roadmaps/select
GET  /api/roadmaps/:id/progress
```

### Courses and Tests

```text
GET   /api/courses
GET   /api/courses/:id
PATCH /api/courses/:courseId/modules/:moduleId
POST  /api/courses/:courseId/continue

GET  /api/tests
GET  /api/tests/:id/questions
POST /api/tests/:id/submit
GET  /api/test-results
```

### Other Feature Areas

```text
GET/PUT  /api/profile
GET/PUT  /api/settings
GET/PUT  /api/dsa/progress
POST     /api/dsa/solve-challenge
GET/POST /api/resume
POST     /api/resume/ats-score
GET/POST /api/projects
GET/POST /api/internships
POST     /api/internships/:id/apply
GET/POST /api/hackathons
POST     /api/hackathons/:id/register
GET/POST /api/certificates
POST     /api/certificates/:id/share
GET/POST /api/ai-mentor/chat
GET      /api/notifications
GET/POST/PUT/DELETE /api/admin/:resource
```

## 12. Generic CRUD System

`src/server.js` contains a `resourceMap`.

This maps admin resources to Mongoose models or memory store keys.

Example:

```js
roadmaps: { model: Roadmap, key: "roadmaps" }
courses: { model: Course, key: "courses" }
tests: { model: Test, key: "tests" }
```

Generic helpers:

```js
listResource()
createResource()
updateResource()
deleteResource()
```

Admin routes use these helpers.

## 13. AI Integration

AI provider selection happens in:

```js
callConfiguredAi()
```

Provider functions:

```js
callGeminiMentor()
callOpenAiMentor()
```

Gemini uses direct HTTP calls to:

```text
https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent
```

OpenAI uses direct HTTP calls to:

```text
<OPENAI_BASE_URL>/chat/completions
```

There is no Gemini/OpenAI SDK package currently used.

If Gemini quota fails, the frontend shortens the error for users:

```text
AI limit reached. Please try again in X seconds.
```

## 14. Important Contracts

Contracts live in:

```text
contracts/
```

Current contract documents:

```text
INPUT_CONTRACT.md
ROADMAP_CONTRACT.md
AI_PROMPT_CONTRACT.md
ROADMAP_SELECTION_CONTRACT.md
```

When changing the roadmap payload or AI prompt, update these documents too.

## 15. Current Developer Notes

### New developer should know

- This is not a framework frontend. It is direct DOM + template strings.
- Routing is hash-based and controlled by `routeMap`.
- Many frontend pages are rendered by functions in `public/app.js`.
- Backend is mostly one file: `src/server.js`.
- Models are centralized in `src/models/index.js`.
- Roadmap generation is intentionally two-stage to avoid AI token limits.
- New AI roadmaps use `userId`, not old `user`.
- The active roadmap should be read through `User.activeRoadmapId`.
- MongoDB can fail gracefully into memory mode, but real saved user data needs MongoDB.

### Avoid doing accidentally

- Do not rewrite routing unless necessary.
- Do not replace `routeMap`, `setRoute`, `getRoute`, or `render` casually.
- Do not move roadmap generation back to generating three full roadmaps at once.
- Do not save lightweight roadmap options from `/api/roadmaps/generate`.
- Do not use `localStorage` for pending assessment data; current flow uses `sessionStorage`.
- Do not query new Roadmaps using `{ user: userId }`; use `{ userId }`.

## 16. How to Run Locally

Install dependencies:

```bash
npm install
```

Start server:

```bash
npm start
```

Or development mode:

```bash
npm run dev
```

Seed data:

```bash
npm run seed
```

Open:

```text
http://localhost:4000
```

## 17. Quick Onboarding Checklist

For a new developer:

1. Read this file.
2. Read `public/app.js` route map and `bindPage()`.
3. Read `src/server.js` auth and roadmap routes.
4. Read `src/models/index.js`.
5. Read the files in `contracts/`.
6. Start the app locally.
7. Test the flow:

```text
Landing -> Assessment -> Generate -> Preview -> Choose -> Dashboard -> Roadmap
```

## 18. Current System Status

Implemented:

- Landing page
- Login/signup
- JWT auth
- Assessment UI
- Login-after-assessment resume flow
- AI roadmap generation, two-stage
- Roadmap selection and saving
- Dashboard active roadmap loading
- Roadmap page mapping AI weeks into timeline
- User.activeRoadmapId
- MongoDB Roadmap schema
- Admin generic CRUD base

Partially implemented:

- Progress tracking for generated roadmaps
- Full dashboard use of all roadmap task/resource details
- Course-to-roadmap progress synchronization
- Admin management polish

Known risks:

- Gemini free tier quota can fail roadmap generation.
- Some older/demo code may still exist in `public/app.js`.
- Contracts may need updates whenever the two-stage flow changes.
- In-memory fallback is useful for demo but should not be treated as production persistence.
