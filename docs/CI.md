# OpenFDE in CI

`fde check` is designed to work as a CI gate: machine-readable output, SARIF
for GitHub code scanning, and an explicit exit-code policy. OpenFDE itself
makes **zero network calls** — the only upload in the flows below is the
optional SARIF upload to GitHub, performed by GitHub's own action.

## Exit codes

```bash
fde check --fail-on critical   # default: exit 1 only on critical findings
fde check --fail-on warning    # exit 1 on critical or warning findings
fde check --fail-on never      # always exit 0 (report-only mode)
```

## Machine-readable output

```bash
fde check --format json  > openfde.json   # stable JSON: scores + findings
fde check --format sarif > openfde.sarif  # SARIF 2.1.0 for code scanning
```

The JSON format is the same document written to `.fde/check-result.json`:
`{ generatedAt, overallScore, scores, findings }`. Findings carry
`id`, `severity`, `category`, `explanation`, `evidence`, `recommendation`.

Findings can be narrowed with `--only <ids>` / `--skip <ids>`, and severities
can be overridden (with a required reason) in `fde.yaml` — see
[`FDE_SCHEMA.md`](FDE_SCHEMA.md).

## Using the reusable action

The repository ships a composite action that runs `scan` + `check` and uploads
SARIF to code scanning:

```yaml
name: OpenFDE Preflight

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  security-events: write   # only needed for the SARIF upload

jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: GoldenOwlAsia/open-fde@v0.1.0
        with:
          path: "."
          fail-on: critical      # critical | warning | never
          upload-sarif: "true"
```

Findings then appear in the repository's **Security → Code scanning** tab,
anchored to the file and line each piece of evidence points at.

## Rolling your own workflow

If you prefer not to use the composite action:

```yaml
jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx --yes openfde scan .
      - run: npx --yes openfde check . --format sarif --fail-on critical > openfde.sarif
      - uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: openfde.sarif
```

## Recommended repository setup

- Commit `fde.yaml` — it is the contract the checks validate against.
- Add `.fde/` to `.gitignore` if you do not want generated artifacts in the
  repo (the workspace is deterministic and can be regenerated), or commit it
  if you want the readiness report reviewable in pull requests.
- Use `spec.checks.overrides` (with a reason) rather than `--skip` in CI, so
  accepted risks are documented in the engagement file instead of the
  pipeline definition.
