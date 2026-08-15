import test from "node:test";
import assert from "node:assert/strict";
import { runDefaultChecks } from "../src/checks/defaultChecks.js";
import type { Inventory } from "../src/core/types.js";
import type { Engagement } from "../src/core/engagement.js";

const inventoryWith = (signals: Partial<NonNullable<Inventory["signals"]>>): Inventory => ({
  generatedAt: "",
  root: "/repo",
  components: [],
  signals: { regions: [], secretSuspects: [], writeSignals: [], ...signals }
});

test("regions outside the declared residency boundary are critical", () => {
  const inventory = inventoryWith({
    regions: [
      { region: "us-east-1", evidence: "main.tf:3" },
      { region: "ap-southeast-1", evidence: "main.tf:9" }
    ]
  });
  const engagement: Engagement = {
    spec: { constraints: { dataResidency: { allowedRegions: ["ap-southeast-1"] } } }
  };
  const result = runDefaultChecks(inventory, engagement);
  const finding = result.findings.find((f) => f.id === "data-residency-violation");
  assert.ok(finding);
  assert.equal(finding.severity, "critical");
  assert.deepEqual(finding.evidence, ["main.tf:3: region us-east-1"]);
});

test("residency check stays silent when all regions are allowed or none are declared", () => {
  const inventory = inventoryWith({ regions: [{ region: "ap-southeast-1", evidence: "main.tf:3" }] });
  const allowed: Engagement = {
    spec: { constraints: { dataResidency: { allowedRegions: ["ap-southeast-1"] } } }
  };
  assert.equal(
    runDefaultChecks(inventory, allowed).findings.find((f) => f.id === "data-residency-violation"),
    undefined
  );
  // No allowedRegions declared → the check does not apply at all.
  assert.equal(
    runDefaultChecks(inventory, null).findings.find((f) => f.id === "data-residency-violation"),
    undefined
  );
});

test("secret suspects produce a critical finding with file:line but never a value", () => {
  const inventory = inventoryWith({
    secretSuspects: [
      { file: ".env", line: 1, kind: "dotenv file in the repository (verify it is not committed)" },
      { file: "src/config.ts", line: 12, kind: "AWS access key id" }
    ]
  });
  const result = runDefaultChecks(inventory, null);
  const finding = result.findings.find((f) => f.id === "secrets-committed");
  assert.ok(finding);
  assert.equal(finding.severity, "critical");
  assert.ok(finding.evidence?.includes("src/config.ts:12 — AWS access key id"));
});

test("write signals against a declared read_only system are critical", () => {
  const inventory = inventoryWith({
    writeSignals: [{ systemType: "postgres", file: "src/db.ts", line: 40, pattern: "SQL INSERT/UPDATE/DELETE" }]
  });
  const engagement: Engagement = {
    spec: { systems: [{ id: "primary_db", type: "postgres", access: "read_only" }] }
  };
  const result = runDefaultChecks(inventory, engagement);
  const finding = result.findings.find((f) => f.id === "write-boundary-violation");
  assert.ok(finding);
  assert.equal(finding.severity, "critical");
  assert.ok(finding.title.includes("primary_db"));
  assert.deepEqual(finding.evidence, ["src/db.ts:40 — SQL INSERT/UPDATE/DELETE"]);
});

test("write signals against a read_write system are fine", () => {
  const inventory = inventoryWith({
    writeSignals: [{ systemType: "postgres", file: "src/db.ts", line: 40, pattern: "SQL INSERT/UPDATE/DELETE" }]
  });
  const engagement: Engagement = {
    spec: { systems: [{ id: "primary_db", type: "postgres", access: "read_write" }] }
  };
  const result = runDefaultChecks(inventory, engagement);
  assert.equal(result.findings.find((f) => f.id === "write-boundary-violation"), undefined);
});

test("success metrics with name and target satisfy the metrics check", () => {
  const engagement: Engagement = {
    spec: { successMetrics: [{ name: "resolution_rate", target: ">= 0.70" }] }
  };
  const result = runDefaultChecks(inventoryWith({}), engagement);
  assert.equal(result.findings.find((f) => f.id === "success-metrics-undeclared"), undefined);

  const incomplete: Engagement = { spec: { successMetrics: [{ name: "resolution_rate" }] } };
  const finding = runDefaultChecks(inventoryWith({}), incomplete).findings.find(
    (f) => f.id === "success-metrics-undeclared"
  );
  assert.ok(finding);
});
