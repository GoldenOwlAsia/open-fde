import type { CheckResult, Finding, Inventory } from "../core/types.js";
import type { Engagement } from "../core/engagement.js";

function scoreFromFindings(findings: Finding[], category: Finding["category"]): number {
  let score = 100;
  for (const finding of findings.filter((f) => f.category === category)) {
    score -= finding.severity === "critical" ? 35 : finding.severity === "warning" ? 15 : 5;
  }
  return Math.max(0, score);
}

const OBSERVABILITY_SYSTEM_TYPES = new Set(["sentry", "opentelemetry", "otel", "datadog"]);

export function runDefaultChecks(inventory: Inventory, engagement: Engagement | null): CheckResult {
  const findings: Finding[] = [];
  const spec = engagement?.spec;
  const constraints = spec?.constraints;
  const engagementEvidence = engagement
    ? "fde.yaml"
    : "fde.yaml is missing — run `fde init` to create one";

  const aiComponents = inventory.components.filter((c) => c.category === "ai");
  if (aiComponents.length && constraints?.pii?.allowExternalModel === undefined) {
    findings.push({
      id: "external-model-policy-undefined",
      title: "External model policy is undefined",
      severity: "warning",
      category: "security",
      explanation:
        "An external AI provider was detected in the repository, but the engagement does not declare whether customer data may be sent to it (spec.constraints.pii.allowExternalModel).",
      evidence: [
        ...aiComponents.map((c) => `${c.name} detected in: ${c.evidence.join(", ")}`),
        `${engagementEvidence}: spec.constraints.pii.allowExternalModel is not set`
      ],
      recommendation: "Set spec.constraints.pii.allowExternalModel to true or false in fde.yaml."
    });
  }

  if (!constraints?.pii) {
    findings.push({
      id: "pii-policy-undefined",
      title: "PII policy is not declared",
      severity: "critical",
      category: "data",
      explanation:
        "The engagement does not state how personally identifiable information may be handled (spec.constraints.pii).",
      evidence: [`${engagementEvidence}: spec.constraints.pii is not set`],
      recommendation: "Declare the PII boundary and whether external model providers are allowed."
    });
  }

  const requiredFor = constraints?.humanApproval?.requiredFor;
  if (!requiredFor || requiredFor.length === 0) {
    findings.push({
      id: "human-approval-undefined",
      title: "Human approval boundary is not declared",
      severity: "warning",
      category: "human_control",
      explanation:
        requiredFor && requiredFor.length === 0
          ? "spec.constraints.humanApproval.requiredFor is declared but empty. If no side-effecting action needs approval, confirm that explicitly with the customer."
          : "Side-effecting workflows should declare which actions require human approval (spec.constraints.humanApproval.requiredFor).",
      evidence: [`${engagementEvidence}: spec.constraints.humanApproval.requiredFor is ${requiredFor ? "empty" : "not set"}`],
      recommendation: "List side-effecting actions (e.g. refund.execute) under spec.constraints.humanApproval.requiredFor."
    });
  }

  const observabilityComponents = inventory.components.filter((c) => c.category === "observability");
  const declaredObservability = (spec?.systems ?? []).filter(
    (s) => s.type && OBSERVABILITY_SYSTEM_TYPES.has(s.type.toLowerCase())
  );
  if (observabilityComponents.length === 0 && declaredObservability.length === 0) {
    findings.push({
      id: "observability-not-detected",
      title: "No observability signal detected",
      severity: "warning",
      category: "observability",
      explanation:
        "No Sentry or OpenTelemetry reference was found in the scanned repository, and no observability system is declared in the engagement.",
      evidence: [
        `Scanned ${inventory.root} without an observability match`,
        `${engagementEvidence}: no spec.systems entry of an observability type`
      ],
      recommendation: "Add tracing/error monitoring, or declare the customer's observability system in fde.yaml."
    });
  }

  if (!spec?.evaluation) {
    findings.push({
      id: "evaluation-not-declared",
      title: "Evaluation is not declared",
      severity: "warning",
      category: "evaluation",
      explanation: "No evaluation requirement is declared for the engagement (spec.evaluation).",
      evidence: [`${engagementEvidence}: spec.evaluation is not set`],
      recommendation: "Define at least one task-success or regression evaluation before production."
    });
  }

  const reliability = spec?.reliability;
  const missingReliability = (["timeout", "retry", "fallback"] as const).filter((k) => !reliability?.[k]);
  if (missingReliability.length) {
    findings.push({
      id: "reliability-policy-absent",
      title: "Reliability controls are not declared",
      severity: "warning",
      category: "reliability",
      explanation: `The engagement does not declare: ${missingReliability.join(", ")} (spec.reliability).`,
      evidence: missingReliability.map((k) => `${engagementEvidence}: spec.reliability.${k} is not set`),
      recommendation: "Declare timeout, retry, and fallback expectations for external dependencies and model calls."
    });
  }

  const categories = ["security", "data", "reliability", "evaluation", "observability", "human_control"] as const;
  const scores = Object.fromEntries(categories.map((c) => [c, scoreFromFindings(findings, c)])) as CheckResult["scores"];
  const overallScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / categories.length);

  return { generatedAt: new Date().toISOString(), overallScore, scores, findings };
}
