import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureWorkspace, exists, readJson, writeJson } from "../core/workspace.js";
import { redactText } from "../core/redact.js";

// Evidence packs: files an FDE attaches to the engagement (logs, configs,
// screenshots-as-text, meeting notes). Text only for now; everything passes
// through redaction before it is persisted.

export interface EvidenceIndexEntry {
  file: string;
  source: string;
  addedAt: string;
  redactions: Array<{ kind: string; count: number }>;
}

export async function evidenceAddCommand(root: string, file: string): Promise<EvidenceIndexEntry> {
  const ws = await ensureWorkspace(root);
  const source = path.resolve(file);
  if (!(await exists(source))) throw new Error(`Evidence file not found: ${source}`);

  const raw = await readFile(source);
  if (raw.includes(0)) {
    throw new Error(
      "Binary evidence is not supported yet — redaction can only be guaranteed for text. Convert or extract the relevant text first."
    );
  }

  const { text, redactions } = redactText(raw.toString("utf8"));
  const targetName = path.basename(source);
  const target = path.join(ws, "evidence", targetName);
  if (await exists(target)) {
    throw new Error(`Evidence file ${targetName} already exists in .fde/evidence/ — rename the source or remove the old entry first.`);
  }
  await writeFile(target, text, "utf8");

  const indexPath = path.join(ws, "evidence", "index.json");
  const index = (await exists(indexPath)) ? await readJson<EvidenceIndexEntry[]>(indexPath) : [];
  const entry: EvidenceIndexEntry = {
    file: targetName,
    source,
    addedAt: new Date().toISOString(),
    redactions
  };
  index.push(entry);
  await writeJson(indexPath, index);

  const redactionNote = redactions.length
    ? ` (${redactions.map((r) => `${r.count}× ${r.kind}`).join(", ")} redacted)`
    : " (nothing to redact)";
  console.log(`Added evidence ${target}${redactionNote}`);
  return entry;
}
