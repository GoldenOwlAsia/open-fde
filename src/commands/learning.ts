import { writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify } from "yaml";
import { ensureWorkspace, exists } from "../core/workspace.js";

export interface LearningOptions {
  failureMode?: string;
  mitigation?: string;
  checks?: string;
  incidents?: string;
}

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "learning";

const parseList = (value?: string) =>
  value
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

export async function learningAddCommand(root: string, title: string, options: LearningOptions = {}): Promise<string> {
  if (!title.trim()) throw new Error("Learning title must not be empty.");
  const ws = await ensureWorkspace(root);
  const id = slug(title);
  const file = path.join(ws, "learnings", `${id}.yaml`);
  if (await exists(file)) throw new Error(`Learning ${id} already exists (${file}).`);

  const record = {
    id,
    title,
    failureMode: options.failureMode ?? "Describe how this fails in production.",
    mitigation: options.mitigation ?? "Describe how to prevent or recover.",
    relatedChecks: parseList(options.checks),
    relatedIncidents: parseList(options.incidents),
    addedAt: new Date().toISOString()
  };
  await writeFile(file, stringify(record), "utf8");
  console.log(`Created ${file}`);
  if (record.relatedChecks.length) {
    console.log(`Findings from ${record.relatedChecks.join(", ")} will now carry this learning as evidence.`);
  }
  return file;
}
