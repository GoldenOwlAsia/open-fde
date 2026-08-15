import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportCommand } from "../src/commands/export.js";
import { readJson } from "../src/core/workspace.js";
import type { ContextBundle } from "../src/commands/export.js";

const repoRoot = path.join(fileURLToPath(import.meta.url), "..", "..");

const FDE_YAML = `apiVersion: openfde.dev/v1alpha1
kind: Engagement
metadata:
  name: export-fixture
spec:
  customer:
    name: acme
  objective:
    summary: test
  systems:
    - id: primary_db
      type: postgres
      access: read_only
  constraints:
    pii:
      allowExternalModel: false
`;

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openfde-export-"));
  await writeFile(path.join(root, "fde.yaml"), FDE_YAML, "utf8");
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ name: "fixture", dependencies: { pg: "^8.0.0" } }),
    "utf8"
  );
  return root;
}

test("fde export context produces a Markdown and JSON bundle without a prior scan", async () => {
  const root = await makeRoot();
  const originalLog = console.log;
  console.log = () => {};
  try {
    await exportCommand(root, "context");
  } finally {
    console.log = originalLog;
  }
  try {
    const markdown = await readFile(path.join(root, ".fde", "context.md"), "utf8");
    assert.match(markdown, /# Engagement Context Bundle/);
    assert.match(markdown, /```yaml/);
    assert.match(markdown, /```mermaid/);
    assert.match(markdown, /Standing rules for agents/);

    const bundle = await readJson<ContextBundle>(path.join(root, ".fde", "context.json"));
    assert.ok(bundle.inventory.components.some((c) => c.id === "postgres"));
    assert.ok(bundle.graph.nodes.some((n) => n.id === "app"));
    assert.ok(bundle.checkResult.findings.length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("unknown export targets are rejected", async () => {
  const root = await makeRoot();
  try {
    await assert.rejects(() => exportCommand(root, "everything"), /Unknown export target/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("MCP server answers initialize, tools/list, and read-only tool calls over stdio", async () => {
  const root = await makeRoot();
  const child = spawn(process.execPath, ["--import", "tsx", "src/cli.ts", "mcp", root], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"]
  });

  const responses: Record<string | number, { result?: never; error?: never } & Record<string, unknown>> = {};
  let buffer = "";
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      if (message.id !== undefined && message.id !== null) responses[message.id] = message;
    }
  });

  const send = (message: object) => child.stdin.write(`${JSON.stringify(message)}\n`);
  const waitFor = (id: number, timeoutMs = 15000) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        if (responses[id]) return resolve(responses[id]);
        if (Date.now() - started > timeoutMs) return reject(new Error(`Timed out waiting for response ${id}`));
        setTimeout(poll, 25);
      };
      poll();
    });

  try {
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    const init = (await waitFor(1)).result as { protocolVersion: string; serverInfo: { name: string } };
    assert.equal(init.serverInfo.name, "openfde");
    send({ jsonrpc: "2.0", method: "notifications/initialized" });

    send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const tools = ((await waitFor(2)).result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
    assert.deepEqual(
      tools.sort(),
      ["get_constraints", "get_engagement", "get_environment", "get_integrations", "run_preflight"]
    );

    send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_engagement", arguments: {} } });
    const engagementText = ((await waitFor(3)).result as { content: Array<{ text: string }> }).content[0].text;
    assert.ok(engagementText.includes("export-fixture"));

    send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "run_preflight", arguments: {} } });
    const preflight = JSON.parse(
      ((await waitFor(4)).result as { content: Array<{ text: string }> }).content[0].text
    ) as { overallScore: number; findings: Array<{ id: string }> };
    assert.ok(preflight.overallScore <= 100);
    assert.ok(preflight.findings.length > 0);

    send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "delete_everything", arguments: {} } });
    const bad = await waitFor(5);
    assert.ok(bad.error, "unknown tools must return a JSON-RPC error");
  } finally {
    child.kill();
    await rm(root, { recursive: true, force: true });
  }
});
