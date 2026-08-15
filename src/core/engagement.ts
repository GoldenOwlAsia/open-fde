import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { exists } from "./workspace.js";
import { formatIssue, validateEngagementText } from "./schema.js";

export interface EngagementSystem {
  id?: string;
  type?: string;
  access?: string;
}

export interface AgentTool {
  id?: string;
  description?: string;
  /** References a spec.systems[].id */
  system?: string;
  access?: string;
  sideEffects?: boolean;
  containsPii?: boolean;
}

export interface EngagementAgent {
  id?: string;
  description?: string;
  tools?: AgentTool[];
}

export interface EvalSuite {
  name?: string;
  type?: string;
  /** Path (relative to the engagement root) of the eval artifact file or directory. */
  location?: string;
  requiredBeforeDeploy?: boolean;
  /** Freshness bound: warn when the artifact is older than this many days. */
  maxAgeDays?: number;
}

export interface Engagement {
  apiVersion?: string;
  kind?: string;
  metadata?: { name?: string };
  spec?: {
    customer?: { name?: string };
    objective?: { summary?: string };
    successMetrics?: Array<{ name?: string; target?: string }>;
    environment?: { cloud?: string; regions?: string[] };
    systems?: EngagementSystem[];
    constraints?: {
      dataResidency?: { allowedRegions?: string[] };
      pii?: { allowExternalModel?: boolean };
      humanApproval?: { requiredFor?: string[] };
    };
    agents?: EngagementAgent[];
    reliability?: { timeout?: string; retry?: string; fallback?: string };
    evaluation?: { required?: boolean; suites?: EvalSuite[] };
    checks?: {
      overrides?: Array<{ id?: string; severity?: string; reason?: string }>;
    };
  };
}

export const engagementPath = (root: string) => path.join(root, "fde.yaml");

export interface LoadOptions {
  /** Validate against schemas/fde.schema.json (default true). Schema errors throw. */
  validate?: boolean;
}

export async function loadEngagement(root: string, options: LoadOptions = {}): Promise<Engagement | null> {
  const file = engagementPath(root);
  if (!(await exists(file))) return null;
  const text = await readFile(file, "utf8");

  if (options.validate !== false) {
    const { errors } = await validateEngagementText(text);
    if (errors.length) {
      const details = errors.map((e) => `  ${formatIssue("fde.yaml", e)}`).join("\n");
      throw new Error(`fde.yaml failed schema validation:\n${details}\nRun \`fde validate\` for details.`);
    }
  }

  try {
    const parsed = parse(text);
    if (parsed === null || typeof parsed !== "object") return null;
    return parsed as Engagement;
  } catch (error) {
    throw new Error(
      `Could not parse fde.yaml: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
