# `fde import`

Imports externally-exported records into the workspace and normalizes them.
OpenFDE never contacts production: these are files **you** exported from your
own tooling. Everything passes through redaction on the way in.

## `fde import trace <file>`

Imports a **file-based OTLP JSON** trace export (the JSON encoding of
`ExportTraceServiceRequest`, i.e. `{ resourceSpans: [...] }`) into
`.fde/traces/<name>.json` as normalized spans:

```json
{
  "format": "otlp-json",
  "spans": [
    {
      "traceId": "t1", "spanId": "s1", "name": "customers.lookup",
      "serviceName": "support-agent", "durationMs": 2000,
      "status": "ok", "attributes": { "response.id": "123" }
    }
  ],
  "redactions": [{ "kind": "connection-string-password", "count": 1 }]
}
```

Span attribute values are redacted; `.fde/traces/` is gitignored by default
(traces may still be sensitive even after redaction).

## `fde import incident <file>`

Normalizes a minimal incident record (YAML or JSON — at minimum a `title`;
optionally `id`, `severity`, `startedAt`, `resolvedAt`, `summary`,
`systems: [ids]`) into `.fde/incidents/<id>.json`. Referenced systems are
linked against `spec.systems` and marked `declared: true/false`, so an
incident touching an undeclared system stands out.

## See also

- [`replay`](replay.md) — re-run an imported trace against the contracts
- [`status`](status.md) — declared vs observed summary
