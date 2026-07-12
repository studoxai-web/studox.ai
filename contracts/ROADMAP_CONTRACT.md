# Roadmap Service JSON Contract

Roadmap object returned by:

```text
POST /api/roadmaps/generate
```

Each response must contain exactly three roadmap objects inside:

```json
{
  "roadmaps": [
    {}
  ]
}
```

Roadmap object shape:

```json
{
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
```

Current Roadmap schema also allows:

```json
{
  "status": "archived"
}
```
