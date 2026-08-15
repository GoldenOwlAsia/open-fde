# Changelog

All notable changes to OpenFDE are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
