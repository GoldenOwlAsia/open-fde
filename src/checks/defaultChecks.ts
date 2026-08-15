import type { CheckResult, Inventory } from "../core/types.js";
import type { Engagement } from "../core/engagement.js";
import type { Check, CheckContext, RunOptions } from "./registry.js";
import { runChecks } from "./registry.js";
import { constraintChecks } from "./constraintChecks.js";

const OBSERVABILITY_SYSTEM_TYPES = new Set(["sentry", "opentelemetry", "otel", "datadog"]);

const engagementEvidence = (engagement: Engagement | null): string =>
  engagement ? "fde.yaml" : "fde.yaml is missing — run `fde init` to create one";

const externalModelPolicy: Check = {
  id: "external-model-policy-undefined",
  category: "security",
  description: "An AI provider is detected but the engagement does not declare an external model policy.",
  appliesTo: ({ inventory }) => inventory.components.some((c) => c.category === "ai"),
  run: ({ inventory, engagement }) => {
    if (engagement?.spec?.constraints?.pii?.allowExternalModel !== undefined) return [];
    const aiComponents = inventory.components.filter((c) => c.category === "ai");
    return [
      {
        id: "external-model-policy-undefined",
        title: "External model policy is undefined",
        severity: "warning",
        category: "security",
        explanation:
          "An external AI provider was detected in the repository, but the engagement does not declare whether customer data may be sent to it (spec.constraints.pii.allowExternalModel).",
        evidence: [
          ...aiComponents.map((c) => `${c.name} detected in: ${c.evidence.join(", ")}`),
          `${engagementEvidence(engagement)}: spec.constraints.pii.allowExternalModel is not set`
        ],
        recommendation: "Set spec.constraints.pii.allowExternalModel to true or false in fde.yaml."
      }
    ];
  }
};

const piiPolicy: Check = {
  id: "pii-policy-undefined",
  category: "data",
  description: "The engagement does not declare how PII may be handled.",
  appliesTo: () => true,
  run: ({ engagement }) => {
    if (engagement?.spec?.constraints?.pii) return [];
    return [
      {
        id: "pii-policy-undefined",
        title: "PII policy is not declared",
        severity: "critical",
        category: "data",
        explanation:
          "The engagement does not state how personally identifiable information may be handled (spec.constraints.pii).",
        evidence: [`${engagementEvidence(engagement)}: spec.constraints.pii is not set`],
        recommendation: "Declare the PII boundary and whether external model providers are allowed."
      }
    ];
  }
};

const humanApproval: Check = {
  id: "human-approval-undefined",
  category: "human_control",
  description: "No human approval boundary is declared for side-effecting actions.",
  appliesTo: () => true,
  run: ({ engagement }) => {
    const requiredFor = engagement?.spec?.constraints?.humanApproval?.requiredFor;
    if (requiredFor && requiredFor.length > 0) return [];
    return [
      {
        id: "human-approval-undefined",
        title: "Human approval boundary is not declared",
        severity: "warning",
        category: "human_control",
        explanation:
          requiredFor && requiredFor.length === 0
            ? "spec.constraints.humanApproval.requiredFor is declared but empty. If no side-effecting action needs approval, confirm that explicitly with the customer."
            : "Side-effecting workflows should declare which actions require human approval (spec.constraints.humanApproval.requiredFor).",
        evidence: [
          `${engagementEvidence(engagement)}: spec.constraints.humanApproval.requiredFor is ${requiredFor ? "empty" : "not set"}`
        ],
        recommendation: "List side-effecting actions (e.g. refund.execute) under spec.constraints.humanApproval.requiredFor."
      }
    ];
  }
};

const observability: Check = {
  id: "observability-not-detected",
  category: "observability",
  description: "Neither the repository nor the engagement shows an observability signal.",
  appliesTo: () => true,
  run: ({ inventory, engagement }) => {
    const detected = inventory.components.some((c) => c.category === "observability");
    const declared = (engagement?.spec?.systems ?? []).some(
      (s) => s.type && OBSERVABILITY_SYSTEM_TYPES.has(s.type.toLowerCase())
    );
    if (detected || declared) return [];
    return [
      {
        id: "observability-not-detected",
        title: "No observability signal detected",
        severity: "warning",
        category: "observability",
        explanation:
          "No Sentry or OpenTelemetry reference was found in the scanned repository, and no observability system is declared in the engagement.",
        evidence: [
          `Scanned ${inventory.root} without an observability match`,
          `${engagementEvidence(engagement)}: no spec.systems entry of an observability type`
        ],
        recommendation: "Add tracing/error monitoring, or declare the customer's observability system in fde.yaml."
      }
    ];
  }
};

const evaluation: Check = {
  id: "evaluation-not-declared",
  category: "evaluation",
  description: "The engagement does not declare an evaluation requirement.",
  appliesTo: () => true,
  run: ({ engagement }) => {
    if (engagement?.spec?.evaluation) return [];
    return [
      {
        id: "evaluation-not-declared",
        title: "Evaluation is not declared",
        severity: "warning",
        category: "evaluation",
        explanation: "No evaluation requirement is declared for the engagement (spec.evaluation).",
        evidence: [`${engagementEvidence(engagement)}: spec.evaluation is not set`],
        recommendation: "Define at least one task-success or regression evaluation before production."
      }
    ];
  }
};

const reliability: Check = {
  id: "reliability-policy-absent",
  category: "reliability",
  description: "Timeout, retry, or fallback expectations are not declared.",
  appliesTo: () => true,
  run: ({ engagement }) => {
    const declared = engagement?.spec?.reliability;
    const missing = (["timeout", "retry", "fallback"] as const).filter((k) => !declared?.[k]);
    if (!missing.length) return [];
    return [
      {
        id: "reliability-policy-absent",
        title: "Reliability controls are not declared",
        severity: "warning",
        category: "reliability",
        explanation: `The engagement does not declare: ${missing.join(", ")} (spec.reliability).`,
        evidence: missing.map((k) => `${engagementEvidence(engagement)}: spec.reliability.${k} is not set`),
        recommendation: "Declare timeout, retry, and fallback expectations for external dependencies and model calls."
      }
    ];
  }
};

export const defaultChecks: Check[] = [
  externalModelPolicy,
  piiPolicy,
  humanApproval,
  observability,
  evaluation,
  reliability
];

export const builtinChecks: Check[] = [...defaultChecks, ...constraintChecks];

export function runDefaultChecks(
  inventory: Inventory,
  engagement: Engagement | null,
  options: RunOptions = {}
): CheckResult {
  const context: CheckContext = { inventory, engagement };
  return runChecks(builtinChecks, context, options);
}
