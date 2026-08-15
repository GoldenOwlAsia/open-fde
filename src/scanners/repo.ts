import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DetectedComponent, Inventory, ScanSignals } from "../core/types.js";
import { builtinContentSignatures, builtinFileSignatures } from "./contributions.js";

async function walk(root: string, maxFiles = 1500): Promise<string[]> {
  const results: string[] = [];
  const ignored = new Set(["node_modules", ".git", ".fde", "dist", "build", ".next", ".venv", "venv"]);

  async function visit(dir: string): Promise<void> {
    if (results.length >= maxFiles) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else results.push(full);
      if (results.length >= maxFiles) break;
    }
  }

  await visit(root);
  return results;
}

function component(
  id: string,
  name: string,
  category: DetectedComponent["category"],
  evidence: string[]
): DetectedComponent {
  return { id, name, category, evidence, confidence: evidence.length > 1 ? "high" : "medium" };
}

const MAX_EVIDENCE_FILES = 5;
const MAX_SIGNALS_PER_KIND = 25;

// Cloud region literal, e.g. us-east-1, ap-southeast-1, eu-gov-west-1.
// Availability zones (us-east-1a) intentionally do not match.
const REGION_RE = /\bregion\b[^\S\n]*[=:][^\S\n]*"?([a-z]{2}(?:-gov)?-[a-z]+-\d)\b/g;

// Secret heuristics report file + line + kind only — never the matched value.
const SECRET_PATTERNS: Array<{ kind: string; re: RegExp }> = [
  { kind: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: "private key material", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    kind: "possible hardcoded credential",
    re: /\b(api[_-]?key|apikey|secret|token|password|passwd)\b['"]?\s*[:=]\s*['"][^'"\s]{16,}['"]/i
  }
];
// Placeholder-looking values that should not count as credentials.
const SECRET_FALSE_POSITIVE_RE = /\$\{|process\.env|os\.environ|<[^>]*>|\b(example|changeme|placeholder|your[-_]|dummy)\b/i;

const SQL_WRITE = { pattern: "SQL INSERT/UPDATE/DELETE", re: /\bINSERT\s+INTO\b|\bUPDATE\s+\w+\s+SET\b|\bDELETE\s+FROM\b|\bDROP\s+TABLE\b|\bTRUNCATE\s+TABLE\b/i };
// Write-implying code signals per declared system type. Named heuristics, not proof.
const WRITE_PATTERNS: Record<string, Array<{ pattern: string; re: RegExp }>> = {
  postgres: [SQL_WRITE],
  mysql: [SQL_WRITE],
  s3: [{ pattern: "S3 object upload", re: /putObject|put_object|upload_file|createMultipartUpload/ }],
  redis: [{ pattern: "Redis write command", re: /\.(hset|lpush|rpush|sadd|zadd|flushall|flushdb)\s*\(/i }]
};

const isEnvFile = (f: string) => /(^|\/)\.env(\.[^/]+)?$/.test(f);
const isEnvExample = (f: string) => /\.(example|sample|template)$/.test(f);
const isCodeFile = (f: string) => /\.(ts|js|py|sql)$/.test(f);
const isInfraFile = (f: string) => f.endsWith(".tf") || /\.ya?ml$/.test(f);

export async function scanRepository(root: string): Promise<Inventory> {
  const files = await walk(root);
  // Repo-relative paths are normalized to POSIX form so matchers, evidence
  // strings, and generated artifacts are identical on every OS.
  const rel = files.map((f) => path.relative(root, f).split(path.sep).join("/"));
  const components: DetectedComponent[] = [];

  for (const sig of builtinFileSignatures) {
    const evidence = rel.filter(sig.matches);
    if (!evidence.length) continue;
    components.push(component(sig.id, sig.name, sig.category, evidence.slice(0, sig.maxEvidence ?? evidence.length)));
  }

  // Signature scan: read a bounded set of text files and record which files matched,
  // so every detection carries file-level evidence. fde.yaml is excluded — declared
  // systems are engagement input, not repository discovery.
  const textCandidates = rel
    .filter(
      (f) =>
        /(package\.json|pyproject\.toml|requirements\.txt|\.tf$|\.ya?ml$|\.ts$|\.js$|\.py$|\.sql$)/.test(f) ||
        isEnvFile(f)
    )
    .filter((f) => f !== "fde.yaml" && !f.endsWith("/fde.yaml"))
    .slice(0, 250);

  const signals: ScanSignals = { regions: [], secretSuspects: [], writeSignals: [] };
  for (const file of rel) {
    if (isEnvFile(file) && !isEnvExample(file) && signals.secretSuspects.length < MAX_SIGNALS_PER_KIND) {
      signals.secretSuspects.push({ file, line: 1, kind: "dotenv file in the repository (verify it is not committed)" });
    }
  }

  const matches = new Map<string, string[]>();
  for (const file of textCandidates) {
    let content: string;
    try {
      content = (await readFile(path.join(root, file), "utf8")).slice(0, 20000);
    } catch {
      continue;
    }
    for (const sig of builtinContentSignatures) {
      if (!sig.pattern.test(content)) continue;
      const found = matches.get(sig.id) ?? [];
      if (found.length < MAX_EVIDENCE_FILES) found.push(file);
      matches.set(sig.id, found);
    }
    collectSignals(file, content, signals);
  }

  for (const sig of builtinContentSignatures) {
    const evidence = matches.get(sig.id);
    if (evidence && !components.some((c) => c.id === sig.id)) {
      components.push(component(sig.id, sig.name, sig.category, evidence));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    root: path.resolve(root),
    components,
    signals
  };
}

function collectSignals(file: string, content: string, signals: ScanSignals): void {
  const lines = content.split(/\r?\n/);

  if (isInfraFile(file)) {
    lines.forEach((text, index) => {
      for (const match of text.matchAll(REGION_RE)) {
        if (signals.regions.length >= MAX_SIGNALS_PER_KIND) return;
        signals.regions.push({ region: match[1], evidence: `${file}:${index + 1}` });
      }
    });
  }

  const scanForSecrets = !isEnvExample(file);
  if (scanForSecrets) {
    lines.forEach((text, index) => {
      for (const { kind, re } of SECRET_PATTERNS) {
        if (signals.secretSuspects.length >= MAX_SIGNALS_PER_KIND) return;
        if (!re.test(text) || SECRET_FALSE_POSITIVE_RE.test(text)) continue;
        signals.secretSuspects.push({ file, line: index + 1, kind });
        break; // one report per line is enough
      }
    });
  }

  if (isCodeFile(file)) {
    for (const [systemType, patterns] of Object.entries(WRITE_PATTERNS)) {
      // Redis write commands are generic method names; only attribute them when
      // the file actually references redis.
      if (systemType === "redis" && !/redis/i.test(content)) continue;
      lines.forEach((text, index) => {
        for (const { pattern, re } of patterns) {
          if (signals.writeSignals.length >= MAX_SIGNALS_PER_KIND) return;
          if (!re.test(text)) continue;
          signals.writeSignals.push({ systemType, file, line: index + 1, pattern });
        }
      });
    }
  }
}
