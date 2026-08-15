// Shared redaction utilities used by evidence packs, trace import, and
// (later) handoff/extract. Rule zero: a redactor may only ever REMOVE
// information — never print, log, or return the matched secret.

export interface RedactionCount {
  kind: string;
  count: number;
}

export interface RedactionResult {
  text: string;
  redactions: RedactionCount[];
}

interface Rule {
  kind: string;
  re: RegExp;
  /** Replacement; may use capture groups to preserve non-secret context. */
  replacement: string;
}

const RULES: Rule[] = [
  {
    kind: "private-key",
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: "[REDACTED:private-key]"
  },
  { kind: "aws-access-key-id", re: /\bAKIA[0-9A-Z]{16}\b/g, replacement: "[REDACTED:aws-access-key-id]" },
  { kind: "jwt", re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g, replacement: "[REDACTED:jwt]" },
  { kind: "slack-token", re: /\bxox[a-z]-[A-Za-z0-9-]{10,}\b/g, replacement: "[REDACTED:slack-token]" },
  { kind: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, replacement: "[REDACTED:github-token]" },
  {
    kind: "bearer-token",
    re: /\b(Bearer|Basic)\s+[A-Za-z0-9\-._~+/=]{16,}/g,
    replacement: "$1 [REDACTED:token]"
  },
  {
    kind: "connection-string-password",
    re: /\b([a-z][a-z0-9+]{1,20}:\/\/[^\s:/@'"]+):([^\s/@'"]+)@/g,
    replacement: "$1:[REDACTED:password]@"
  },
  {
    kind: "credential-assignment",
    re: /\b((?:api[_-]?key|apikey|secret|token|password|passwd|access[_-]?key|client[_-]?secret)[a-z0-9_-]*['"]?\s*[:=]\s*)(['"]?)[^'"\s]{8,}\2/gi,
    replacement: "$1$2[REDACTED:credential]$2"
  }
];

export function redactText(text: string): RedactionResult {
  let output = text;
  const redactions: RedactionCount[] = [];
  for (const rule of RULES) {
    const matches = output.match(rule.re);
    if (!matches?.length) continue;
    output = output.replace(rule.re, rule.replacement);
    redactions.push({ kind: rule.kind, count: matches.length });
  }
  return { text: output, redactions };
}

/** Deep-redacts every string value in a JSON-like structure. */
export function redactValue<T>(value: T, counts: Map<string, number> = new Map()): T {
  if (typeof value === "string") {
    const { text, redactions } = redactText(value);
    for (const r of redactions) counts.set(r.kind, (counts.get(r.kind) ?? 0) + r.count);
    return text as T;
  }
  if (Array.isArray(value)) return value.map((v) => redactValue(v, counts)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, redactValue(v, counts)])
    ) as T;
  }
  return value;
}

export const toRedactionCounts = (counts: Map<string, number>): RedactionCount[] =>
  [...counts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => a.kind.localeCompare(b.kind));
