const test = require("node:test");
const assert = require("node:assert/strict");
const moduleOneJourney = require("../src/data/moduleOneJourney");

test("Module 1 contains five valid concept checks", () => {
  assert.equal(moduleOneJourney.topics.length, 5);
  const slugs = new Set();

  moduleOneJourney.topics.forEach((topic) => {
    assert.ok(topic.slug);
    assert.equal(slugs.has(topic.slug), false);
    slugs.add(topic.slug);
    assert.ok(topic.check.question);
    assert.ok(topic.check.options.length >= 3);
    assert.ok(Number.isInteger(topic.check.answerIndex));
    assert.ok(topic.check.answerIndex >= 0);
    assert.ok(topic.check.answerIndex < topic.check.options.length);
    assert.ok(topic.check.explanation);
    assert.ok(topic.lesson.title);
    assert.ok(topic.lesson.intro);
    assert.ok(topic.lesson.definition);
    assert.ok(topic.lesson.example);
    assert.ok(topic.lesson.takeaway);
    assert.ok(["flow", "comparison", "stack", "concept"].includes(topic.lesson.visualType));
    assert.ok(topic.lesson.keyPoints.length >= 3);
  });
});
