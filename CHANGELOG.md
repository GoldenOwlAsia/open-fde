# Changelog

All notable changes to OpenFDE are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `fde validate` — validates `fde.yaml` against the engagement schema with
  `fde.yaml:line:col` error positions; the same validation now runs inside
  `map`/`check`/`report`. Unknown fields warn instead of failing.
- Internal check registry (`{ id, category, appliesTo, run(context) }`) — the
  interface the future plugin contract will expose.
- `fde check --only <ids>` / `--skip <ids>` to select checks.
- Severity overrides in `fde.yaml` (`spec.checks.overrides`) with a required
  `reason`, recorded as evidence on the overridden finding.
- New checks: `data-residency-violation` (regions in Terraform/K8s config vs
  `allowedRegions`), `secrets-committed` (`.env` files and credential-looking
  patterns — file + line only, values never persisted),
  `write-boundary-violation` (write-implying code signals against declared
  `read_only` systems), `success-metrics-undeclared`.
- Scanner signals in `inventory.json`: detected regions, secret suspects, and
  write signals, each with `file:line` evidence.
- CI integration: `fde check --format json|sarif` and
  `--fail-on critical|warning|never` (default `critical`), a reusable
  composite GitHub Action (`action.yml`), and an "OpenFDE in CI" guide
  (`docs/CI.md`).
- Plugin contract design doc (`docs/PLUGIN_CONTRACT.md`); built-in scanners
  refactored into the contribution interfaces the contract will expose.
- Docs: per-command references (`docs/commands/`), a "Writing a scanner"
  tutorial, and three new runnable examples (`python-ml`, `k8s-heavy`,
  `agent-with-tools`).
- Tests: golden-file suite for all generated artifacts and a per-family
  scanner false-positive regression suite.

- Agent deployment validation (v0.3 scope): `spec.agents` declarations
  (tools, per-tool access, side-effect and PII flags), `agent → tool →
  system` graph edges, and checks `agent-side-effect-unapproved`,
  `agent-access-exceeds-boundary`, `agent-tool-system-undeclared`.
- Eval declarations: `spec.evaluation.suites` with existence and freshness
  checks (`eval-artifact-missing`, `eval-artifact-stale`); conventions in
  `docs/EVALS.md`.
- Contract tests: `.fde/contracts/` fixture format (`docs/CONTRACT_TESTS.md`)
  and `fde test --contracts`.
- `fde export context`: one Markdown + JSON engagement bundle for coding
  agents.
- `fde mcp`: opt-in, local, read-only MCP server (stdio) exposing
  `get_engagement`, `get_environment`, `get_integrations`,
  `get_constraints`, `run_preflight`.
- Production evidence (v0.4 scope): shared redaction utilities
  (`src/core/redact.ts`), `fde evidence add` (redacted evidence packs),
  `fde import trace` (file-based OTLP JSON → normalized spans),
  `fde import incident` (normalized records linked to declared systems),
  `fde replay <trace>` (recorded trace vs contract fixtures, no production
  calls), and `fde status` (declared vs observed summary).

### Fixed

- The AWS content signature matched inside words (e.g. `flaws_found`).

## [0.1.0] - 2026-08-15

First public release: the V0.1 "Environment Doctor" MVP.

### Added

- `fde init` — creates the `.fde/` workspace and a starter `fde.yaml` engagement
  declaration (existing user files are preserved).
- `fde scan` — local, deterministic repository discovery with file-level evidence
  for every detection:
  - Runtimes: Node.js, Python
  - Infrastructure: Docker, Terraform, Kubernetes manifests
  - CI/CD: GitHub Actions
  - Data: PostgreSQL, Redis
  - Cloud: AWS
  - AI: OpenAI, Anthropic
  - Observability: Sentry, OpenTelemetry
  - Auth: Okta, Auth0
- `fde map` — normalized integration graph (`integration-graph.json` +
  Mermaid `integration-graph.mmd`) combining detected components with systems
  declared in `fde.yaml`, including declared access levels and
  declared-but-undetected systems.
- `fde check` — explainable deployment-readiness checks with evidence and
  recommendations: external model policy, PII policy, human approval boundary,
  observability, evaluation, and reliability (timeout/retry/fallback), plus
  per-category and overall readiness scores.
- `fde report` — Markdown deployment report (`.fde/report.md`) with engagement
  summary, detected environment, readiness table, findings, open questions, and
  next actions.
- Engagement schema (`schemas/fde.schema.json`, `apiVersion: openfde.dev/v1alpha1`).
- Unit, scanner, and end-to-end test suites; CI via GitHub Actions.

### Security

- Local-first: no telemetry, no network calls, nothing leaves the machine.
- `.fde/` and `fde.yaml` are excluded from discovery (declared systems are
  input, not findings).

[Unreleased]: https://github.com/GoldenOwlAsia/open-fde/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/GoldenOwlAsia/open-fde/releases/tag/v0.1.0
