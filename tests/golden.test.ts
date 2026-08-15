import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanCommand } from "../src/commands/scan.js";
import { mapCommand } from "../src/commands/map.js";
import { checkCommand } from "../src/commands/check.js";
import { reportCommand } from "../src/commands/report.js";

// Golden-file tests: run the full pipeline on a deterministic fixture and
// compare the generated artifacts byte-for-byte after normalizing the two
// nondeterministic values (timestamps, absolute root path).
// Regenerate with: UPDATE_GOLDEN=1 pnpm test

const goldenDir = path.join(fileURLToPath(import.meta.url), "..", "golden");
const UPDATE = process.env.UPDATE_GOLDEN === "1";

const FDE_YAML = `apiVersion: openfde.dev/v1alpha1
kind: Engagement
metadata:
  name: golden-fixture
spec:
  customer:
    name: acme
  objective:
    summary: Golden-file fixture engagement
  successMetrics:
    - name: resolution_rate
      target: ">= 0.70"
  environment:
    cloud: aws
    regions: [ap-southeast-1]
  systems:
    - id: primary_db
      type: postgres
      access: read_only
  constraints:
    dataResidency:
      allowedRegions: [ap-southeast-1]
    pii:
      allowExternalModel: false
    humanApproval:
      requiredFor: [refund.execute]
`;

async function makeFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openfde-golden-"));
  await writeFile(path.join(root, "fde.yaml"), FDE_YAML, "utf8");
  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "golden", dependencies: { openai: "^4.0.0", pg: "^8.0.0" } }, null, 2)}\n`,
    "utf8"
  );
  await writeFile(path.join(root, "main.tf"), 'provider "aws" {\n  region = "us-east-1"\n}\n', "utf8");
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src", "db.ts"), 'const q = "INSERT INTO tickets VALUES ($1)";\n', "utf8");
  return root;
}

function normalize(content: string, root: string): string {
  return content
    .replaceAll(root, "<ROOT>")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, "<TIMESTAMP>");
}

async function assertGolden(name: string, actual: string): Promise<void> {
  const goldenPath = path.join(goldenDir, name);
  if (UPDATE) {
    await mkdir(goldenDir, { recursive: true });
    await writeFile(goldenPath, actual, "utf8");
    return;
  }
  const expected = await readFile(goldenPath, "utf8");
  assert.equal(actual, expected, `${name} drifted from its golden file (regenerate with UPDATE_GOLDEN=1 if intended)`);
}

test("pipeline artifacts match their golden files", async () => {
  const root = await makeFixture();
  const originalLog = console.log;
  console.log = () => {};
  try {
    await scanCommand(root);
    await mapCommand(root);
    await checkCommand(root, { failOn: "never" });
    await reportCommand(root);
  } finally {
    console.log = originalLog;
  }

  try {
    const artifacts = [
      ["environment/inventory.json", "inventory.json"],
      ["environment/integration-graph.json", "integration-graph.json"],
      ["environment/integration-graph.mmd", "integration-graph.mmd"],
      ["check-result.json", "check-result.json"],
      ["report.md", "report.md"]
    ] as const;
    for (const [artifact, golden] of artifacts) {
      const content = await readFile(path.join(root, ".fde", artifact), "utf8");
      await assertGolden(golden, normalize(content, root));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
