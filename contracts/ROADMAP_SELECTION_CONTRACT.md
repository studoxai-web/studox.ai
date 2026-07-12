# Roadmap Selection Request Contract

Current shared backend status:

```text
POST /api/roadmaps/select is not currently present in src/server.js.
```

Expected request body for the roadmap selection flow, based on the existing Roadmap schema and generated roadmap response:

```json
{
  "roadmap": {
    "userId": "64f1a2b3c4d5e6f789012345",
    "title": "Full Stack Developer Roadmap",
    "careerGoal": "Full Stack Developer",
    "summary": "A structured learning roadmap for becoming job-ready in full stack development.",
    "estimatedDurationWeeks": 12,
    "difficulty": "beginner",
    "status": "draft",
    "generatedBy": "ai",
    "version": 1,
    "generatedAt": "2026-07-11T00:00:00.000Z",
    "weeks": [
      {
        "weekId": "week_1",
        "weekNumber": 1,
        "title": "Web Fundamentals",
        "description": "Learn the core foundations of HTML, CSS, JavaScript, and how the web works.",
        "estimatedHours": 10,
        "tasks": [
          {
            "taskId": "task_1",
            "title": "Learn HTML structure",
            "description": "Understand semantic HTML tags, document structure, forms, and accessibility basics.",
            "type": "learning",
            "estimatedTimeMinutes": 120
          }
        ],
        "resources": [
          {
            "resourceId": "resource_1",
            "title": "MDN HTML Guide",
            "url": "https://developer.mozilla.org/en-US/docs/Learn/HTML",
            "type": "documentation"
          }
        ]
      }
    ]
  }
}
```

Expected success response for the selection flow:

```json
{
  "message": "Roadmap selected successfully.",
  "activeRoadmapId": "64f1a2b3c4d5e6f789012346",
  "roadmap": {}
}
```
