# `fde check`

```bash
fde check [root] [--only <ids>] [--skip <ids>] [--format text|json|sarif] [--fail-on critical|warning|never]
```

Runs the deployment-readiness checks against the scan inventory and the
declared engagement. Requires `fde scan` to have run. Always writes
`.fde/check-result.json`; the flags control terminal output and exit code.

## Checks

| Id | Category | Fires when |
|---|---|---|
| `external-model-policy-undefined` | security | An AI provider is detected but `spec.constraints.pii.allowExternalModel` is not set |
| `pii-policy-undefined` | data | `spec.constraints.pii` is missing (**critical**) |
| `human-approval-undefined` | human_control | `spec.constraints.humanApproval.requiredFor` is missing or empty |
| `observability-not-detected` | observability | No observability signal in repo or declared systems |
| `evaluation-not-declared` | evaluation | `spec.evaluation` is missing |
| `reliability-policy-absent` | reliability | timeout/retry/fallback not declared |
| `data-residency-violation` | data | Region literals in Terraform/K8s config outside `allowedRegions` (**critical**) |
| `secrets-committed` | security | `.env` files or credential-looking lines found (**critical**; values never printed) |
| `write-boundary-violation` | security | Write-implying code against a declared `read_only` system (**critical**) |
| `success-metrics-undeclared` | evaluation | No metric with both a name and a target |

Every finding carries evidence (`file:line` where possible) and a
recommendation. Scores are derived per category and overall.

## Flags

- `--only refund-check,other` / `--skip secrets-committed` — select checks by
  id. Unknown ids fail with the list of available checks.
- `--format json` — print the stable `check-result.json` document to stdout.
- `--format sarif` — print SARIF 2.1.0 (for GitHub code scanning).
- `--fail-on` — exit-code policy for CI. Default `critical`: exit 1 only when
  a critical finding exists. `warning` also fails on warnings; `never` always
  exits 0.

## Severity overrides

Accepted risks are declared in `fde.yaml`, with a required reason — see
[`docs/FDE_SCHEMA.md`](../FDE_SCHEMA.md#check-severity-overrides).

## See also

- [`docs/CI.md`](../CI.md) — using check as a CI gate
