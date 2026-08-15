import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { decisionAddCommand } from "../src/commands/decision.js";
import { learningAddCommand } from "../src/commands/learning.js";
import { handoffCommand } from "../src/commands/handoff.js";
import { annotateFindingsWithLearnings, loadLearnings } from "../src/core/learnings.js";
import { runDefaultChecks } from "../src/checks/defaultChecks.js";
import { readJson } from "../src/core/workspace.js";
import type { HandoffManifest } from "../src/commands/handoff.js";

const FDE_YAML = `apiVersion: openfde.dev/v1alpha1
kind: Engagement
metadata:
  name: handoff-fixture
spec:
  customer:
    name: acme
  objective:
    summary: Ship the support agent
  ownership:
    owner: Phil
    contacts:
      - name: Dana
        role: customer platform lead
  systems:
    - id: customer_db
      type: postgres
      access: read_write
  constraints:
    pii:
      allowExternalModel: false
    humanApproval:
      requiredFor: [refund.execute]
  reliability:
    timeout: 30s
    retry: exponential-backoff
    fallback: human-escalation
`;

function silence(): () => void {
  const originalLog = console.log;
  console.log = () => {};
  return () => {
    console.log = originalLog;
  };
}

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openfde-handoff-"));
  await writeFile(path.join(root, "fde.yaml"), FDE_YAML, "utf8");
  return root;
}

test("decision add numbers ADRs sequentially", async () => {
  const root = await makeRoot();
  const restore = silence();
  try {
    const first = await decisionAddCommand(root, "Use Postgres row-level security", {
      context: "Multi-tenant data isolation",
      decision: "Enable RLS on all tenant tables"
    });
    const second = await decisionAddCommand(root, "Route refunds through approval queue", {});
    assert.match(path.basename(first), /^0001-use-postgres-row-level-security\.md$/);
    assert.match(path.basename(second), /^0002-route-refunds-through-approval-queue\.md$/);

    const content = await readFile(first, "utf8");
    assert.match(content, /# 0001\. Use Postgres row-level security/);
    assert.match(content, /Multi-tenant data isolation/);
    assert.match(content, /## Consequences/);
  } finally {
    restore();
    await rm(root, { recursive: true, force: true });
  }
});

test("learnings annotate matching findings as evidence", async () => {
  const root = await makeRoot();
  const restore = silence();
  try {
    await learningAddCommand(root, "Observability gap hid retry storm", {
      failureMode: "Retries looped invisibly for 3 hours",
      mitigation: "Alert on retry-rate before launch",
      checks: "observability-not-detected"
    });
    const learnings = await loadLearnings(root);
    assert.equal(learnings.length, 1);
    assert.deepEqual(learnings[0].relatedChecks, ["observability-not-detected"]);

    const result = annotateFindingsWithLearnings(
      await runDefaultChecks({ generatedAt: "", root, components: [] }, null),
      learnings
    );
    const finding = result.findings.find((f) => f.id === "observability-not-detected");
    assert.ok(finding);
    assert.ok(
      finding.evidence?.some((e) => e.includes("known failure mode: Observability gap hid retry storm")),
      "finding should carry the learning as evidence"
    );
  } finally {
    restore();
    await rm(root, { recursive: true, force: true });
  }
});

test("handoff generates manifest, markdown, and runbook skeletons", async () => {
  const root = await makeRoot();
  const restore = silence();
  try {
    await learningAddCommand(root, "Refund queue stalls under load", { checks: "reliability-policy-absent" });
    const manifest = await handoffCommand(root);

    assert.equal(manifest.ownership.owner, "Phil");
    assert.equal(manifest.engagement.name, "handoff-fixture");
    assert.deepEqual(manifest.runbooks, ["deploy.md", "incident-triage.md", "rollback.md"]);
    assert.ok(manifest.unresolvedRisks.length > 0);
    assert.ok(manifest.openQuestions.length > 0);
    assert.equal(manifest.learnings[0].title, "Refund queue stalls under load");

    const persisted = await readJson<HandoffManifest>(path.join(root, ".fde", "handoff", "handoff.json"));
    assert.equal(persisted.ownership.owner, "Phil");

    const markdown = await readFile(path.join(root, ".fde", "handoff", "handoff.md"), "utf8");
    assert.match(markdown, /# Engagement Handoff: handoff-fixture/);
    assert.match(markdown, /\*\*Owner:\*\* Phil/);
    assert.match(markdown, /Dana \(customer platform lead\)/);
    assert.match(markdown, /Known failure modes/);

    const rollback = await readFile(path.join(root, ".fde", "runbooks", "rollback.md"), "utf8");
    assert.match(rollback, /customer_db.*read_write/);
    const triage = await readFile(path.join(root, ".fde", "runbooks", "incident-triage.md"), "utf8");
    assert.match(triage, /refund\.execute/);
  } finally {
    restore();
    await rm(root, { recursive: true, force: true });
  }
});

test("handoff never overwrites an existing runbook", async () => {
  const root = await makeRoot();
  const restore = silence();
  try {
    await handoffCommand(root);
    const custom = "# Runbook: Deploy\n\nOur real, hand-written procedure.\n";
    await writeFile(path.join(root, ".fde", "runbooks", "deploy.md"), custom, "utf8");
    await handoffCommand(root);
    assert.equal(await readFile(path.join(root, ".fde", "runbooks", "deploy.md"), "utf8"), custom);
  } finally {
    restore();
    await rm(root, { recursive: true, force: true });
  }
});
