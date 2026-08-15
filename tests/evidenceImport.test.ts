import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { evidenceAddCommand } from "../src/commands/evidence.js";
import { importIncidentCommand, importTraceCommand } from "../src/commands/importCmd.js";
import { replayCommand } from "../src/commands/replay.js";
import { statusCommand } from "../src/commands/status.js";
import { readJson } from "../src/core/workspace.js";
import { mkdir } from "node:fs/promises";

const FDE_YAML = `apiVersion: openfde.dev/v1alpha1
kind: Engagement
metadata:
  name: evidence-fixture
spec:
  customer:
    name: acme
  objective:
    summary: test
  systems:
    - id: customers
      type: postgres
      access: read_only
`;

const OTLP = {
  resourceSpans: [
    {
      resource: { attributes: [{ key: "service.name", value: { stringValue: "support-agent" } }] },
      scopeSpans: [
        {
          spans: [
            {
              traceId: "t1",
              spanId: "s1",
              name: "customers.lookup",
              startTimeUnixNano: "1000000000",
              endTimeUnixNano: "3000000000",
              status: { code: 1 },
              attributes: [
                { key: "response.id", value: { stringValue: "123" } },
                { key: "response.name", value: { stringValue: "Ada" } },
                { key: "response.plan", value: { stringValue: "pro" } },
                { key: "db.password", value: { stringValue: "postgres://app:plantedpw123@db/prod" } }
              ]
            },
            { traceId: "t1", spanId: "s2", name: "payments.refund", status: { code: 2 }, attributes: [] }
          ]
        }
      ]
    }
  ]
};

const CONTRACT = `system: customers
cases:
  - name: lookup by email
    request:
      operation: customers.lookup
    response:
      example: { id: "123", name: "Ada", plan: "pro" }
      requiredFields: [id, name, plan]
  - name: merge accounts
    request:
      operation: customers.merge
    response:
      example: { merged: true }
      requiredFields: [merged]
`;

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openfde-evidence-"));
  await writeFile(path.join(root, "fde.yaml"), FDE_YAML, "utf8");
  return root;
}

function silence(): () => void {
  const originalLog = console.log;
  console.log = () => {};
  return () => {
    console.log = originalLog;
  };
}

test("evidence add redacts secrets and never persists the raw value", async () => {
  const root = await makeRoot();
  const restore = silence();
  try {
    const sourceFile = path.join(root, "deploy-notes.txt");
    await writeFile(sourceFile, "deploy log\napi_key = \"sk-fake-1234567890abcdef\"\nall good\n", "utf8");
    const entry = await evidenceAddCommand(root, sourceFile);
    assert.ok(entry.redactions.some((r) => r.kind === "credential-assignment"));

    const stored = await readFile(path.join(root, ".fde", "evidence", "deploy-notes.txt"), "utf8");
    assert.ok(!stored.includes("sk-fake-1234567890abcdef"));
    assert.ok(stored.includes("deploy log"));

    const index = await readJson<unknown[]>(path.join(root, ".fde", "evidence", "index.json"));
    assert.equal(index.length, 1);
    assert.ok(!JSON.stringify(index).includes("sk-fake-1234567890abcdef"));
  } finally {
    restore();
    await rm(root, { recursive: true, force: true });
  }
});

test("evidence add refuses binary files", async () => {
  const root = await makeRoot();
  const restore = silence();
  try {
    const binary = path.join(root, "dump.bin");
    await writeFile(binary, Buffer.from([1, 2, 0, 4]));
    await assert.rejects(() => evidenceAddCommand(root, binary), /Binary evidence is not supported/);
  } finally {
    restore();
    await rm(root, { recursive: true, force: true });
  }
});

test("trace import normalizes OTLP spans and redacts attribute values", async () => {
  const root = await makeRoot();
  const restore = silence();
  try {
    const otlpFile = path.join(root, "prod-trace.json");
    await writeFile(otlpFile, JSON.stringify(OTLP), "utf8");
    const trace = await importTraceCommand(root, otlpFile);

    assert.equal(trace.spans.length, 2);
    const lookup = trace.spans.find((s) => s.name === "customers.lookup");
    assert.ok(lookup);
    assert.equal(lookup.serviceName, "support-agent");
    assert.equal(lookup.status, "ok");
    assert.equal(lookup.durationMs, 2000);
    assert.equal(trace.spans.find((s) => s.name === "payments.refund")?.status, "error");

    const persisted = await readFile(path.join(root, ".fde", "traces", "prod-trace.json"), "utf8");
    assert.ok(!persisted.includes("plantedpw123"), "recorded password must be redacted");
  } finally {
    restore();
    await rm(root, { recursive: true, force: true });
  }
});

test("replay verifies exercised contract cases against recorded spans", async () => {
  const root = await makeRoot();
  const restore = silence();
  try {
    await writeFile(path.join(root, "prod-trace.json"), JSON.stringify(OTLP), "utf8");
    await importTraceCommand(root, path.join(root, "prod-trace.json"));
    await mkdir(path.join(root, ".fde", "contracts"), { recursive: true });
    await writeFile(path.join(root, ".fde", "contracts", "customers.yaml"), CONTRACT, "utf8");

    const summary = await replayCommand(root, "prod-trace");
    const lookup = summary.cases.find((c) => c.case === "lookup by email");
    assert.equal(lookup?.verdict, "verified");
    const merge = summary.cases.find((c) => c.case === "merge accounts");
    assert.equal(merge?.verdict, "not-exercised");
    assert.equal(summary.errorSpans.length, 1);
  } finally {
    restore();
    process.exitCode = undefined;
    await rm(root, { recursive: true, force: true });
  }
});

test("incident import links referenced systems to declarations", async () => {
  const root = await makeRoot();
  const restore = silence();
  try {
    const incidentFile = path.join(root, "incident.yaml");
    await writeFile(
      incidentFile,
      [
        "title: Refund queue stalled",
        "severity: sev2",
        "startedAt: 2026-08-10T04:00:00Z",
        "systems: [customers, payments]",
        'summary: "worker crashed; token = ghp_abcdefghijklmnopqrst123456"'
      ].join("\n"),
      "utf8"
    );
    const incident = await importIncidentCommand(root, incidentFile);
    assert.equal(incident.id, "refund-queue-stalled");
    assert.deepEqual(incident.systems, [
      { id: "customers", declared: true },
      { id: "payments", declared: false }
    ]);
    const persisted = await readFile(path.join(root, ".fde", "incidents", "refund-queue-stalled.json"), "utf8");
    assert.ok(!persisted.includes("ghp_abcdefghijklmnopqrst123456"));
  } finally {
    restore();
    await rm(root, { recursive: true, force: true });
  }
});

test("status reports declared vs observed from imported evidence", async () => {
  const root = await makeRoot();
  const restore = silence();
  try {
    await writeFile(path.join(root, "prod-trace.json"), JSON.stringify(OTLP), "utf8");
    await importTraceCommand(root, path.join(root, "prod-trace.json"));

    const summary = await statusCommand(root);
    assert.deepEqual(summary.declaredSystems, [{ id: "customers", observed: true }]);
    assert.ok(summary.observedUndeclared.includes("payments"));
    assert.equal(summary.traces, 1);
    assert.equal(summary.errorSpans, 1);
    assert.equal(summary.incidents.total, 0);
  } finally {
    restore();
    await rm(root, { recursive: true, force: true });
  }
});
