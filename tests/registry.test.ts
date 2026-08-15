import test from "node:test";
import assert from "node:assert/strict";
import { runDefaultChecks, builtinChecks } from "../src/checks/defaultChecks.js";
import type { Inventory } from "../src/core/types.js";
import type { Engagement } from "../src/core/engagement.js";

const emptyInventory: Inventory = { generatedAt: "", root: "/repo", components: [] };

test("--only runs a single check", async () => {
  const result = await runDefaultChecks(emptyInventory, null, { only: ["pii-policy-undefined"] });
  assert.deepEqual(result.findings.map((f) => f.id), ["pii-policy-undefined"]);
});

test("--skip removes a check", async () => {
  const result = await runDefaultChecks(emptyInventory, null, { skip: ["pii-policy-undefined"] });
  assert.equal(result.findings.find((f) => f.id === "pii-policy-undefined"), undefined);
  assert.ok(result.findings.length > 0);
});

test("unknown check ids in only/skip fail with the available ids", async () => {
  await assert.rejects(
    () => runDefaultChecks(emptyInventory, null, { only: ["no-such-check"] }),
    (error: Error) => /Unknown check id "no-such-check"/.test(error.message) && /pii-policy-undefined/.test(error.message)
  );
});

test("severity override with a reason downgrades a finding and records the reason as evidence", async () => {
  const engagement: Engagement = {
    spec: {
      checks: {
        overrides: [
          { id: "pii-policy-undefined", severity: "info", reason: "Customer legal accepted risk on 2026-08-01" }
        ]
      }
    }
  };
  const result = await runDefaultChecks(emptyInventory, engagement);
  const finding = result.findings.find((f) => f.id === "pii-policy-undefined");
  assert.ok(finding);
  assert.equal(finding.severity, "info");
  assert.ok(finding.evidence?.some((e) => e.includes("overridden from critical to info") && e.includes("accepted risk")));
});

test("an override without a reason is rejected", async () => {
  const engagement: Engagement = {
    spec: { checks: { overrides: [{ id: "pii-policy-undefined", severity: "info" }] } }
  };
  await assert.rejects(() => runDefaultChecks(emptyInventory, engagement), /missing a reason/);
});

test("an override for an unknown check id is rejected", async () => {
  const engagement: Engagement = {
    spec: { checks: { overrides: [{ id: "nope", severity: "info", reason: "typo" }] } }
  };
  await assert.rejects(() => runDefaultChecks(emptyInventory, engagement), /unknown check id "nope"/);
});

test("every builtin check has a unique id and a description", async () => {
  const ids = builtinChecks.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const check of builtinChecks) assert.ok(check.description.length > 0, `${check.id} has no description`);
});
