import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Finding } from "../core/types.js";
import type { Check } from "./registry.js";

const hasSuites: Check["appliesTo"] = ({ engagement }) =>
  (engagement?.spec?.evaluation?.suites?.length ?? 0) > 0;

/** Newest mtime (ms) of a file, or of the entries one level inside a directory. */
async function newestMtime(target: string): Promise<number | null> {
  try {
    const info = await stat(target);
    if (!info.isDirectory()) return info.mtimeMs;
    let newest = info.mtimeMs;
    for (const entry of await readdir(target)) {
      try {
        const child = await stat(path.join(target, entry));
        newest = Math.max(newest, child.mtimeMs);
      } catch {
        // unreadable entry — skip
      }
    }
    return newest;
  } catch {
    return null;
  }
}

const artifactsExist: Check = {
  id: "eval-artifact-missing",
  category: "evaluation",
  description: "A declared eval suite's artifact does not exist on disk.",
  appliesTo: hasSuites,
  run: async ({ engagement, root }) => {
    const findings: Finding[] = [];
    for (const suite of engagement?.spec?.evaluation?.suites ?? []) {
      if (!suite.location) continue;
      if ((await newestMtime(path.resolve(root, suite.location))) !== null) continue;
      findings.push({
        id: "eval-artifact-missing",
        title: `Eval suite "${suite.name}" has no artifact at its declared location`,
        severity: suite.requiredBeforeDeploy ? "critical" : "warning",
        category: "evaluation",
        explanation: `fde.yaml declares eval suite "${suite.name}" (${suite.type}) at ${suite.location}, but nothing exists there${suite.requiredBeforeDeploy ? " — and the suite is marked requiredBeforeDeploy" : ""}. OpenFDE verifies eval artifacts exist and are fresh; running them stays your job.`,
        evidence: [
          `fde.yaml: spec.evaluation.suites["${suite.name}"].location is ${suite.location}`,
          `${suite.location}: not found under ${root}`
        ],
        recommendation: `Create the eval artifact at ${suite.location} (see docs/EVALS.md for conventions), or correct the declared location.`
      });
    }
    return findings;
  }
};

const artifactsFresh: Check = {
  id: "eval-artifact-stale",
  category: "evaluation",
  description: "A declared eval suite's artifact is older than its freshness bound.",
  appliesTo: hasSuites,
  run: async ({ engagement, root }) => {
    const findings: Finding[] = [];
    for (const suite of engagement?.spec?.evaluation?.suites ?? []) {
      if (!suite.location || !suite.maxAgeDays) continue;
      const newest = await newestMtime(path.resolve(root, suite.location));
      if (newest === null) continue; // missing is eval-artifact-missing's finding
      const ageDays = (Date.now() - newest) / 86_400_000;
      if (ageDays <= suite.maxAgeDays) continue;
      findings.push({
        id: "eval-artifact-stale",
        title: `Eval suite "${suite.name}" is stale`,
        severity: "warning",
        category: "evaluation",
        explanation: `The newest file under ${suite.location} was last modified ${Math.floor(ageDays)} days ago, but the suite declares maxAgeDays: ${suite.maxAgeDays}. Evidence this old says little about the system being deployed now.`,
        evidence: [
          `${suite.location}: newest modification ${Math.floor(ageDays)} days ago`,
          `fde.yaml: spec.evaluation.suites["${suite.name}"].maxAgeDays is ${suite.maxAgeDays}`
        ],
        recommendation: "Re-run the eval suite and refresh its artifacts before deploying."
      });
    }
    return findings;
  }
};

export const evalChecks: Check[] = [artifactsExist, artifactsFresh];
