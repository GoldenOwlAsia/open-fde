import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureWorkspace, exists, readJson, readJsonDir, writeJson } from "../core/workspace.js";
import type { CheckResult, Finding, IntegrationGraph, Inventory } from "../core/types.js";
import type { Engagement } from "../core/engagement.js";
import { loadEngagement } from "../core/engagement.js";
import { buildGraph } from "../core/graph.js";
import { scanRepository } from "../scanners/repo.js";
import { runDefaultChecks } from "../checks/defaultChecks.js";
import { annotateFindingsWithLearnings, loadLearnings, type Learning } from "../core/learnings.js";
import { OPEN_QUESTIONS } from "../report/renderText.js";
import type { NormalizedIncident } from "./importCmd.js";
import { VERSION } from "../version.js";

// `fde handoff`: everything a second engineer needs to pick the engagement up
// from `.fde/` alone — ownership, unresolved risks, open questions, decisions,
// known failure modes, and a runbook index. Machine-readable manifest + human
// Markdown pair.

export interface HandoffManifest {
  generatedAt: string;
  generator: string;
  engagement: { name?: string; customer?: string; objective?: string };
  ownership: { owner?: string; contacts: Array<{ name?: string; role?: string; contact?: string }> };
  readiness: { overallScore: number; scores: CheckResult["scores"] };
  unresolvedRisks: Finding[];
  openQuestions: string[];
  decisions: string[];
  learnings: Array<{ id: string; title: string; file: string }>;
  runbooks: string[];
  incidents: { total: number; open: number };
  evidenceFiles: number;
}

const RUNBOOK_ORDER = ["deploy.md", "rollback.md", "incident-triage.md"];

function deployRunbook(engagement: Engagement | null, checkResult: CheckResult): string {
  const criticals = checkResult.findings.filter((f) => f.severity === "critical");
  const suites = engagement?.spec?.evaluation?.suites ?? [];
  return `# Runbook: Deploy

> Generated skeleton — replace the TODOs with the engagement's real procedure.

## Preflight gate

1. \`fde scan . && fde check . --fail-on critical\` must exit 0.
${criticals.length ? `2. Currently blocking: ${criticals.map((f) => `**${f.title}**`).join("; ")}.` : "2. No critical findings at generation time."}

## Required evaluations

${suites.length ? suites.map((s) => `- ${s.name} (${s.type}) at \`${s.location}\`${s.requiredBeforeDeploy ? " — required before deploy" : ""}`).join("\n") : "- TODO: declare eval suites in fde.yaml (spec.evaluation.suites)."}

## Steps

1. TODO: build + artifact versioning
2. TODO: deploy procedure (environment, order, verification)
3. Verify observability signal after rollout (see incident-triage runbook)
`;
}

function rollbackRunbook(engagement: Engagement | null): string {
  const writeSystems = (engagement?.spec?.systems ?? []).filter((s) => s.access === "read_write");
  const fallback = engagement?.spec?.reliability?.fallback;
  return `# Runbook: Rollback

> Generated skeleton — replace the TODOs with the engagement's real procedure.

## State that may need rolling back

${writeSystems.length ? writeSystems.map((s) => `- **${s.id}** (${s.type}, read_write) — TODO: how to revert writes made by this deployment`).join("\n") : "- No read_write systems declared; rollback should be code-only."}

## Declared fallback

${fallback ? `- \`${fallback}\` (spec.reliability.fallback) — confirm it engages during rollback.` : "- TODO: declare a fallback in fde.yaml (spec.reliability.fallback)."}

## Steps

1. TODO: how to identify the last good version
2. TODO: rollback procedure
3. Re-run \`fde check\` and the required eval suites before declaring recovery
`;
}

function triageRunbook(engagement: Engagement | null, learnings: Learning[]): string {
  const observability = (engagement?.spec?.systems ?? []).filter((s) =>
    ["sentry", "opentelemetry", "otel", "datadog"].includes(s.type?.toLowerCase() ?? "")
  );
  const approvals = engagement?.spec?.constraints?.humanApproval?.requiredFor ?? [];
  return `# Runbook: Incident Triage

> Generated skeleton — replace the TODOs with the engagement's real procedure.

## Where to look first

${observability.length ? observability.map((s) => `- **${s.id}** (${s.type})`).join("\n") : "- TODO: no observability system declared — fix that before production."}

## Known failure modes

${learnings.length ? learnings.map((l) => `- **${l.title}** — ${l.failureMode ?? "see file"} (mitigation: ${l.mitigation ?? "see file"}; \`${l.file}\`)`).join("\n") : "- None recorded yet. Capture them with `fde learning add` as they happen."}

## Record the incident

1. Export a minimal record and import it: \`fde import incident incident.yaml\`
2. Attach evidence with redaction: \`fde evidence add <file>\`
3. \`fde status\` shows declared vs observed drift after import

## Escalation boundaries

${approvals.length ? approvals.map((a) => `- \`${a}\` requires human approval — never bypass during an incident.`).join("\n") : "- TODO: declare human-approval boundaries in fde.yaml."}
`;
}

export async function handoffCommand(root: string): Promise<HandoffManifest> {
  const ws = await ensureWorkspace(root);
  const engagement = await loadEngagement(root);

  const invPath = path.join(ws, "environment", "inventory.json");
  const inventory = (await exists(invPath)) ? await readJson<Inventory>(invPath) : await scanRepository(root);
  const graph: IntegrationGraph = buildGraph(inventory, engagement, root);
  const learnings = await loadLearnings(root);
  const checkResult = annotateFindingsWithLearnings(await runDefaultChecks(inventory, engagement), learnings);

  // Generate skeleton runbooks for any that do not exist yet.
  const runbooksDir = path.join(ws, "runbooks");
  const generators: Record<string, () => string> = {
    "deploy.md": () => deployRunbook(engagement, checkResult),
    "rollback.md": () => rollbackRunbook(engagement),
    "incident-triage.md": () => triageRunbook(engagement, learnings)
  };
  await mkdir(runbooksDir, { recursive: true });
  for (const name of RUNBOOK_ORDER) {
    const file = path.join(runbooksDir, name);
    if (!(await exists(file))) await writeFile(file, generators[name](), "utf8");
  }
  const runbooks = (await readdir(runbooksDir)).filter((f) => f.endsWith(".md")).sort();

  const decisionsDir = path.join(ws, "architecture", "decisions");
  const decisions = (await exists(decisionsDir))
    ? (await readdir(decisionsDir)).filter((f) => f.endsWith(".md")).sort()
    : [];
  const incidents = await readJsonDir<NormalizedIncident>(path.join(ws, "incidents"));
  const evidenceIndexPath = path.join(ws, "evidence", "index.json");
  const evidenceFiles = (await exists(evidenceIndexPath)) ? (await readJson<unknown[]>(evidenceIndexPath)).length : 0;

  const unresolvedRisks = checkResult.findings.filter((f) => f.severity !== "info");
  const openQuestions = checkResult.findings
    .map((f) => OPEN_QUESTIONS[f.id])
    .filter((q): q is string => Boolean(q));

  const manifest: HandoffManifest = {
    generatedAt: new Date().toISOString(),
    generator: `openfde ${VERSION}`,
    engagement: {
      name: engagement?.metadata?.name,
      customer: engagement?.spec?.customer?.name,
      objective: engagement?.spec?.objective?.summary
    },
    ownership: {
      owner: engagement?.spec?.ownership?.owner,
      contacts: engagement?.spec?.ownership?.contacts ?? []
    },
    readiness: { overallScore: checkResult.overallScore, scores: checkResult.scores },
    unresolvedRisks,
    openQuestions,
    decisions,
    learnings: learnings.map((l) => ({ id: l.id, title: l.title, file: l.file })),
    runbooks,
    incidents: { total: incidents.length, open: incidents.filter((i) => !i.resolvedAt).length },
    evidenceFiles
  };

  await writeJson(path.join(ws, "handoff", "handoff.json"), manifest);

  const markdown = `# Engagement Handoff: ${manifest.engagement.name ?? "unnamed"}

Generated by ${manifest.generator} at ${manifest.generatedAt}. A second
engineer should be able to pick this engagement up from \`.fde/\` alone.

## Ownership

- **Owner:** ${manifest.ownership.owner ?? "⚠ undeclared — set spec.ownership.owner in fde.yaml"}
${manifest.ownership.contacts.map((c) => `- ${c.name ?? "?"}${c.role ? ` (${c.role})` : ""}${c.contact ? ` — ${c.contact}` : ""}`).join("\n") || "- No contacts declared."}

## Engagement

- **Customer:** ${manifest.engagement.customer ?? "undeclared"}
- **Objective:** ${manifest.engagement.objective ?? "undeclared"}
- **Readiness:** ${manifest.readiness.overallScore}/100

## Unresolved risks (${unresolvedRisks.length})

${unresolvedRisks.map((f) => `- **[${f.severity}] ${f.title}**\n${(f.evidence ?? []).slice(0, 3).map((e) => `  - ${e}`).join("\n")}`).join("\n") || "None."}

## Open questions for the customer

${openQuestions.map((q) => `- ${q}`).join("\n") || "None."}

## Architecture decisions

${decisions.map((d) => `- \`.fde/architecture/decisions/${d}\``).join("\n") || "None recorded — use `fde decision add`."}

## Known failure modes

${manifest.learnings.map((l) => `- ${l.title} (\`${l.file}\`)`).join("\n") || "None recorded — use `fde learning add`."}

## Runbooks

${runbooks.map((r) => `- \`.fde/runbooks/${r}\``).join("\n")}

## Operational evidence

- Incidents: ${manifest.incidents.total} (${manifest.incidents.open} open)
- Evidence files: ${manifest.evidenceFiles}
- Integration map: \`.fde/environment/integration-graph.mmd\` (${graph.nodes.length} nodes)
`;
  await writeFile(path.join(ws, "handoff", "handoff.md"), markdown, "utf8");

  console.log("Generated handoff package:");
  console.log(`  ${path.join(ws, "handoff", "handoff.md")}`);
  console.log(`  ${path.join(ws, "handoff", "handoff.json")}`);
  console.log(`  ${runbooks.length} runbook(s) in ${runbooksDir}`);
  return manifest;
}
