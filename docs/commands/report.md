# `fde report`

```bash
fde report [root]
```

Generates `.fde/report.md` — the shareable Markdown deployment report — from
the scan inventory and the latest check result. Requires `fde scan` and
`fde check` to have run.

## Contents

- Engagement summary (name, customer, objective, cloud)
- Readiness table (per-category scores + overall)
- Detected environment with evidence
- Critical findings and warnings, each with evidence and a recommendation
- **Open questions** — the questions to bring to the customer, derived from
  the findings
- Pointer to the integration map artifacts
- Suggested next actions

The report is a plain Markdown file: review it with the customer, commit it,
or paste it into a ticket. No hosted dashboard involved.
