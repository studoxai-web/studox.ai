# Studox.ai Architecture Guide

Last updated: July 17, 2026

This document explains how the current Studox.ai project works so a new developer can join without guessing the system design. It is documentation only and does not change runtime behavior.

## 1. Project Overview

Studox.ai is a single-page student learning platform with:

- Landing page and assessment flow
- Login/signup with Firebase Authentication
- Legacy JWT authentication is still present as a compatibility fallback
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
    firebase.js
  src/
    server.js
    seed.js
    config/
      db.js
      firebaseAdmin.js
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

## 2A. Firebase Auth Migration Status

Firebase is currently in Phase 3 frontend-auth mode.

Previous Phase 2 behavior, now replaced on the frontend:

```text
Login/Signup
-> /api/auth/login or /api/auth/signup
-> custom JWT
-> authRequired()/authOptional()
```

Current active frontend authentication uses:

```text
Login/Signup
-> Firebase Email/Password Auth
-> Firebase ID token
-> POST /api/auth/firebase
-> Studox User sync
-> savePendingRoadmapAfterAuth()
-> Dashboard
```

Prepared Firebase infrastructure:

- `public/firebase.js` initializes the Firebase Web SDK from environment-backed config exposed by `/api/firebase/config`.
- `src/config/firebaseAdmin.js` initializes Firebase Admin from backend environment variables.
- `src/server.js` exposes `/api/firebase/config` for public Firebase Web SDK config only.
- `src/server.js` exposes `POST /api/auth/firebase` to verify a Firebase ID token and find/create the matching Studox `User`, `StudentProfile`, and `UserSettings`.
- `public/app.js` now uses Firebase Email/Password methods for signup/login and then calls `/api/auth/firebase`.
- `public/app.js` waits for Firebase auth-state restoration before protected route checks to avoid redirect flicker.
- `authRequired()` and `authOptional()` still support legacy JWTs, but now also accept Firebase ID tokens and map them to the matching Studox user.

Important: Legacy backend signup/login endpoints still exist for compatibility, but the active frontend flow no longer calls them.

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

Authentication now uses Firebase on the frontend. Studox still stores lightweight user display/session metadata in browser localStorage:

```text
studox-user
studox-plan
studox-auth-provider
```

Frontend auth check:

```js
hasDemoSession()
```

This currently checks the restored Firebase user first, with `studox-token` retained only as a legacy fallback.

Backend auth middleware:

```js
authRequired(req, res, next)
authOptional(req, res, next)
```

`authRequired` accepts:

```text
Authorization: Bearer <Firebase ID token>
or
Authorization: Bearer <legacy jwt>
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

### Current MVP Direction: Manual First, AI Later

As of July 17, 2026, the launch MVP direction has changed.

The old AI-first generation flow below is **not deleted** because it may return later. For the first MVP, it is treated as paused/dropped from the immediate launch path.

Current MVP flow:

```text
Assessment submit
  -> frontend builds manual roadmap options
  -> user chooses one option
  -> selected roadmap is stored temporarily
  -> signup/login
  -> selected roadmap is saved through POST /api/roadmaps/select
  -> dashboard loads active roadmap
```

Important frontend functions:

```js
buildManualRoadmaps()
createManualRoadmapCard()
requestRoadmapOptions()
assessmentResultScreen()
handleChooseRoadmapSignup()
handleChooseRoadmap()
savePendingRoadmapAfterAuth()
```

Current `requestRoadmapOptions()` does **not** call `/api/roadmaps/generate`. It returns manually built roadmap options from the assessment answers.

Current `/api/roadmaps/select` does **not** call AI for MVP. It saves the selected manual roadmap directly, assigns the authenticated `userId`, sets `status: "active"`, archives the previous active roadmap when present, and updates `User.activeRoadmapId`.

The manual roadmap options are built around:

```text
career goal
current level
timeline
weekly study hours
optional focus
optional project experience
optional learning style
optional extra context
```

For the MVP, this avoids AI quota failures and makes the first user journey more reliable.

### Paused Previous Design: Two-Stage AI Flow

The following AI-first design was the previous intended architecture. It is kept here for future reference, but it is not the current frontend launch flow.

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

MVP status: paused for launch. Backend support still exists, but the current frontend does not call this endpoint during assessment generation.

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

MVP status: paused. The old version of `/api/roadmaps/select` called `generateCompleteRoadmap()` to expand the selected lightweight roadmap. The current MVP version saves the selected manual roadmap directly and does not call AI.

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

MVP status: active as direct-save only. `/api/roadmaps/select` is still the save path for the chosen roadmap, but the selected roadmap currently comes from manual frontend generation rather than `/api/roadmaps/generate`, and selection does not trigger AI completion.

## 9. Assessment to Dashboard Flow

### Current MVP User Flow

```text
Landing
  -> Start Assessment
  -> Answer required questions
  -> Optional answers may be skipped
  -> Generate Roadmap
  -> Frontend manually creates roadmap option(s)
  -> Choose roadmap
  -> Signup/Login if needed
  -> Save selected roadmap
  -> Dashboard
  -> Dashboard loads active roadmap
```

Assessment currently has four required questions:

```text
career goal
current level
timeline
weekly time
```

Optional questions:

```text
main focus
projects built
learning style
extra context
```

The current frontend can return:

```text
one beginner roadmap
one advanced roadmap
or three tracks for intermediate users:
  beginner refresh
  intermediate recommended
  advanced locked
```

### Paused Previous Intended User Flow

The older AI-first flow below is kept for context, but it is not the current MVP flow.

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

MVP note: the current pulled frontend stores the selected pending roadmap in `localStorage["studox-pending-roadmap"]`. This differs from the earlier `sessionStorage["studox-pending-assessment"]` design. If we keep this behavior, future work should make the save-after-signup path explicit and reliable.

Phase 2 update: save-after-signup/login is now explicit. After successful authentication, `savePendingRoadmapAfterAuth()` reads `localStorage["studox-pending-roadmap"]`, calls `POST /api/roadmaps/select`, clears the pending roadmap only after a successful save, and redirects to Dashboard.

Signup does not collect career goal and does not create a roadmap in the MVP. `POST /api/auth/signup` creates only the user, student profile, and user settings. Career goal comes from Assessment -> selected roadmap and is written to the student profile when `POST /api/roadmaps/select` saves the roadmap. The only endpoint that should create a user roadmap is `POST /api/roadmaps/select`.

## 10. Dashboard and Roadmap Display

Dashboard data is loaded from:

```text
GET /api/dashboard/stats
```

The backend loads roadmap data in this order:

1. `User.activeRoadmapId`
2. newest active roadmap with `{ userId, status: "active" }`
3. latest roadmap with `{ userId }`

Phase 3 update: dashboard stats now include:

```js
hasActiveRoadmap
```

If `hasActiveRoadmap` is `false`, `/api/dashboard/stats` returns `roadmap: {}` and does not fabricate a roadmap from profile data. The dashboard uses this flag to show either:

```text
Continue Roadmap -> #roadmap
```

or:

```text
Create Roadmap -> Assessment
```

The dashboard uses:

```js
functionalState.dashboard
```

The roadmap page loads:

```text
GET /api/roadmaps
```

Phase 4 update: `/api/roadmaps` now returns saved roadmaps only. It does not fabricate a roadmap when none exists.

The endpoint prioritizes roadmaps in this order:

1. `User.activeRoadmapId`
2. newest active roadmap with `{ userId, status: "active" }`
3. latest roadmap with `{ userId }`

If no roadmap exists, it returns:

```json
[]
```

Every returned roadmap is normalized before reaching the frontend.

The frontend maps saved `weeks` into the existing timeline UI.

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
- Current MVP roadmap option generation is manual on the frontend for launch reliability.
- The previous two-stage AI roadmap generation design is paused, not removed.
- New AI roadmaps use `userId`, not old `user`.
- The active roadmap should be read through `User.activeRoadmapId`.
- MongoDB can fail gracefully into memory mode, but real saved user data needs MongoDB.
- For launch, Roadmap, Courses, Dashboard, AI Mentor, Profile, and Settings stay available on web. Other sidebar features are routed to an app-coming-soon modal.

### Avoid doing accidentally

- Do not rewrite routing unless necessary.
- Do not replace `routeMap`, `setRoute`, `getRoute`, or `render` casually.
- Do not silently re-enable `/api/roadmaps/generate` from the frontend without updating this architecture file and the contracts.
- Do not move roadmap generation back to generating three full AI roadmaps at once unless the token/quota plan is solved.
- The earlier rule was to avoid `localStorage` for pending assessment data. Current pulled MVP code uses `localStorage["studox-pending-roadmap"]`; if this changes, document it here.
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
- Short MVP assessment with required and optional questions
- Manual frontend roadmap option generation for MVP
- App-coming-soon gating for unfinished sidebar routes
- Roadmap selection and saving
- Dashboard active roadmap loading
- Roadmap page mapping AI weeks into timeline
- User.activeRoadmapId
- MongoDB Roadmap schema
- Admin generic CRUD base

Partially implemented:

- Save-after-signup/login flow from `localStorage["studox-pending-roadmap"]`
- AI roadmap generation, two-stage backend support
- Progress tracking for generated roadmaps
- Full dashboard use of all roadmap task/resource details
- Course-to-roadmap progress synchronization
- Admin management polish

Known risks:

- The current MVP frontend does not call `/api/roadmaps/generate`; if AI generation is reintroduced, Gemini/OpenAI quota can fail roadmap generation.
- Architecture and contracts need another update if manual roadmap cards become the official long-term contract.
- `localStorage["studox-pending-roadmap"]` is cleared only after successful `/api/roadmaps/select`; failed saves leave it available for retry.
- Some older/demo code may still exist in `public/app.js`.
- Contracts may need updates whenever the two-stage flow changes.
- In-memory fallback is useful for demo but should not be treated as production persistence.
