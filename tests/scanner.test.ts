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
  await writeFile(path.join(root, "main.tf"), 'provider "aws" {}\n', "utf8");
  await mkdir(path.join(root, ".github", "workflows"), { recursive: true });
  await writeFile(path.join(root, ".github", "workflows", "ci.yml"), "name: CI\n", "utf8");
  // Declared-only signal: must NOT count as repository discovery.
  await writeFile(path.join(root, "fde.yaml"), "spec:\n  systems:\n    - type: sentry\n", "utf8");
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
    assert.deepEqual(postgres.evidence, ["package.json"]);

    // sentry appears only in fde.yaml, which is engagement input, not discovery.
    assert.equal(byId.get("sentry"), undefined);
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
