import type { DetectedComponent } from "../core/types.js";

// Internal scanner contribution interfaces. These are the shapes the future
// plugin contract will expose (see docs/PLUGIN_CONTRACT.md) — built-in
// detectors are just contributions that ship with the CLI.
// Paths passed to matchers are always POSIX-normalized ("/" separators).

/** Detects a component from file path shape alone (no content read). */
export interface FileSignature {
  id: string;
  name: string;
  category: DetectedComponent["category"];
  matches: (relPath: string) => boolean;
  /** Cap on recorded evidence paths (default: unlimited). */
  maxEvidence?: number;
}

/** Detects a component from file contents in the bounded text scan. */
export interface ContentSignature {
  id: string;
  name: string;
  category: DetectedComponent["category"];
  pattern: RegExp;
}

export const builtinFileSignatures: FileSignature[] = [
  {
    id: "nodejs",
    name: "Node.js",
    category: "runtime",
    matches: (f) => f === "package.json" || f.endsWith("/package.json")
  },
  {
    id: "python",
    name: "Python",
    category: "runtime",
    matches: (f) => /(^|\/)(pyproject\.toml|requirements\.txt|Pipfile)$/.test(f)
  },
  {
    id: "docker",
    name: "Docker",
    category: "infrastructure",
    matches: (f) => /(^|\/)Dockerfile$/.test(f) || /docker-compose.*\.ya?ml$/.test(f)
  },
  {
    id: "terraform",
    name: "Terraform",
    category: "infrastructure",
    matches: (f) => f.endsWith(".tf"),
    maxEvidence: 20
  },
  {
    id: "kubernetes",
    name: "Kubernetes",
    category: "infrastructure",
    matches: (f) => /(k8s|kubernetes|helm)/i.test(f) && /\.ya?ml$/.test(f),
    maxEvidence: 20
  },
  {
    id: "github-actions",
    name: "GitHub Actions",
    category: "cicd",
    matches: (f) => f.startsWith(".github/workflows/") && /\.ya?ml$/.test(f)
  }
];

export const builtinContentSignatures: ContentSignature[] = [
  { id: "postgres", name: "PostgreSQL", category: "data", pattern: /postgres|pgvector|\bpg\b/i },
  { id: "redis", name: "Redis", category: "data", pattern: /\bredis\b/i },
  { id: "aws", name: "AWS", category: "cloud", pattern: /aws-sdk|@aws-sdk|boto3|provider\s+"aws"|\baws_/i },
  { id: "openai", name: "OpenAI", category: "ai", pattern: /openai/i },
  { id: "anthropic", name: "Anthropic", category: "ai", pattern: /anthropic/i },
  { id: "sentry", name: "Sentry", category: "observability", pattern: /sentry/i },
  { id: "opentelemetry", name: "OpenTelemetry", category: "observability", pattern: /opentelemetry|open-telemetry|\botel\b/i },
  { id: "okta", name: "Okta", category: "auth", pattern: /\bokta\b/i },
  { id: "auth0", name: "Auth0", category: "auth", pattern: /auth0/i }
];
