import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureWorkspace, exists } from "../core/workspace.js";

// Lightweight ADR flow. Non-interactive on purpose: fields come from flags so
// the command works in scripts and agent sessions alike.

export interface DecisionOptions {
  status?: string;
  context?: string;
  decision?: string;
  consequences?: string;
}

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "decision";

export async function decisionAddCommand(root: string, title: string, options: DecisionOptions = {}): Promise<string> {
  if (!title.trim()) throw new Error("Decision title must not be empty.");
  const ws = await ensureWorkspace(root);
  const dir = path.join(ws, "architecture", "decisions");

  const existing = (await exists(dir)) ? (await readdir(dir)).filter((f) => /^\d{4}-.*\.md$/.test(f)) : [];
  const next = existing.reduce((max, f) => Math.max(max, Number(f.slice(0, 4))), 0) + 1;
  const number = String(next).padStart(4, "0");
  const file = path.join(dir, `${number}-${slug(title)}.md`);

  const today = new Date().toISOString().slice(0, 10);
  const content = `# ${number}. ${title}

Date: ${today}

## Status

${options.status ?? "accepted"}

## Context

${options.context ?? "_What is the issue that we're seeing that is motivating this decision?_"}

## Decision

${options.decision ?? "_What is the change that we're proposing and/or doing?_"}

## Consequences

${options.consequences ?? "_What becomes easier or more difficult to do because of this change?_"}
`;

  await writeFile(file, content, "utf8");
  console.log(`Created ${file}`);
  return file;
}
