# `fde status`

```bash
fde status [root]
```

Deployment health summary computed **only from imported evidence** — traces,
incidents, and evidence packs in the workspace. OpenFDE never contacts
production itself.

```text
OpenFDE Status — declared vs observed (from imported evidence)

  ✓ observed   customers
  · no signal  payments_gateway

Observed in traces but not declared: payments, support-agent

Traces: 1 (1 error span(s)) · Incidents: 1 (1 open) · Evidence files: 2
Last import: 2026-08-16T03:12:09.000Z
```

- A declared system counts as **observed** when a span's service name matches
  its id/type, or a span name is prefixed `"<id>."` (named heuristic).
- **Observed but not declared** is the interesting list: production traffic
  touching systems the engagement never declared.
- Incidents are **open** when they have no `resolvedAt`.
