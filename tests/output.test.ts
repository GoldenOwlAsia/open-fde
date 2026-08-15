import test from "node:test";
import assert from "node:assert/strict";
import { shouldFail } from "../src/commands/check.js";
import { toSarif } from "../src/report/sarif.js";
import { builtinChecks, runDefaultChecks } from "../src/checks/defaultChecks.js";
import type { Finding, Inventory } from "../src/core/types.js";

const finding = (severity: Finding["severity"]): Finding => ({
  id: "x",
  title: "x",
  severity,
  category: "security",
  explanation: "x"
});

test("shouldFail implements the --fail-on policy", () => {
  assert.equal(shouldFail([finding("critical")], "critical"), true);
  assert.equal(shouldFail([finding("warning")], "critical"), false);
  assert.equal(shouldFail([finding("warning")], "warning"), true);
  assert.equal(shouldFail([finding("info")], "warning"), false);
  assert.equal(shouldFail([finding("critical")], "never"), false);
  assert.equal(shouldFail([], "warning"), false);
});

test("SARIF output is valid 2.1.0 with rules, levels, and file locations", () => {
  const inventory: Inventory = {
    generatedAt: "",
    root: "/repo",
    components: [],
    signals: {
      regions: [],
      secretSuspects: [{ file: "src/config.ts", line: 12, kind: "AWS access key id" }],
      writeSignals: []
    }
  };
  const result = runDefaultChecks(inventory, null);
  const sarif = toSarif(result, builtinChecks, "0.1.0") as {
    version: string;
    runs: Array<{
      tool: { driver: { name: string; rules: Array<{ id: string }> } };
      results: Array<{
        ruleId: string;
        level: string;
        locations: Array<{ physicalLocation: { artifactLocation: { uri: string }; region?: { startLine: number } } }>;
      }>;
    }>;
  };

  assert.equal(sarif.version, "2.1.0");
  const run = sarif.runs[0];
  assert.equal(run.tool.driver.name, "OpenFDE");
  // Every builtin check is published as a rule.
  assert.deepEqual(run.tool.driver.rules.map((r) => r.id).sort(), builtinChecks.map((c) => c.id).sort());

  const secrets = run.results.find((r) => r.ruleId === "secrets-committed");
  assert.ok(secrets);
  assert.equal(secrets.level, "error");
  assert.deepEqual(secrets.locations[0].physicalLocation, {
    artifactLocation: { uri: "src/config.ts" },
    region: { startLine: 12 }
  });

  const pii = run.results.find((r) => r.ruleId === "pii-policy-undefined");
  assert.ok(pii);
  assert.equal(pii.level, "error");
  // No file evidence → falls back to fde.yaml so code scanning can anchor it.
  assert.equal(pii.locations[0].physicalLocation.artifactLocation.uri, "fde.yaml");
});

test("check-result JSON shape is stable", () => {
  const result = runDefaultChecks({ generatedAt: "", root: "/repo", components: [] }, null);
  assert.deepEqual(Object.keys(result).sort(), ["findings", "generatedAt", "overallScore", "scores"]);
  for (const f of result.findings) {
    assert.ok(f.id && f.title && f.severity && f.category && f.explanation);
  }
});
