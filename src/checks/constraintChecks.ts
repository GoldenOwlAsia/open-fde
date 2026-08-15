import type { Finding } from "../core/types.js";
import type { Check } from "./registry.js";

const dataResidency: Check = {
  id: "data-residency-violation",
  category: "data",
  description: "Region literals in Terraform/Kubernetes config fall outside the declared allowed regions.",
  appliesTo: ({ engagement }) =>
    (engagement?.spec?.constraints?.dataResidency?.allowedRegions?.length ?? 0) > 0,
  run: ({ inventory, engagement }) => {
    const allowedRegions = engagement?.spec?.constraints?.dataResidency?.allowedRegions ?? [];
    const allowed = new Set(allowedRegions);
    const outside = (inventory.signals?.regions ?? []).filter((r) => !allowed.has(r.region));
    if (!outside.length) return [];
    const regions = [...new Set(outside.map((r) => r.region))].sort();
    return [
      {
        id: "data-residency-violation",
        title: "Infrastructure config references regions outside the declared residency boundary",
        severity: "critical",
        category: "data",
        explanation: `spec.constraints.dataResidency.allowedRegions declares ${allowedRegions.join(", ")}, but the repository configures: ${regions.join(", ")}.`,
        evidence: outside.map((r) => `${r.evidence}: region ${r.region}`),
        recommendation:
          "Move the workload into an allowed region, or update spec.constraints.dataResidency.allowedRegions after confirming the boundary with the customer."
      }
    ];
  }
};

const secretsHygiene: Check = {
  id: "secrets-committed",
  category: "security",
  description: "Committed .env files or credential-looking values in tracked files.",
  appliesTo: () => true,
  run: ({ inventory }) => {
    const suspects = inventory.signals?.secretSuspects ?? [];
    if (!suspects.length) return [];
    return [
      {
        id: "secrets-committed",
        title: "Possible secrets committed to the repository",
        severity: "critical",
        category: "security",
        explanation:
          "The repository contains files or lines that look like committed credentials. Locations are reported below; secret values are never printed.",
        evidence: suspects.map((s) => `${s.file}:${s.line} — ${s.kind}`),
        recommendation:
          "Remove the credentials, rotate them, and load secrets from the environment or a secret manager. Add .env to .gitignore."
      }
    ];
  }
};

const writeBoundary: Check = {
  id: "write-boundary-violation",
  category: "security",
  description: "A system declared read_only has write-implying code signals in the repository.",
  appliesTo: ({ engagement }) =>
    (engagement?.spec?.systems ?? []).some((s) => s.access === "read_only"),
  run: ({ inventory, engagement }) => {
    const findings: Finding[] = [];
    const writeSignals = inventory.signals?.writeSignals ?? [];
    const readOnly = (engagement?.spec?.systems ?? []).filter((s) => s.access === "read_only");
    for (const system of readOnly) {
      const type = system.type?.toLowerCase();
      if (!type) continue;
      const hits = writeSignals.filter((w) => w.systemType === type);
      if (!hits.length) continue;
      findings.push({
        id: "write-boundary-violation",
        title: `Declared read_only system "${system.id ?? type}" has write-implying code signals`,
        severity: "critical",
        category: "security",
        explanation: `fde.yaml declares system "${system.id ?? type}" (type ${type}) as read_only, but the repository contains code that appears to write to a ${type} system. Each signal is a named heuristic, not proof — verify before deploying.`,
        evidence: hits.map((w) => `${w.file}:${w.line} — ${w.pattern}`),
        recommendation:
          "Either remove the write path, or change the declared access to read_write after confirming the boundary with the customer."
      });
    }
    return findings;
  }
};

const successMetrics: Check = {
  id: "success-metrics-undeclared",
  category: "evaluation",
  description: "The engagement declares no measurable success metric.",
  appliesTo: () => true,
  run: ({ engagement }) => {
    const metrics = engagement?.spec?.successMetrics ?? [];
    const measurable = metrics.filter((m) => m?.name && m?.target);
    if (measurable.length > 0) return [];
    return [
      {
        id: "success-metrics-undeclared",
        title: "No measurable success metric is declared",
        severity: "warning",
        category: "evaluation",
        explanation:
          metrics.length > 0
            ? "spec.successMetrics has entries, but none declares both a name and a target, so success cannot be measured."
            : "The engagement declares no success metrics (spec.successMetrics), so there is no measurable definition of a useful deployment.",
        evidence: [
          engagement
            ? `fde.yaml: spec.successMetrics is ${metrics.length ? "missing name/target pairs" : "empty or not set"}`
            : "fde.yaml is missing — run `fde init` to create one"
        ],
        recommendation: 'Declare at least one metric with a target, e.g. { name: resolution_rate, target: ">= 0.70" }.'
      }
    ];
  }
};

export const constraintChecks: Check[] = [dataResidency, secretsHygiene, writeBoundary, successMetrics];
