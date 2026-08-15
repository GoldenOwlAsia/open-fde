import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runDefaultChecks } from "../src/checks/defaultChecks.js";
import type { Inventory } from "../src/core/types.js";
import type { Engagement } from "../src/core/engagement.js";

const inventoryFor = (root: string): Inventory => ({ generatedAt: "", root, components: [] });

const engagementWith = (suites: NonNullable<NonNullable<Engagement["spec"]>["evaluation"]>["suites"]): Engagement => ({
  spec: { evaluation: { required: true, suites } }
});

test("missing eval artifact is critical when requiredBeforeDeploy", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openfde-eval-"));
  try {
    const engagement = engagementWith([
      { name: "regression-core", type: "regression", location: ".fde/evals/regression-core", requiredBeforeDeploy: true },
      { name: "optional-suite", type: "task-success", location: ".fde/evals/optional" }
    ]);
    const result = await runDefaultChecks(inventoryFor(root), engagement);
    const findings = result.findings.filter((f) => f.id === "eval-artifact-missing");
    assert.equal(findings.length, 2);
    assert.equal(findings.find((f) => f.title.includes("regression-core"))?.severity, "critical");
    assert.equal(findings.find((f) => f.title.includes("optional-suite"))?.severity, "warning");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("existing artifact satisfies the existence check", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openfde-eval-"));
  try {
    await mkdir(path.join(root, ".fde", "evals", "regression-core"), { recursive: true });
    await writeFile(path.join(root, ".fde", "evals", "regression-core", "results.jsonl"), "{}\n", "utf8");
    const engagement = engagementWith([
      { name: "regression-core", type: "regression", location: ".fde/evals/regression-core", requiredBeforeDeploy: true }
    ]);
    const result = await runDefaultChecks(inventoryFor(root), engagement);
    assert.equal(result.findings.find((f) => f.id === "eval-artifact-missing"), undefined);
    assert.equal(result.findings.find((f) => f.id === "eval-artifact-stale"), undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("artifact older than maxAgeDays is stale", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openfde-eval-"));
  try {
    const dir = path.join(root, ".fde", "evals", "regression-core");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, "results.jsonl");
    await writeFile(file, "{}\n", "utf8");
    const fortyDaysAgo = new Date(Date.now() - 40 * 86_400_000);
    await utimes(file, fortyDaysAgo, fortyDaysAgo);
    await utimes(dir, fortyDaysAgo, fortyDaysAgo);

    const engagement = engagementWith([
      { name: "regression-core", type: "regression", location: ".fde/evals/regression-core", maxAgeDays: 30 }
    ]);
    const result = await runDefaultChecks(inventoryFor(root), engagement);
    const finding = result.findings.find((f) => f.id === "eval-artifact-stale");
    assert.ok(finding);
    assert.equal(finding.severity, "warning");
    assert.ok(finding.evidence?.some((e) => e.includes("maxAgeDays is 30")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
