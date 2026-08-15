import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { exists } from "./workspace.js";
import type { CheckResult } from "./types.js";

// Known-failure-modes registry: one YAML file per learning under
// .fde/learnings/. Learnings link back to check ids and incident ids so
// findings can surface "we have seen this fail before".

export interface Learning {
  id: string;
  title: string;
  failureMode?: string;
  mitigation?: string;
  relatedChecks: string[];
  relatedIncidents: string[];
  addedAt?: string;
  file: string;
}

export async function loadLearnings(root: string): Promise<Learning[]> {
  const dir = path.join(root, ".fde", "learnings");
  if (!(await exists(dir))) return [];
  const learnings: Learning[] = [];
  for (const file of (await readdir(dir)).filter((f) => /\.ya?ml$/.test(f)).sort()) {
    try {
      const raw = parse(await readFile(path.join(dir, file), "utf8")) as Record<string, unknown> | null;
      if (!raw || typeof raw !== "object" || typeof raw.title !== "string") continue;
      learnings.push({
        id: typeof raw.id === "string" ? raw.id : file.replace(/\.ya?ml$/, ""),
        title: raw.title,
        failureMode: typeof raw.failureMode === "string" ? raw.failureMode : undefined,
        mitigation: typeof raw.mitigation === "string" ? raw.mitigation : undefined,
        relatedChecks: Array.isArray(raw.relatedChecks) ? raw.relatedChecks.filter((c): c is string => typeof c === "string") : [],
        relatedIncidents: Array.isArray(raw.relatedIncidents)
          ? raw.relatedIncidents.filter((c): c is string => typeof c === "string")
          : [],
        addedAt: typeof raw.addedAt === "string" ? raw.addedAt : undefined,
        file: path.join(".fde", "learnings", file)
      });
    } catch {
      // an unparsable learning should not break checks
    }
  }
  return learnings;
}

/** Annotates findings whose check id matches a learning's relatedChecks. */
export function annotateFindingsWithLearnings(result: CheckResult, learnings: Learning[]): CheckResult {
  if (!learnings.length) return result;
  const byCheck = new Map<string, Learning[]>();
  for (const learning of learnings) {
    for (const checkId of learning.relatedChecks) {
      byCheck.set(checkId, [...(byCheck.get(checkId) ?? []), learning]);
    }
  }
  return {
    ...result,
    findings: result.findings.map((finding) => {
      const related = byCheck.get(finding.id);
      if (!related?.length) return finding;
      return {
        ...finding,
        evidence: [
          ...(finding.evidence ?? []),
          ...related.map((l) => `known failure mode: ${l.title} (${l.file})`)
        ]
      };
    })
  };
}
