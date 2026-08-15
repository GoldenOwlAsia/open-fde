import { createInterface } from "node:readline";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { engagementPath, loadEngagement } from "../core/engagement.js";
import { exists, readJson } from "../core/workspace.js";
import type { Inventory } from "../core/types.js";
import { buildGraph } from "../core/graph.js";
import { scanRepository } from "../scanners/repo.js";
import { runDefaultChecks } from "../checks/defaultChecks.js";
import { VERSION } from "../version.js";

// Minimal MCP server: JSON-RPC 2.0 over stdio (newline-delimited), tools only.
// Strictly read-only — no tool writes to the workspace or the repository.
// Opt-in and local: it runs only when the user starts `fde mcp`.

const PROTOCOL_VERSION = "2024-11-05";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}

const TOOLS = [
  {
    name: "get_engagement",
    description: "The declared engagement (fde.yaml): customer, objective, systems, constraints, agents."
  },
  {
    name: "get_environment",
    description: "Detected components of the repository with file evidence (from the OpenFDE scan)."
  },
  {
    name: "get_integrations",
    description: "The integration graph: app/agent/tool/system nodes and access-labeled edges."
  },
  {
    name: "get_constraints",
    description: "Just the engagement constraints: data residency, PII policy, human-approval boundaries."
  },
  {
    name: "run_preflight",
    description: "Run the OpenFDE deployment-readiness checks and return scores and findings with evidence."
  }
].map((tool) => ({
  ...tool,
  inputSchema: { type: "object", properties: {}, required: [] }
}));

async function loadInventory(root: string): Promise<Inventory> {
  const invPath = path.join(root, ".fde", "environment", "inventory.json");
  // Prefer the scan artifact; fall back to an in-memory scan (never written).
  return (await exists(invPath)) ? readJson<Inventory>(invPath) : scanRepository(root);
}

async function callTool(root: string, name: string): Promise<unknown> {
  switch (name) {
    case "get_engagement": {
      const file = engagementPath(root);
      if (!(await exists(file))) return { error: "No fde.yaml found. Run `fde init` first." };
      return { engagement: await loadEngagement(root), source: "fde.yaml", raw: await readFile(file, "utf8") };
    }
    case "get_environment":
      return loadInventory(root);
    case "get_integrations": {
      const engagement = await loadEngagement(root);
      return buildGraph(await loadInventory(root), engagement, root);
    }
    case "get_constraints": {
      const engagement = await loadEngagement(root);
      if (!engagement) return { error: "No fde.yaml found. Run `fde init` first." };
      return {
        constraints: engagement.spec?.constraints ?? {},
        reliability: engagement.spec?.reliability ?? {},
        agents: engagement.spec?.agents ?? []
      };
    }
    case "run_preflight": {
      const inventory = await loadInventory(root);
      const engagement = await loadEngagement(root);
      return runDefaultChecks(inventory, engagement);
    }
    default:
      throw new Error(`Unknown tool "${name}"`);
  }
}

export async function mcpCommand(root: string): Promise<void> {
  const write = (message: object) => process.stdout.write(`${JSON.stringify(message)}\n`);
  const reply = (id: JsonRpcRequest["id"], result: object) => write({ jsonrpc: "2.0", id, result });
  const replyError = (id: JsonRpcRequest["id"], code: number, message: string) =>
    write({ jsonrpc: "2.0", id, error: { code, message } });

  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line) as JsonRpcRequest;
    } catch {
      replyError(null, -32700, "Parse error");
      continue;
    }
    const { id, method, params } = request;
    // Notifications (no id) never get a response.
    if (method?.startsWith("notifications/")) continue;

    try {
      switch (method) {
        case "initialize":
          reply(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: "openfde", version: VERSION }
          });
          break;
        case "ping":
          reply(id, {});
          break;
        case "tools/list":
          reply(id, { tools: TOOLS });
          break;
        case "tools/call": {
          const name = params?.name ?? "";
          const result = await callTool(root, name);
          reply(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
          break;
        }
        default:
          replyError(id ?? null, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      replyError(id ?? null, -32603, error instanceof Error ? error.message : String(error));
    }
  }
}
