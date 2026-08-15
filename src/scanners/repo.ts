import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DetectedComponent, Inventory } from "../core/types.js";

async function walk(root: string, maxFiles = 1500): Promise<string[]> {
  const results: string[] = [];
  const ignored = new Set(["node_modules", ".git", "dist", "build", ".next", ".venv", "venv"]);

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

  const ghActions = has((f) => f.startsWith(".github/workflows/") && /\.ya?ml$/.test(f));
  if (ghActions.length) components.push(component("github-actions", "GitHub Actions", "cicd", ghActions));

  const textCandidates = rel.filter((f) => /(package\.json|pyproject\.toml|requirements\.txt|\.tf$|\.ya?ml$|\.ts$|\.js$|\.py$)/.test(f)).slice(0, 250);
  let corpus = "";
  for (const file of textCandidates) {
    try {
      const content = await readFile(path.join(root, file), "utf8");
      corpus += `\n${content.slice(0, 20000)}`;
    } catch {
      // Ignore unreadable files.
    }
  }

  const signatures: Array<[RegExp, DetectedComponent]> = [
    [/postgres|pgvector|\bpg\b/i, component("postgres", "PostgreSQL", "data", ["source/package reference"])],
    [/redis/i, component("redis", "Redis", "data", ["source/package reference"])],
    [/aws-sdk|@aws-sdk|provider\s+"aws"|aws_/i, component("aws", "AWS", "cloud", ["source/infrastructure reference"])],
    [/openai/i, component("openai", "OpenAI", "ai", ["source/package reference"])],
    [/anthropic/i, component("anthropic", "Anthropic", "ai", ["source/package reference"])],
    [/sentry/i, component("sentry", "Sentry", "observability", ["source/package reference"])],
    [/opentelemetry|open-telemetry|otel/i, component("opentelemetry", "OpenTelemetry", "observability", ["source/package reference"])],
    [/okta/i, component("okta", "Okta", "auth", ["source/package reference"])],
    [/auth0/i, component("auth0", "Auth0", "auth", ["source/package reference"])]
  ];

  for (const [regex, detected] of signatures) {
    if (regex.test(corpus) && !components.some((c) => c.id === detected.id)) components.push(detected);
  }

  return {
    generatedAt: new Date().toISOString(),
    root: path.resolve(root),
    components
  };
}
