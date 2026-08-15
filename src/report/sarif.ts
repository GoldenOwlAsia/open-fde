import type { CheckResult, Finding } from "../core/types.js";
import type { Check } from "../checks/registry.js";

const LEVELS: Record<Finding["severity"], string> = {
  critical: "error",
  warning: "warning",
  info: "note"
};

// Evidence strings that carry a repo location look like "src/db.ts:40 — ...".
const EVIDENCE_LOCATION_RE = /^([^\s:]+):(\d+)\b/;

interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string };
    region?: { startLine: number };
  };
}

function locationsFor(finding: Finding): SarifLocation[] {
  const locations: SarifLocation[] = [];
  for (const evidence of finding.evidence ?? []) {
    const match = evidence.match(EVIDENCE_LOCATION_RE);
    if (!match) continue;
    locations.push({
      physicalLocation: {
        artifactLocation: { uri: match[1].replaceAll("\\", "/") },
        region: { startLine: Number(match[2]) }
      }
    });
  }
  // SARIF results need at least one location for useful display; fall back to
  // the engagement file the finding is asking the user to edit.
  if (!locations.length) {
    locations.push({ physicalLocation: { artifactLocation: { uri: "fde.yaml" } } });
  }
  return locations.slice(0, 10);
}

export function toSarif(result: CheckResult, checks: Check[], version: string): object {
  return {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "OpenFDE",
            informationUri: "https://github.com/GoldenOwlAsia/open-fde",
            version,
            rules: checks.map((check) => ({
              id: check.id,
              shortDescription: { text: check.description },
              properties: { category: check.category }
            }))
          }
        },
        results: result.findings.map((finding) => ({
          ruleId: finding.id,
          level: LEVELS[finding.severity],
          message: {
            text: [finding.title, finding.explanation, finding.recommendation]
              .filter(Boolean)
              .join("\n\n")
          },
          locations: locationsFor(finding)
        }))
      }
    ]
  };
}
