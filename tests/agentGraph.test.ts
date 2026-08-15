import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scanCommand } from "../src/commands/scan.js";
import { mapCommand } from "../src/commands/map.js";
import { readJson } from "../src/core/workspace.js";
import type { IntegrationGraph } from "../src/core/types.js";

const FDE_YAML = `apiVersion: openfde.dev/v1alpha1
kind: Engagement
metadata:
  name: agent-graph
spec:
  customer:
    name: acme
  objective:
    summary: test
  systems:
    - id: customer_db
      type: postgres
      access: read_only
  agents:
    - id: support
      tools:
        - id: lookup
          system: customer_db
          access: read_only
          containsPii: true
        - id: escalate
          system: ticketing
          sideEffects: true
`;

test("map renders agent → tool → system edges with access and PII", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openfde-agentmap-"));
  const originalLog = console.log;
  console.log = () => {};
  try {
    await writeFile(path.join(root, "fde.yaml"), FDE_YAML, "utf8");
    await scanCommand(root);
    await mapCommand(root);
    const graph = await readJson<IntegrationGraph>(
      path.join(root, ".fde", "environment", "integration-graph.json")
    );

    assert.ok(graph.nodes.some((n) => n.id === "support" && n.category === "agent"));
    assert.ok(graph.nodes.some((n) => n.id === "support.lookup" && n.category === "tool"));

    const holds = graph.edges.find((e) => e.from === "support" && e.to === "support.lookup");
    assert.ok(holds);
    assert.equal(holds.relationship, "holds");

    // Tool → declared system edge carries access + containsPii; the declared
    // postgres system was not detected in the repo, so its node id is customer_db.
    const uses = graph.edges.find((e) => e.from === "support.lookup" && e.to === "customer_db");
    assert.ok(uses);
    assert.equal(uses.access, "read_only");
    assert.equal(uses.containsPii, true);

    // A tool pointing at an undeclared system gets no edge (fde check flags it).
    assert.equal(graph.edges.find((e) => e.from === "support.escalate" && e.relationship.startsWith("uses")), undefined);

    const mermaid = await readFile(path.join(root, ".fde", "environment", "integration-graph.mmd"), "utf8");
    assert.match(mermaid, /support_lookup/);
  } finally {
    console.log = originalLog;
    await rm(root, { recursive: true, force: true });
  }
});
