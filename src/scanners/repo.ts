import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DetectedComponent, Inventory } from "../core/types.js";

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

interface Signature {
  id: string;
  name: string;
  category: DetectedComponent["category"];
  pattern: RegExp;
}

const signatures: Signature[] = [
  { id: "postgres", name: "PostgreSQL", category: "data", pattern: /postgres|pgvector|\bpg\b/i },
  { id: "redis", name: "Redis", category: "data", pattern: /\bredis\b/i },
  { id: "aws", name: "AWS", category: "cloud", pattern: /aws-sdk|@aws-sdk|boto3|provider\s+"aws"|aws_/i },
  { id: "openai", name: "OpenAI", category: "ai", pattern: /openai/i },
  { id: "anthropic", name: "Anthropic", category: "ai", pattern: /anthropic/i },
  { id: "sentry", name: "Sentry", category: "observability", pattern: /sentry/i },
  { id: "opentelemetry", name: "OpenTelemetry", category: "observability", pattern: /opentelemetry|open-telemetry|\botel\b/i },
  { id: "okta", name: "Okta", category: "auth", pattern: /\bokta\b/i },
  { id: "auth0", name: "Auth0", category: "auth", pattern: /auth0/i }
];

const MAX_EVIDENCE_FILES = 5;

export async function scanRepository(root: string): Promise<Inventory> {
  const files = await walk(root);
  const rel = files.map((f) => path.relative(root, f));
  const components: DetectedComponent[] = [];

  const has = (predicate: (f: string) => boolean) => rel.filter(predicate);

  const packageFiles = has((f) => f === "package.json" || f.endsWith("/package.json"));
  if (packageFiles.length) components.push(component("nodejs", "Node.js", "runtime", packageFiles));

  const pythonFiles = has((f) => /(^|\/)(pyproject\.toml|requirements\.txt|Pipfile)$/.test(f));
  if (pythonFiles.length) components.push(component("python", "Python", "runtime", pythonFiles));

  const dockerFiles = has((f) => /(^|\/)Dockerfile$/.test(f) || /docker-compose.*\.ya?ml$/.test(f));
  if (dockerFiles.length) components.push(component("docker", "Docker", "infrastructure", dockerFiles));

  const terraformFiles = has((f) => f.endsWith(".tf"));
  if (terraformFiles.length) components.push(component("terraform", "Terraform", "infrastructure", terraformFiles.slice(0, 20)));

  const k8sFiles = has((f) => /(k8s|kubernetes|helm)/i.test(f) && /\.ya?ml$/.test(f));
  if (k8sFiles.length) components.push(component("kubernetes", "Kubernetes", "infrastructure", k8sFiles.slice(0, 20)));

  const ghActions = has((f) => f.startsWith(path.join(".github", "workflows") + path.sep) && /\.ya?ml$/.test(f));
  if (ghActions.length) components.push(component("github-actions", "GitHub Actions", "cicd", ghActions));

  // Signature scan: read a bounded set of text files and record which files matched,
  // so every detection carries file-level evidence. fde.yaml is excluded — declared
  // systems are engagement input, not repository discovery.
  const textCandidates = rel
    .filter((f) => /(package\.json|pyproject\.toml|requirements\.txt|\.tf$|\.ya?ml$|\.ts$|\.js$|\.py$)/.test(f))
    .filter((f) => f !== "fde.yaml" && !f.endsWith(`${path.sep}fde.yaml`))
    .slice(0, 250);

  const matches = new Map<string, string[]>();
  for (const file of textCandidates) {
    let content: string;
    try {
      content = (await readFile(path.join(root, file), "utf8")).slice(0, 20000);
    } catch {
      continue;
    }
    for (const sig of signatures) {
      if (!sig.pattern.test(content)) continue;
      const found = matches.get(sig.id) ?? [];
      if (found.length < MAX_EVIDENCE_FILES) found.push(file);
      matches.set(sig.id, found);
    }
  }

  for (const sig of signatures) {
    const evidence = matches.get(sig.id);
    if (evidence && !components.some((c) => c.id === sig.id)) {
      components.push(component(sig.id, sig.name, sig.category, evidence));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    root: path.resolve(root),
    components
  };
}
