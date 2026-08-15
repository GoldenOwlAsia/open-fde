import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initCommand } from "../src/commands/init.js";
import { scanCommand } from "../src/commands/scan.js";
import { mapCommand } from "../src/commands/map.js";
import { checkCommand } from "../src/commands/check.js";
import { reportCommand } from "../src/commands/report.js";
import { exists, readJson } from "../src/core/workspace.js";
import type { CheckResult, IntegrationGraph } from "../src/core/types.js";

test("init → scan → map → check → report produces all artifacts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openfde-e2e-"));
  try {
    await initCommand(root);
    assert.ok(await exists(path.join(root, "fde.yaml")));

    await scanCommand(root);
    assert.ok(await exists(path.join(root, ".fde", "environment", "inventory.json")));

    await mapCommand(root);
    const graph = await readJson<IntegrationGraph>(
      path.join(root, ".fde", "environment", "integration-graph.json")
    );
    assert.ok(graph.nodes.some((n) => n.id === "app"));
    const mermaid = await readFile(
      path.join(root, ".fde", "environment", "integration-graph.mmd"),
      "utf8"
    );
    assert.match(mermaid, /^flowchart LR/);

    await checkCommand(root);
    const result = await readJson<CheckResult>(path.join(root, ".fde", "check-result.json"));
    // The starter fde.yaml declares a PII policy but leaves reliability and
    // evaluation undeclared, so the preflight must surface real findings.
    assert.ok(result.findings.some((f) => f.id === "reliability-policy-absent"));
    assert.ok(result.findings.some((f) => f.id === "evaluation-not-declared"));
    assert.equal(result.findings.find((f) => f.id === "pii-policy-undefined"), undefined);

    await reportCommand(root);
    const report = await readFile(path.join(root, ".fde", "report.md"), "utf8");
    assert.match(report, /# OpenFDE Deployment Report/);
    assert.match(report, /## Open Questions/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("init preserves an existing fde.yaml", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openfde-init-"));
  try {
    const custom = "kind: Engagement\nmetadata:\n  name: keep-me\n";
    await writeFile(path.join(root, "fde.yaml"), custom, "utf8");
    await initCommand(root);
    assert.equal(await readFile(path.join(root, "fde.yaml"), "utf8"), custom);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
