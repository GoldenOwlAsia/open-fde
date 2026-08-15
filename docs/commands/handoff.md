# `fde handoff` (and `decision add` / `learning add`)

## `fde handoff`

```bash
fde handoff [root]
```

Generates the handoff package — everything a second engineer needs to pick
the engagement up from `.fde/` alone:

- `.fde/handoff/handoff.md` — human summary: ownership, unresolved risks
  (with evidence), open customer questions, ADR index, known failure modes,
  runbook index, operational evidence counts.
- `.fde/handoff/handoff.json` — the same data as a machine-readable manifest.
- **Runbook skeletons** in `.fde/runbooks/` (`deploy.md`, `rollback.md`,
  `incident-triage.md`), generated from the graph and checks: read-write
  systems become rollback targets, human-approval boundaries become
  escalation rules, declared eval suites become deploy gates. Existing
  runbooks are **never overwritten**.

Ownership comes from `spec.ownership` in `fde.yaml`:

```yaml
spec:
  ownership:
    owner: Phil
    contacts:
      - name: Dana
        role: customer platform lead
        contact: dana@example.com
```

## `fde decision add`

```bash
fde decision add "Use Postgres row-level security" \
  --context "Multi-tenant isolation" \
  --decision "Enable RLS on all tenant tables" \
  --consequences "Queries must set tenant context"
```

Writes a sequentially numbered ADR (`0001-use-postgres-row-level-security.md`)
into `.fde/architecture/decisions/`. Flags are optional; omitted sections get
TODO placeholders. Non-interactive by design.

## `fde learning add`

```bash
fde learning add "Observability gap hid retry storm" \
  --failure-mode "Retries looped invisibly for 3 hours" \
  --mitigation "Alert on retry-rate before launch" \
  --checks observability-not-detected
```

Records a known failure mode in `.fde/learnings/`. Learnings linked via
`--checks` are attached as evidence to matching findings on every subsequent
`fde check` — the engagement remembers what already went wrong once.
`--incidents` links learnings to imported incident ids.
