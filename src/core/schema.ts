import { readFile } from "node:fs/promises";
import { LineCounter, parseDocument } from "yaml";

export const SUPPORTED_API_VERSION = "openfde.dev/v1alpha1";

export interface SchemaIssue {
  severity: "error" | "warning";
  path: string;
  message: string;
  line?: number;
  col?: number;
}

export interface ValidationResult {
  errors: SchemaIssue[];
  warnings: SchemaIssue[];
}

// Subset of JSON Schema used by schemas/fde.schema.json: type, const, enum,
// required, properties, additionalProperties (boolean), items, minLength.
interface SchemaNode {
  type?: string;
  const?: unknown;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, SchemaNode>;
  additionalProperties?: boolean;
  items?: SchemaNode;
  minLength?: number;
}

const schemaUrl = new URL("../../schemas/fde.schema.json", import.meta.url);
let cachedSchema: SchemaNode | null = null;

export async function loadSchema(): Promise<SchemaNode> {
  if (!cachedSchema) cachedSchema = JSON.parse(await readFile(schemaUrl, "utf8")) as SchemaNode;
  return cachedSchema;
}

type PathSegment = string | number;

const formatPath = (segments: PathSegment[]): string =>
  segments.length
    ? segments.map((s, i) => (typeof s === "number" ? `[${s}]` : i === 0 ? s : `.${s}`)).join("")
    : "(root)";

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function matchesType(value: unknown, type: string): boolean {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return typeOf(value) === "object";
  if (type === "integer") return typeof value === "number" && Number.isInteger(value);
  return typeOf(value) === type;
}

function validateNode(
  schema: SchemaNode,
  value: unknown,
  segments: PathSegment[],
  issues: SchemaIssue[]
): void {
  const path = formatPath(segments);

  if (schema.const !== undefined && value !== schema.const) {
    issues.push({ severity: "error", path, message: `must be ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}` });
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    issues.push({
      severity: "error",
      path,
      message: `must be one of ${schema.enum.map((v) => JSON.stringify(v)).join(", ")}, got ${JSON.stringify(value)}`
    });
    return;
  }
  if (schema.type && !matchesType(value, schema.type)) {
    issues.push({ severity: "error", path, message: `must be a ${schema.type}, got ${typeOf(value)}` });
    return;
  }

  if (schema.type === "string" && typeof value === "string" && schema.minLength && value.length < schema.minLength) {
    issues.push({ severity: "error", path, message: `must not be empty` });
  }

  if (schema.type === "object" && typeOf(value) === "object") {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (record[key] === undefined) {
        issues.push({ severity: "error", path, message: `missing required field "${key}"` });
      }
    }
    for (const [key, child] of Object.entries(record)) {
      const childSchema = schema.properties?.[key];
      if (childSchema) {
        if (child !== undefined) validateNode(childSchema, child, [...segments, key], issues);
      } else if (schema.additionalProperties === false) {
        issues.push({ severity: "error", path: formatPath([...segments, key]), message: `unknown field "${key}"` });
      } else if (schema.properties) {
        issues.push({
          severity: "warning",
          path: formatPath([...segments, key]),
          message: `unknown field "${key}" (not part of the ${SUPPORTED_API_VERSION} schema)`
        });
      }
    }
  }

  if (schema.type === "array" && Array.isArray(value) && schema.items) {
    value.forEach((item, index) => validateNode(schema.items as SchemaNode, item, [...segments, index], issues));
  }
}

// Resolve a dotted path (e.g. spec.systems[0].access) back to a YAML node so
// issues can point at fde.yaml line/column.
function locate(
  doc: ReturnType<typeof parseDocument>,
  lineCounter: LineCounter,
  path: string
): { line: number; col: number } | undefined {
  if (path === "(root)") return { line: 1, col: 1 };
  const segments: PathSegment[] = [];
  for (const part of path.split(".")) {
    const match = part.match(/^([^[]+)((\[\d+\])*)$/);
    if (!match) return undefined;
    segments.push(match[1]);
    for (const idx of match[2].matchAll(/\[(\d+)\]/g)) segments.push(Number(idx[1]));
  }
  for (let depth = segments.length; depth > 0; depth--) {
    const node = doc.getIn(segments.slice(0, depth), true) as { range?: [number, number, number] } | undefined;
    if (node?.range) {
      const pos = lineCounter.linePos(node.range[0]);
      return { line: pos.line, col: pos.col };
    }
  }
  return undefined;
}

export async function validateEngagementText(text: string): Promise<ValidationResult> {
  const lineCounter = new LineCounter();
  const doc = parseDocument(text, { lineCounter });

  if (doc.errors.length) {
    return {
      errors: doc.errors.map((error) => {
        const pos = error.pos?.[0] !== undefined ? lineCounter.linePos(error.pos[0]) : undefined;
        return { severity: "error" as const, path: "(root)", message: `invalid YAML: ${error.message.split("\n")[0]}`, line: pos?.line, col: pos?.col };
      }),
      warnings: []
    };
  }

  const value = doc.toJS();
  const issues: SchemaIssue[] = [];
  if (value === null || typeOf(value) !== "object") {
    issues.push({ severity: "error", path: "(root)", message: "fde.yaml must contain a YAML mapping (an Engagement object)" });
  } else {
    const record = value as Record<string, unknown>;
    if (record.apiVersion !== undefined && record.apiVersion !== SUPPORTED_API_VERSION) {
      issues.push({
        severity: "error",
        path: "apiVersion",
        message: `unsupported apiVersion ${JSON.stringify(record.apiVersion)} — this build of OpenFDE supports "${SUPPORTED_API_VERSION}"`
      });
      record.apiVersion = SUPPORTED_API_VERSION; // avoid a duplicate const error from the schema walk
    }
    validateNode(await loadSchema(), record, [], issues);
  }

  for (const issue of issues) {
    const pos = locate(doc, lineCounter, issue.path);
    issue.line = pos?.line;
    issue.col = pos?.col;
  }

  return {
    errors: issues.filter((i) => i.severity === "error"),
    warnings: issues.filter((i) => i.severity === "warning")
  };
}

export const formatIssue = (file: string, issue: SchemaIssue): string =>
  `${file}${issue.line ? `:${issue.line}${issue.col ? `:${issue.col}` : ""}` : ""} ${issue.path}: ${issue.message}`;
