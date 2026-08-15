import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEngagementText } from "../src/core/schema.js";

const repoRoot = path.join(fileURLToPath(import.meta.url), "..", "..");

const valid = `apiVersion: openfde.dev/v1alpha1
kind: Engagement
metadata:
  name: test
spec:
  customer:
    name: acme
  objective:
    summary: Do the thing
`;

test("a minimal valid engagement passes with no issues", async () => {
  const result = await validateEngagementText(valid);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test("the example engagement validates cleanly", async () => {
  const text = await readFile(path.join(repoRoot, "examples", "customer-support", "fde.yaml"), "utf8");
  const result = await validateEngagementText(text);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test("unsupported apiVersion is a clear error", async () => {
  const result = await validateEngagementText(valid.replace("v1alpha1", "v9"));
  const error = result.errors.find((e) => e.path === "apiVersion");
  assert.ok(error);
  assert.match(error.message, /unsupported apiVersion/);
  assert.match(error.message, /openfde\.dev\/v1alpha1/);
  assert.equal(error.line, 1);
});

test("missing required fields are reported", async () => {
  const result = await validateEngagementText(`apiVersion: openfde.dev/v1alpha1
kind: Engagement
metadata: {}
spec:
  objective:
    summary: x
`);
  const messages = result.errors.map((e) => `${e.path}: ${e.message}`);
  assert.ok(messages.some((m) => m.includes('metadata: missing required field "name"')));
  assert.ok(messages.some((m) => m.includes('spec: missing required field "customer"')));
});

test("invalid enum values report path and line", async () => {
  const text = `${valid}  systems:
    - id: db
      type: postgres
      access: write_everything
`;
  const result = await validateEngagementText(text);
  const error = result.errors.find((e) => e.path === "spec.systems[0].access");
  assert.ok(error);
  assert.match(error.message, /read_only/);
  assert.equal(error.line, 13);
});

test("a system entry missing its type is an error", async () => {
  const result = await validateEngagementText(`${valid}  systems:
    - id: db
`);
  const error = result.errors.find((e) => e.path === "spec.systems[0]");
  assert.ok(error);
  assert.match(error.message, /required field "type"/);
});

test("unknown spec fields warn but do not fail", async () => {
  const result = await validateEngagementText(`${valid}  observability: everywhere
`);
  assert.deepEqual(result.errors, []);
  const warning = result.warnings.find((w) => w.path === "spec.observability");
  assert.ok(warning);
  assert.match(warning.message, /unknown field/);
});

test("unknown top-level fields are errors (root is closed)", async () => {
  const result = await validateEngagementText(`${valid.replace("spec:", "specs:\n  x: 1\nspec:")}`);
  assert.ok(result.errors.some((e) => e.path === "specs" && /unknown field/.test(e.message)));
});

test("invalid YAML syntax is reported with a position", async () => {
  const result = await validateEngagementText("apiVersion: [unclosed\nkind: Engagement\n");
  assert.ok(result.errors.length >= 1);
  assert.match(result.errors[0].message, /invalid YAML/);
});

test("wrong constraint types are caught", async () => {
  const result = await validateEngagementText(`${valid}  constraints:
    pii:
      allowExternalModel: sometimes
`);
  const error = result.errors.find((e) => e.path === "spec.constraints.pii.allowExternalModel");
  assert.ok(error);
  assert.match(error.message, /must be a boolean/);
});
