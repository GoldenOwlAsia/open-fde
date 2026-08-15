import { readdir } from "node:fs/promises";
import path from "node:path";
import { loadEngagement } from "../core/engagement.js";
import { exists, readJson } from "../core/workspace.js";
import type { NormalizedIncident, NormalizedTrace } from "./importCmd.js";
import type { EvidenceIndexEntry } from "./evidence.js";

// `fde status`: declared vs observed, from imported evidence only. OpenFDE
// never contacts production — everything here comes from files the user
// imported into the workspace.

export interface StatusSummary {
  declaredSystems: Array<{ id: string; observed: boolean }>;
  observedUndeclared: string[];
  traces: number;
  errorSpans: number;
  incidents: { total: number; open: number };
  evidence: number;
  lastImportAt?: string;
}

async function listJson<T>(dir: string): Promise<T[]> {
  if (!(await exists(dir))) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json") && f !== "index.json").sort();
  const items: T[] = [];
  for (const file of files) {
    try {
      items.push(await readJson<T>(path.join(dir, file)));
    } catch {
      // unreadable artifact — skip rather than fail the whole status
    }
  }
  return items;
}

export async function statusCommand(root: string): Promise<StatusSummary> {
  const engagement = await loadEngagement(root);
  const ws = path.join(root, ".fde");

  const traces = await listJson<NormalizedTrace>(path.join(ws, "traces"));
  const incidents = await listJson<NormalizedIncident>(path.join(ws, "incidents"));
  const evidenceIndexPath = path.join(ws, "evidence", "index.json");
  const evidence = (await exists(evidenceIndexPath)) ? await readJson<EvidenceIndexEntry[]>(evidenceIndexPath) : [];

  // A declared system counts as observed when a span's service name matches
  // its id/type, or a span name is prefixed with "<id>." (e.g. customers.lookup
  // observed for system id "customers"). Named heuristic, shown as such.
  const spans = traces.flatMap((t) => t.spans);
  const observedNames = new Set<string>();
  for (const span of spans) {
    if (span.serviceName) observedNames.add(span.serviceName.toLowerCase());
    const dot = span.name.indexOf(".");
    if (dot > 0) observedNames.add(span.name.slice(0, dot).toLowerCase());
  }

  const declaredSystems = (engagement?.spec?.systems ?? [])
    .filter((s) => s.id)
    .map((s) => ({
      id: s.id as string,
      observed:
        observedNames.has((s.id as string).toLowerCase()) ||
        (s.type ? observedNames.has(s.type.toLowerCase()) : false)
    }));
  const declaredNames = new Set(
    (engagement?.spec?.systems ?? []).flatMap((s) => [s.id?.toLowerCase(), s.type?.toLowerCase()]).filter(Boolean)
  );
  const observedUndeclared = [...observedNames].filter((n) => !declaredNames.has(n)).sort();

  const importTimes = [...traces.map((t) => t.importedAt), ...incidents.map((i) => i.importedAt)].sort();
  const summary: StatusSummary = {
    declaredSystems,
    observedUndeclared,
    traces: traces.length,
    errorSpans: spans.filter((s) => s.status === "error").length,
    incidents: { total: incidents.length, open: incidents.filter((i) => !i.resolvedAt).length },
    evidence: evidence.length,
    lastImportAt: importTimes.at(-1)
  };

  console.log("OpenFDE Status — declared vs observed (from imported evidence)\n");
  if (!summary.declaredSystems.length) {
    console.log("No systems declared in fde.yaml.");
  } else {
    for (const system of summary.declaredSystems) {
      console.log(`  ${system.observed ? "✓ observed " : "· no signal"}  ${system.id}`);
    }
  }
  if (summary.observedUndeclared.length) {
    console.log(`\nObserved in traces but not declared: ${summary.observedUndeclared.join(", ")}`);
  }
  console.log(
    `\nTraces: ${summary.traces} (${summary.errorSpans} error span(s)) · Incidents: ${summary.incidents.total} (${summary.incidents.open} open) · Evidence files: ${summary.evidence}`
  );
  console.log(
    summary.lastImportAt ? `Last import: ${summary.lastImportAt}` : "No evidence imported yet — see `fde import` and `fde evidence add`."
  );
  return summary;
}
