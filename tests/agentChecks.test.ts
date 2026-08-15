import test from "node:test";
import assert from "node:assert/strict";
import { runDefaultChecks } from "../src/checks/defaultChecks.js";
import type { Inventory } from "../src/core/types.js";
import type { Engagement } from "../src/core/engagement.js";

const emptyInventory: Inventory = { generatedAt: "", root: "/repo", components: [] };

const base = (agents: NonNullable<Engagement["spec"]>["agents"], requiredFor: string[] = []): Engagement => ({
  spec: {
    systems: [
      { id: "customer_db", type: "postgres", access: "read_only" },
      { id: "crm", type: "salesforce", access: "read_write" }
    ],
    constraints: { humanApproval: { requiredFor } },
    agents
  }
});

test("side-effecting tool without an approval entry is critical", async () => {
  const engagement = base([
    { id: "support", tools: [{ id: "issue_refund", system: "crm", access: "read_write", sideEffects: true }] }
  ]);
  const result = await runDefaultChecks(emptyInventory, engagement);
  const finding = result.findings.find((f) => f.id === "agent-side-effect-unapproved");
  assert.ok(finding);
  assert.equal(finding.severity, "critical");
  assert.ok(finding.title.includes("issue_refund"));
});

test("approval entries match by tool id or agent.tool id", async () => {
  const byToolId = base(
    [{ id: "support", tools: [{ id: "issue_refund", system: "crm", sideEffects: true }] }],
    ["issue_refund"]
  );
  const byQualifiedId = base(
    [{ id: "support", tools: [{ id: "issue_refund", system: "crm", sideEffects: true }] }],
    ["support.issue_refund"]
  );
  for (const engagement of [byToolId, byQualifiedId]) {
    const result = await runDefaultChecks(emptyInventory, engagement);
    assert.equal(result.findings.find((f) => f.id === "agent-side-effect-unapproved"), undefined);
  }
});

test("tool writing to a read_only system exceeds the boundary", async () => {
  const engagement = base(
    [{ id: "support", tools: [{ id: "record_resolution", system: "customer_db", access: "read_write" }] }],
    ["record_resolution"]
  );
  const result = await runDefaultChecks(emptyInventory, engagement);
  const finding = result.findings.find((f) => f.id === "agent-access-exceeds-boundary");
  assert.ok(finding);
  assert.equal(finding.severity, "critical");
  assert.ok(finding.evidence?.some((e) => e.includes("read_only")));
});

test("side-effecting tool against a read_only system also exceeds the boundary", async () => {
  const engagement = base(
    [{ id: "support", tools: [{ id: "purge", system: "customer_db", sideEffects: true }] }],
    ["purge"]
  );
  const result = await runDefaultChecks(emptyInventory, engagement);
  assert.ok(result.findings.some((f) => f.id === "agent-access-exceeds-boundary"));
});

test("read-only tool on a read_only system is fine", async () => {
  const engagement = base([
    { id: "support", tools: [{ id: "lookup", system: "customer_db", access: "read_only" }] }
  ]);
  const result = await runDefaultChecks(emptyInventory, engagement);
  assert.equal(result.findings.find((f) => f.id === "agent-access-exceeds-boundary"), undefined);
});

test("tool referencing an undeclared system warns", async () => {
  const engagement = base([
    { id: "support", tools: [{ id: "lookup", system: "mystery_api", access: "read_only" }] }
  ]);
  const result = await runDefaultChecks(emptyInventory, engagement);
  const finding = result.findings.find((f) => f.id === "agent-tool-system-undeclared");
  assert.ok(finding);
  assert.equal(finding.severity, "warning");
  assert.ok(finding.title.includes("mystery_api"));
});

test("agent checks do not apply without declared agents", async () => {
  const result = await runDefaultChecks(emptyInventory, null);
  for (const id of ["agent-side-effect-unapproved", "agent-access-exceeds-boundary", "agent-tool-system-undeclared"]) {
    assert.equal(result.findings.find((f) => f.id === id), undefined);
  }
});
