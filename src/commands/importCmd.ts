import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { ensureWorkspace, exists, writeJson } from "../core/workspace.js";
import { loadEngagement } from "../core/engagement.js";
import { redactValue, toRedactionCounts } from "../core/redact.js";

// Imports normalize external records into the workspace. Everything passes
// through redaction; OpenFDE never contacts production systems itself —
// these are files the user exported from their own tooling.

export interface NormalizedSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  serviceName?: string;
  durationMs?: number;
  status: "ok" | "error" | "unset";
  attributes: Record<string, unknown>;
}

export interface NormalizedTrace {
  importedAt: string;
  source: string;
  format: "otlp-json";
  spans: NormalizedSpan[];
  redactions: Array<{ kind: string; count: number }>;
}

export interface NormalizedIncident {
  id: string;
  title: string;
  severity: string;
  startedAt?: string;
  resolvedAt?: string;
  summary?: string;
  /** Referenced systems, marked whether they are declared in fde.yaml. */
  systems: Array<{ id: string; declared: boolean }>;
  importedAt: string;
  source: string;
  redactions: Array<{ kind: string; count: number }>;
}

interface OtlpAttribute {
  key?: string;
  value?: { stringValue?: string; intValue?: string | number; doubleValue?: number; boolValue?: boolean };
}

const attrValue = (a: OtlpAttribute): unknown =>
  a.value?.stringValue ?? a.value?.intValue ?? a.value?.doubleValue ?? a.value?.boolValue;

const attributesToRecord = (attributes?: OtlpAttribute[]): Record<string, unknown> =>
  Object.fromEntries((attributes ?? []).filter((a) => a.key).map((a) => [a.key as string, attrValue(a)]));

function normalizeOtlp(raw: unknown): NormalizedSpan[] {
  const doc = raw as {
    resourceSpans?: Array<{
      resource?: { attributes?: OtlpAttribute[] };
      scopeSpans?: Array<{
        spans?: Array<{
          traceId?: string;
          spanId?: string;
          parentSpanId?: string;
          name?: string;
          startTimeUnixNano?: string | number;
          endTimeUnixNano?: string | number;
          status?: { code?: number };
          attributes?: OtlpAttribute[];
        }>;
      }>;
    }>;
  };
  if (!Array.isArray(doc?.resourceSpans)) {
    throw new Error("Not an OTLP JSON trace export: expected a top-level resourceSpans array.");
  }

  const spans: NormalizedSpan[] = [];
  for (const resourceSpan of doc.resourceSpans) {
    const resourceAttrs = attributesToRecord(resourceSpan.resource?.attributes);
    const serviceName = typeof resourceAttrs["service.name"] === "string" ? (resourceAttrs["service.name"] as string) : undefined;
    for (const scopeSpan of resourceSpan.scopeSpans ?? []) {
      for (const span of scopeSpan.spans ?? []) {
        if (!span.traceId || !span.spanId || !span.name) continue;
        const start = Number(span.startTimeUnixNano ?? 0);
        const end = Number(span.endTimeUnixNano ?? 0);
        spans.push({
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId || undefined,
          name: span.name,
          serviceName,
          durationMs: start && end ? Math.max(0, (end - start) / 1e6) : undefined,
          status: span.status?.code === 2 ? "error" : span.status?.code === 1 ? "ok" : "unset",
          attributes: attributesToRecord(span.attributes)
        });
      }
    }
  }
  if (!spans.length) throw new Error("The OTLP export contains no spans.");
  return spans;
}

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "incident";

export async function importTraceCommand(root: string, file: string): Promise<NormalizedTrace> {
  const ws = await ensureWorkspace(root);
  const source = path.resolve(file);
  if (!(await exists(source))) throw new Error(`Trace file not found: ${source}`);

  const raw = JSON.parse(await readFile(source, "utf8")) as unknown;
  const counts = new Map<string, number>();
  const spans = normalizeOtlp(raw).map((span) => ({ ...span, attributes: redactValue(span.attributes, counts) }));

  const trace: NormalizedTrace = {
    importedAt: new Date().toISOString(),
    source: path.basename(source),
    format: "otlp-json",
    spans,
    redactions: toRedactionCounts(counts)
  };

  const name = path.basename(source).replace(/\.json$/, "");
  const target = path.join(ws, "traces", `${name}.json`);
  await writeJson(target, trace);
  console.log(`Imported ${spans.length} span(s) → ${target}`);
  if (trace.redactions.length) {
    console.log(`Redacted: ${trace.redactions.map((r) => `${r.count}× ${r.kind}`).join(", ")}`);
  }
  return trace;
}

export async function importIncidentCommand(root: string, file: string): Promise<NormalizedIncident> {
  const ws = await ensureWorkspace(root);
  const source = path.resolve(file);
  if (!(await exists(source))) throw new Error(`Incident file not found: ${source}`);

  const raw = parse(await readFile(source, "utf8")) as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object") throw new Error("Incident file must be a YAML/JSON object.");
  const title = typeof raw.title === "string" ? raw.title : undefined;
  if (!title) throw new Error('Incident record needs at least a "title" field.');

  const engagement = await loadEngagement(root);
  const declared = new Set((engagement?.spec?.systems ?? []).map((s) => s.id).filter(Boolean));
  const referenced = Array.isArray(raw.systems) ? raw.systems.filter((s): s is string => typeof s === "string") : [];

  const counts = new Map<string, number>();
  const incident: NormalizedIncident = redactValue(
    {
      id: typeof raw.id === "string" ? raw.id : slug(title),
      title,
      severity: typeof raw.severity === "string" ? raw.severity : "unknown",
      startedAt: typeof raw.startedAt === "string" ? raw.startedAt : undefined,
      resolvedAt: typeof raw.resolvedAt === "string" ? raw.resolvedAt : undefined,
      summary: typeof raw.summary === "string" ? raw.summary : undefined,
      systems: referenced.map((id) => ({ id, declared: declared.has(id) })),
      importedAt: new Date().toISOString(),
      source: path.basename(source),
      redactions: []
    },
    counts
  );
  incident.redactions = toRedactionCounts(counts);

  const target = path.join(ws, "incidents", `${incident.id}.json`);
  await writeJson(target, incident);
  const unknownSystems = incident.systems.filter((s) => !s.declared);
  console.log(`Imported incident "${incident.title}" → ${target}`);
  if (unknownSystems.length) {
    console.log(`Note: referenced system(s) not declared in fde.yaml: ${unknownSystems.map((s) => s.id).join(", ")}`);
  }
  return incident;
}
