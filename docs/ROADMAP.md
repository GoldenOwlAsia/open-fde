# OpenFDE Roadmap

> Detailed, checkable work items for each version live in [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).

## v0.1 — Environment Doctor

```text
init → scan → map → check → report
```

Success condition: a new engineer can clone an unfamiliar repository and receive a useful environment/readiness artifact within five minutes.

## v0.2 — Policy-aware Preflight

- richer constraints;
- JSON Schema validation;
- check packs;
- GitHub Action;
- SARIF output;
- first external plugin contract.

## v0.3 — Agent Deployment Validation

- tool/permission graph;
- agent contract-test format;
- eval declarations;
- MCP server;
- Claude/Codex/Cursor context export.

## v0.4 — Production Evidence

- OpenTelemetry import;
- evidence packs;
- incident import;
- deterministic replay primitives;
- deployment health summary.

## v0.5 — Handoff

- architecture decision inventory;
- known failure modes;
- runbook generator;
- ownership and unresolved-risk package;
- machine-readable handoff manifest.

## v1.0 — Forward Deployment Harness

Six pillars:

1. Discover
2. Model
3. Govern
4. Validate
5. Operate
6. Compound

Long-term community surfaces:

- scanners;
- policy packs;
- recipes;
- integration fixtures;
- reusable enterprise deployment patterns.
