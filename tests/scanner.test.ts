import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scanRepository } from "../src/scanners/repo.js";

async function makeFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openfde-scan-"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ name: "fixture", dependencies: { openai: "^4.0.0", pg: "^8.0.0" } }),
    "utf8"
  );
  await writeFile(path.join(root, "Dockerfile"), "FROM node:20\n", "utf8");
  await writeFile(
    path.join(root, "main.tf"),
    'provider "aws" {\n  region = "us-east-1"\n}\n',
    "utf8"
  );
  await mkdir(path.join(root, ".github", "workflows"), { recursive: true });
  await writeFile(path.join(root, ".github", "workflows", "ci.yml"), "name: CI\n", "utf8");
  // Declared-only signal: must NOT count as repository discovery.
  await writeFile(path.join(root, "fde.yaml"), "spec:\n  systems:\n    - type: sentry\n", "utf8");
  // Planted fake signals for the constraint scanners. Fake credential, never real.
  await writeFile(path.join(root, ".env"), "DATABASE_URL=postgres://localhost/db\n", "utf8");
  await writeFile(path.join(root, ".env.example"), "DATABASE_URL=\n", "utf8");
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "src", "db.ts"),
    'const q = "INSERT INTO tickets VALUES ($1)";\nconst key = "AKIAABCDEFGHIJKLMNOP";\n',
    "utf8"
  );
  return root;
}

test("scanRepository detects components with file evidence", async () => {
  const root = await makeFixture();
  try {
    const inventory = await scanRepository(root);
    const byId = new Map(inventory.components.map((c) => [c.id, c]));

    assert.ok(byId.has("nodejs"));
    assert.ok(byId.has("docker"));
    assert.ok(byId.has("terraform"));
    assert.ok(byId.has("github-actions"));
    assert.ok(byId.has("aws"));

    const openai = byId.get("openai");
    assert.ok(openai);
    assert.deepEqual(openai.evidence, ["package.json"]);

    const postgres = byId.get("postgres");
    assert.ok(postgres);
    assert.ok(postgres.evidence.includes("package.json"));

    // sentry appears only in fde.yaml, which is engagement input, not discovery.
    assert.equal(byId.get("sentry"), undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("scanRepository extracts region, secret, and write signals with file:line evidence", async () => {
  const root = await makeFixture();
  try {
    const inventory = await scanRepository(root);
    const signals = inventory.signals;
    assert.ok(signals);

    assert.deepEqual(signals.regions, [{ region: "us-east-1", evidence: "main.tf:2" }]);

    const kinds = signals.secretSuspects.map((s) => `${s.file}: ${s.kind}`);
    assert.ok(kinds.includes(".env: dotenv file in the repository (verify it is not committed)"));
    assert.ok(kinds.includes(`${path.join("src", "db.ts")}: AWS access key id`));
    // .env.example is a template, not a committed secret.
    assert.ok(!kinds.some((k) => k.startsWith(".env.example")));
    // Secret values must never be persisted in the inventory.
    assert.ok(!JSON.stringify(inventory).includes("AKIAABCDEFGHIJKLMNOP"));

    const writes = signals.writeSignals.filter((w) => w.systemType === "postgres");
    assert.deepEqual(writes, [
      { systemType: "postgres", file: path.join("src", "db.ts"), line: 1, pattern: "SQL INSERT/UPDATE/DELETE" }
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("scanRepository ignores the .fde workspace", async () => {
  const root = await makeFixture();
  try {
    await mkdir(path.join(root, ".fde"), { recursive: true });
    await writeFile(path.join(root, ".fde", "notes.ts"), "import redis from 'redis'\n", "utf8");
    const inventory = await scanRepository(root);
    assert.equal(inventory.components.find((c) => c.id === "redis"), undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
