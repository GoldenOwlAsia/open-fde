# Eval Declarations and `.fde/evals/` Conventions

OpenFDE **verifies that evaluation artifacts exist and are fresh** — it does
not execute evals. Running them belongs to your eval harness; OpenFDE checks
that the engagement's claims about evaluation are backed by artifacts on disk.

## Declaring suites

```yaml
spec:
  evaluation:
    required: true
    suites:
      - name: ticket-regression
        type: regression              # regression | task-success
        location: .fde/evals/ticket-regression
        requiredBeforeDeploy: true
        maxAgeDays: 30                # optional freshness bound
```

- `location` is resolved relative to the engagement root. It may be a file or
  a directory.
- `requiredBeforeDeploy: true` makes a missing artifact **critical**
  (`eval-artifact-missing`); otherwise it is a warning.
- `maxAgeDays` adds a freshness check (`eval-artifact-stale`, warning): the
  newest file under `location` must have been modified within the bound.

## Conventions for `.fde/evals/`

```text
.fde/evals/
└── ticket-regression/
    ├── results.jsonl     # one JSON object per case: {case, expected, actual, pass}
    └── summary.json      # optional: aggregate metrics for the report
```

- One directory per suite, named after the declared suite name.
- Keep artifacts **committable**: no raw customer data, no secrets. Redact
  before writing — the artifact is evidence you will show the customer.
- Results should be reproducible: record the model/version and fixture set
  used alongside the outcomes.
- Locations outside `.fde/evals/` (e.g. `evals/` in the repo) are fine —
  declare whatever path the artifacts actually live at.

## What the checks look at

| Check | Fires when | Severity |
|---|---|---|
| `eval-artifact-missing` | `location` does not exist | critical if `requiredBeforeDeploy`, else warning |
| `eval-artifact-stale` | newest file under `location` is older than `maxAgeDays` | warning |
| `evaluation-not-declared` | `spec.evaluation` missing entirely | warning |
