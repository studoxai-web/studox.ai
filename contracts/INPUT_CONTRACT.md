# Roadmap Generation Input Contract

Request body for:

```text
POST /api/roadmaps/generate
```

The authenticated backend overrides `userId` from `req.user.id`.

```json
{
  "userId": "64f1a2b3c4d5e6f789012345",
  "careerGoal": "Full Stack Developer",
  "currentLevel": "beginner",
  "targetTimelineWeeks": 12,
  "weeklyAvailabilityHours": 10,
  "learningStyle": "project-based",
  "preferredLanguage": "English",
  "background": {
    "educationLevel": "undergraduate",
    "fieldOfStudy": "Computer Science",
    "workExperience": "none"
  },
  "skills": {
    "known": ["HTML", "CSS", "JavaScript"],
    "weak": ["Data Structures", "Backend APIs"],
    "target": ["React", "Node.js", "MongoDB", "System Design"]
  },
  "constraints": {
    "budget": "free",
    "deviceAccess": "laptop",
    "internetAccess": "stable"
  },
  "preferences": {
    "includeProjects": true,
    "includePracticeTasks": true,
    "includeFreeResources": true,
    "includeInterviewPrep": true
  }
}
```

Response body:

```json
{
  "roadmaps": []
}
```
