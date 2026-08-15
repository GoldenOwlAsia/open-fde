import test from "node:test";
import assert from "node:assert/strict";
import { runDefaultChecks } from "../src/checks/defaultChecks.js";
import type { Inventory } from "../src/core/types.js";
import type { Engagement } from "../src/core/engagement.js";

const emptyInventory: Inventory = { generatedAt: "", root: "/repo", components: [] };

const fullEngagement: Engagement = {
  spec: {
    systems: [{ id: "error_monitoring", type: "sentry", access: "unknown" }],
    constraints: {
      pii: { allowExternalModel: false },
      humanApproval: { requiredFor: ["refund.execute"] }
    },
    reliability: { timeout: "30s", retry: "exponential-backoff", fallback: "human-escalation" },
    evaluation: { required: true }
  }
};

test("missing engagement produces the default findings", () => {
  const result = runDefaultChecks(emptyInventory, null);
  const ids = result.findings.map((f) => f.id).sort();
  assert.deepEqual(ids, [
    "evaluation-not-declared",
    "human-approval-undefined",
    "observability-not-detected",
    "pii-policy-undefined",
    "reliability-policy-absent"
  ]);
  assert.equal(result.findings.find((f) => f.id === "pii-policy-undefined")?.severity, "critical");
});

test("fully declared engagement passes all checks", () => {
  const result = runDefaultChecks(emptyInventory, fullEngagement);
  assert.deepEqual(result.findings, []);
  assert.equal(result.overallScore, 100);
});

test("detected AI provider without external model policy is flagged", () => {
  const inventory: Inventory = {
    generatedAt: "",
    root: "/repo",
    components: [
      { id: "openai", name: "OpenAI", category: "ai", evidence: ["package.json"], confidence: "medium" }
    ]
  };
  const result = runDefaultChecks(inventory, null);
  const finding = result.findings.find((f) => f.id === "external-model-policy-undefined");
  assert.ok(finding);
  assert.ok(finding.evidence?.some((e) => e.includes("package.json")));
});

test("declared external model policy silences the security check", () => {
  const inventory: Inventory = {
    generatedAt: "",
    root: "/repo",
    components: [
      { id: "anthropic", name: "Anthropic", category: "ai", evidence: ["src/llm.ts"], confidence: "medium" }
    ]
  };
  const result = runDefaultChecks(inventory, fullEngagement);
  assert.equal(result.findings.find((f) => f.id === "external-model-policy-undefined"), undefined);
});

test("empty humanApproval.requiredFor still warns", () => {
  const engagement: Engagement = {
    spec: { constraints: { humanApproval: { requiredFor: [] } } }
  };
  const result = runDefaultChecks(emptyInventory, engagement);
  assert.ok(result.findings.some((f) => f.id === "human-approval-undefined"));
});

test("every finding carries evidence", () => {
  const result = runDefaultChecks(emptyInventory, null);
  for (const finding of result.findings) {
    assert.ok(finding.evidence && finding.evidence.length > 0, `${finding.id} has no evidence`);
  }
});
