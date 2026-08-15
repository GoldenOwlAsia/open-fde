import test from "node:test";
import assert from "node:assert/strict";
import { redactText, redactValue } from "../src/core/redact.js";

// Every secret below is a planted fake. The suite's contract: after
// redaction, none of these strings may survive in the output.

const PLANTED: Array<{ kind: string; text: string; secret: string }> = [
  { kind: "aws-access-key-id", text: "key = AKIAIOSFODNN7EXAMPLE", secret: "AKIAIOSFODNN7EXAMPLE" },
  {
    kind: "private-key",
    text: "-----BEGIN RSA PRIVATE KEY-----\nMIIfakefakefake\n-----END RSA PRIVATE KEY-----",
    secret: "MIIfakefakefake"
  },
  {
    kind: "jwt",
    text: "auth eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9P",
    secret: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9P"
  },
  { kind: "slack-token", text: "hook xoxb-123456789012-fakefakefake", secret: "xoxb-123456789012-fakefakefake" },
  { kind: "github-token", text: "push ghp_abcdefghijklmnopqrst123456", secret: "ghp_abcdefghijklmnopqrst123456" },
  { kind: "bearer-token", text: "Authorization: Bearer abcdef1234567890abcdef", secret: "abcdef1234567890abcdef" },
  {
    kind: "connection-string-password",
    text: "url: postgres://app:hunter2secret@db.internal:5432/prod",
    secret: "hunter2secret"
  },
  { kind: "credential-assignment", text: 'api_key = "sk-fake-1234567890abcdef"', secret: "sk-fake-1234567890abcdef" }
];

test("every planted secret is removed and counted by kind", () => {
  for (const planted of PLANTED) {
    const { text, redactions } = redactText(planted.text);
    assert.ok(!text.includes(planted.secret), `${planted.kind}: secret survived redaction`);
    assert.ok(
      redactions.some((r) => r.kind === planted.kind && r.count >= 1),
      `${planted.kind}: not counted (got ${JSON.stringify(redactions)})`
    );
  }
});

test("redaction preserves non-secret context", () => {
  const { text } = redactText("url: postgres://app:hunter2secret@db.internal:5432/prod");
  assert.ok(text.includes("postgres://app:"));
  assert.ok(text.includes("@db.internal:5432/prod"));
  const bearer = redactText("Authorization: Bearer abcdef1234567890abcdef").text;
  assert.ok(bearer.includes("Bearer [REDACTED:token]"));
});

test("benign text passes through untouched", () => {
  const input = "The service listens on port 5432 and retries with exponential backoff.";
  const { text, redactions } = redactText(input);
  assert.equal(text, input);
  assert.deepEqual(redactions, []);
});

test("redactValue deep-redacts nested structures", () => {
  const counts = new Map<string, number>();
  const value = redactValue(
    {
      config: { db: "postgres://app:topsecretpw@host/db" },
      list: ["AKIAIOSFODNN7EXAMPLE", "plain"],
      number: 42
    },
    counts
  );
  const serialized = JSON.stringify(value);
  assert.ok(!serialized.includes("topsecretpw"));
  assert.ok(!serialized.includes("AKIAIOSFODNN7EXAMPLE"));
  assert.ok(serialized.includes("plain"));
  assert.equal(value.number, 42);
  assert.ok((counts.get("aws-access-key-id") ?? 0) >= 1);
});
