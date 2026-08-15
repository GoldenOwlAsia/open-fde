import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { exists, readJson } from "../core/workspace.js";
import type { NormalizedTrace } from "./importCmd.js";

// Deterministic replay: re-run a recorded (already imported) trace against
// the contract fixtures. No production calls — this only compares what was
// recorded with what the contracts say the integration should look like.

interface ContractCase {
  name?: string;
  request?: { operation?: string };
  response?: { requiredFields?: string[] };
}

interface ContractFile {
  system?: string;
  cases?: ContractCase[];
}

export interface ReplayCaseResult {
  contract: string;
  case: string;
  operation: string;
  /** Spans whose name matches the operation. */
  observed: number;
  /** Required response fields missing from every matching span's attributes. */
  missingFields: string[];
  verdict: "verified" | "shape-mismatch" | "not-exercised";
}

export interface ReplaySummary {
  trace: string;
  spanCount: number;
  errorSpans: Array<{ name: string; serviceName?: string }>;
  cases: ReplayCaseResult[];
}

const fieldObserved = (attributes: Record<string, unknown>, field: string): boolean =>
  attributes[field] !== undefined || attributes[`response.${field}`] !== undefined;

export async function replayCommand(root: string, traceName: string): Promise<ReplaySummary> {
  const tracePath = path.join(root, ".fde", "traces", traceName.endsWith(".json") ? traceName : `${traceName}.json`);
  if (!(await exists(tracePath))) {
    throw new Error(`Trace not found: ${tracePath}. Import one first with \`fde import trace <file>\`.`);
  }
  const trace = await readJson<NormalizedTrace>(tracePath);

  const contractsDir = path.join(root, ".fde", "contracts");
  const contractFiles = (await exists(contractsDir))
    ? (await readdir(contractsDir)).filter((f) => /\.ya?ml$/.test(f)).sort()
    : [];
  if (!contractFiles.length) {
    throw new Error("No contract fixtures in .fde/contracts/ — replay compares a trace against contracts.");
  }

  const summary: ReplaySummary = {
    trace: path.basename(tracePath),
    spanCount: trace.spans.length,
    errorSpans: trace.spans.filter((s) => s.status === "error").map((s) => ({ name: s.name, serviceName: s.serviceName })),
    cases: []
  };

  for (const file of contractFiles) {
    const contract = parse(await readFile(path.join(contractsDir, file), "utf8")) as ContractFile;
    for (const contractCase of contract?.cases ?? []) {
      const operation = contractCase.request?.operation;
      if (!operation || !contractCase.name) continue;
      const matching = trace.spans.filter((s) => s.name === operation);
      const required = contractCase.response?.requiredFields ?? [];
      const missingFields = matching.length
        ? required.filter((field) => !matching.some((s) => fieldObserved(s.attributes, field)))
        : [];
      summary.cases.push({
        contract: file,
        case: contractCase.name,
        operation,
        observed: matching.length,
        missingFields,
        verdict: !matching.length ? "not-exercised" : missingFields.length ? "shape-mismatch" : "verified"
      });
    }
  }

  console.log(`Replaying ${summary.trace} (${summary.spanCount} spans) against ${contractFiles.length} contract file(s)\n`);
  for (const result of summary.cases) {
    const marker = result.verdict === "verified" ? "✓" : result.verdict === "shape-mismatch" ? "✗" : "·";
    const detail =
      result.verdict === "verified"
        ? `${result.observed} span(s)`
        : result.verdict === "shape-mismatch"
          ? `missing: ${result.missingFields.join(", ")}`
          : "no matching span in this trace";
    console.log(`  ${marker} ${result.contract} › ${result.case} (${result.operation}) — ${detail}`);
  }
  if (summary.errorSpans.length) {
    console.log(`\n${summary.errorSpans.length} span(s) recorded errors:`);
    for (const span of summary.errorSpans.slice(0, 10)) {
      console.log(`  - ${span.name}${span.serviceName ? ` (${span.serviceName})` : ""}`);
    }
  }

  const mismatches = summary.cases.filter((c) => c.verdict === "shape-mismatch");
  console.log(
    `\n${summary.cases.filter((c) => c.verdict === "verified").length} verified, ${mismatches.length} shape mismatch(es), ${summary.cases.filter((c) => c.verdict === "not-exercised").length} not exercised`
  );
  if (mismatches.length) process.exitCode = 1;
  return summary;
}
