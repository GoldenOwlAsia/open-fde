import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { loadEngagement } from "../core/engagement.js";
import { exists } from "../core/workspace.js";

// Contract fixtures are local and deterministic: they pin the *shape* of a
// declared integration (request → response fields) without live credentials
// or network calls. See docs/CONTRACT_TESTS.md.

interface ContractCase {
  name?: string;
  request?: { operation?: string; params?: Record<string, unknown> };
  response?: { example?: Record<string, unknown>; requiredFields?: string[] };
}

interface ContractFile {
  system?: string;
  description?: string;
  cases?: ContractCase[];
}

export interface ContractRunSummary {
  files: number;
  passed: number;
  failed: number;
  failures: string[];
}

export interface TestCommandOptions {
  contracts?: boolean;
}

function checkCase(file: string, c: ContractCase, index: number, failures: string[]): boolean {
  const label = `${file} › ${c.name ?? `case[${index}]`}`;
  const before = failures.length;
  if (!c.name) failures.push(`${label}: case has no name`);
  if (!c.request?.operation) failures.push(`${label}: request.operation is missing`);
  const example = c.response?.example;
  if (!example || typeof example !== "object" || Array.isArray(example)) {
    failures.push(`${label}: response.example must be an object`);
  } else {
    const required = c.response?.requiredFields ?? [];
    if (!required.length) failures.push(`${label}: response.requiredFields is empty — the contract asserts nothing`);
    for (const field of required) {
      if (example[field] === undefined) {
        failures.push(`${label}: response.example is missing required field "${field}"`);
      }
    }
  }
  return failures.length === before;
}

export async function testCommand(root: string, options: TestCommandOptions = {}): Promise<ContractRunSummary> {
  if (!options.contracts) {
    throw new Error("Nothing to run: pass --contracts (the only test type in this version).");
  }

  const engagement = await loadEngagement(root);
  const declaredSystems = new Set(
    (engagement?.spec?.systems ?? []).map((s) => s.id).filter((id): id is string => Boolean(id))
  );

  const dir = path.join(root, ".fde", "contracts");
  const summary: ContractRunSummary = { files: 0, passed: 0, failed: 0, failures: [] };
  if (!(await exists(dir))) {
    console.log("No contract fixtures found (.fde/contracts/ does not exist). Nothing to run.");
    return summary;
  }

  const files = (await readdir(dir)).filter((f) => /\.ya?ml$/.test(f)).sort();
  if (!files.length) {
    console.log("No contract fixtures found in .fde/contracts/. Nothing to run.");
    return summary;
  }

  console.log(`Running ${files.length} contract file(s) from .fde/contracts/\n`);
  for (const file of files) {
    summary.files += 1;
    let contract: ContractFile;
    try {
      contract = parse(await readFile(path.join(dir, file), "utf8")) as ContractFile;
    } catch (error) {
      summary.failed += 1;
      summary.failures.push(`${file}: invalid YAML — ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
      continue;
    }

    if (!contract?.system) {
      summary.failed += 1;
      summary.failures.push(`${file}: missing "system" (must reference a spec.systems id in fde.yaml)`);
      continue;
    }
    if (!declaredSystems.has(contract.system)) {
      summary.failed += 1;
      summary.failures.push(
        `${file}: system "${contract.system}" is not declared in fde.yaml (declared: ${declaredSystems.size ? [...declaredSystems].join(", ") : "none"})`
      );
      continue;
    }
    const cases = contract.cases ?? [];
    if (!cases.length) {
      summary.failed += 1;
      summary.failures.push(`${file}: no cases declared`);
      continue;
    }

    for (const [index, contractCase] of cases.entries()) {
      const ok = checkCase(file, contractCase, index, summary.failures);
      if (ok) {
        summary.passed += 1;
        console.log(`  ✓ ${file} › ${contractCase.name}`);
      } else {
        summary.failed += 1;
        console.log(`  ✗ ${file} › ${contractCase.name ?? `case[${index}]`}`);
      }
    }
  }

  console.log(`\n${summary.passed} passed, ${summary.failed} failed`);
  for (const failure of summary.failures) console.error(`  ${failure}`);
  if (summary.failed > 0) process.exitCode = 1;
  return summary;
}
