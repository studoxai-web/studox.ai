const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizePrivateKey } = require("../src/config/firebaseAdmin");

test("normalizes escaped-newline Firebase private keys", () => {
  const key = '"-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----"';
  assert.equal(
    normalizePrivateKey(key),
    "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----",
  );
});

test("removes an unmatched quote left by a pasted multiline env value", () => {
  const key = '"-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----\n';
  assert.equal(
    normalizePrivateKey(key),
    "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----",
  );
});
