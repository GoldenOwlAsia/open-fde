import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { testCommand } from "../src/commands/test.js";

const FDE_YAML = `apiVersion: openfde.dev/v1alpha1
kind: Engagement
metadata:
  name: contracts-fixture
spec:
  customer:
    name: acme
  objective:
    summary: test
  systems:
    - id: customer_db
      type: postgres
      access: read_only
`;

const VALID_CONTRACT = `system: customer_db
description: Customer lookup contract
cases:
  - name: lookup by email
    request:
      operation: customers.lookup
      params: { email: user@example.com }
    response:
      example: { id: "123", name: "Ada", plan: "pro" }
      requiredFields: [id, name, plan]
`;

async function makeRoot(contracts: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openfde-contracts-"));
  await writeFile(path.join(root, "fde.yaml"), FDE_YAML, "utf8");
  await mkdir(path.join(root, ".fde", "contracts"), { recursive: true });
  for (const [name, content] of Object.entries(contracts)) {
    await writeFile(path.join(root, ".fde", "contracts", name), content, "utf8");
  }
  return root;
}

async function run(contracts: Record<string, string>) {
  const root = await makeRoot(contracts);
  const originalLog = console.log;
  const originalError = console.error;
  const originalExit = process.exitCode;
  console.log = () => {};
  console.error = () => {};
  try {
    return await testCommand(root, { contracts: true });
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = originalExit; // testCommand sets exitCode on failure
    await rm(root, { recursive: true, force: true });
  }
}

test("a valid contract fixture passes", async () => {
  const summary = await run({ "customer-lookup.yaml": VALID_CONTRACT });
  assert.equal(summary.passed, 1);
  assert.equal(summary.failed, 0);
});

test("a missing required response field fails the case", async () => {
  const summary = await run({
    "broken.yaml": VALID_CONTRACT.replace('id: "123", ', "")
  });
  assert.equal(summary.failed, 1);
  assert.ok(summary.failures.some((f) => f.includes('missing required field "id"')));
});

test("a contract against an undeclared system fails", async () => {
  const summary = await run({
    "unknown.yaml": VALID_CONTRACT.replace("system: customer_db", "system: mystery_api")
  });
  assert.equal(summary.failed, 1);
  assert.ok(summary.failures.some((f) => f.includes('"mystery_api" is not declared')));
});

test("a contract asserting nothing fails", async () => {
  const summary = await run({
    "empty-assertions.yaml": VALID_CONTRACT.replace("requiredFields: [id, name, plan]", "requiredFields: []")
  });
  assert.equal(summary.failed, 1);
  assert.ok(summary.failures.some((f) => f.includes("asserts nothing")));
});

test("no fixtures means a clean no-op", async () => {
  const summary = await run({});
  assert.equal(summary.files, 0);
  assert.equal(summary.failed, 0);
});

test("without --contracts the command refuses to pretend it ran", async () => {
  const root = await makeRoot({});
  try {
    await assert.rejects(() => testCommand(root, {}), /--contracts/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
