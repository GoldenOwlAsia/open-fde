import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scanRepository } from "../src/scanners/repo.js";

// Per-scanner-family fixtures: each asserts what MUST be detected and what
// MUST NOT be (false-positive regression suite).

async function scanFixture(files: Record<string, string>): Promise<Set<string>> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openfde-fixture-"));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(root, ...rel.split("/"));
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, content, "utf8");
    }
    const inventory = await scanRepository(root);
    return new Set(inventory.components.map((c) => c.id));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("python family: requirements.txt without node signals", async () => {
  const ids = await scanFixture({
    "requirements.txt": "flask==3.0.0\nnumpy==2.0.0\n",
    "app.py": "import flask\n"
  });
  assert.ok(ids.has("python"));
  assert.ok(!ids.has("nodejs"));
  assert.ok(!ids.has("aws"));
});

test("docker family: compose file alone counts as docker", async () => {
  const ids = await scanFixture({ "docker-compose.yml": "services: {}\n" });
  assert.ok(ids.has("docker"));
  assert.ok(!ids.has("kubernetes"));
});

test("kubernetes family: manifests under a k8s directory", async () => {
  const ids = await scanFixture({ "k8s/deployment.yaml": "kind: Deployment\n" });
  assert.ok(ids.has("kubernetes"));
  assert.ok(!ids.has("docker"));
});

test("cicd family: workflows are github-actions, not kubernetes", async () => {
  const ids = await scanFixture({ ".github/workflows/ci.yml": "name: CI\n" });
  assert.ok(ids.has("github-actions"));
  assert.ok(!ids.has("kubernetes"));
});

test("data family: redis and postgres from python deps", async () => {
  const ids = await scanFixture({ "requirements.txt": "redis==5.0.0\npsycopg2-binary==2.9.0\n" });
  assert.ok(ids.has("redis"));
  assert.ok(!ids.has("openai"));
});

test("ai family: anthropic import in python", async () => {
  const ids = await scanFixture({ "agent.py": "import anthropic\nclient = anthropic.Anthropic()\n" });
  assert.ok(ids.has("anthropic"));
  assert.ok(!ids.has("openai"));
});

test("observability family: opentelemetry package", async () => {
  const ids = await scanFixture({
    "package.json": JSON.stringify({ dependencies: { "@opentelemetry/api": "^1.0.0" } })
  });
  assert.ok(ids.has("opentelemetry"));
  assert.ok(!ids.has("sentry"));
});

test("auth family: okta as a word, not inside other words", async () => {
  const ids = await scanFixture({ "auth.ts": 'import { OktaAuth } from "@okta/okta-auth-js";\n' });
  assert.ok(ids.has("okta"));
});

test("false positives: benign words never trigger detections", async () => {
  const ids = await scanFixture({
    "notes.ts": [
      "// the flaws_found counter tracks audit results",
      "const telemetry = 1;",
      "const dysentery = 'medical term';",
      "const postgraduate = true;",
      "export const hotelier = 'runs a hotel';"
    ].join("\n")
  });
  assert.ok(!ids.has("aws"), "flaws_ must not match aws_");
  assert.ok(!ids.has("opentelemetry"), "telemetry/hotelier must not match otel");
  assert.ok(!ids.has("sentry"), "dysentery must not match sentry");
  assert.ok(!ids.has("postgres"), "postgraduate must not match postgres");
  assert.ok(!ids.has("redis"));
});

test("terraform aws provider is cloud evidence", async () => {
  const ids = await scanFixture({ "main.tf": 'provider "aws" {}\n' });
  assert.ok(ids.has("terraform"));
  assert.ok(ids.has("aws"));
});
