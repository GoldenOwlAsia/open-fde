---
name: openfde
description: Run a local-first environment discovery and deployment preflight on any repository using the OpenFDE CLI (fde init/scan/map/check/report). Use when asked to assess deployment readiness, map integrations, audit an unfamiliar customer codebase, or generate an FDE engagement report.
license: Apache-2.0
---

# OpenFDE — Deployment Preflight Skill

OpenFDE is a local-first CLI for Forward Deployed Engineers. It scans a repository, maps its integrations into a graph, runs explainable deployment-readiness checks, and produces a shareable Markdown report — fully offline, with file-level evidence for every finding.

Use this skill when the user wants to:

- understand what is actually inside an unfamiliar repository (runtimes, infra, data stores, AI providers, observability, auth);
- check whether an AI system is safe to deploy (PII policy, human approval boundaries, evals, retries/fallbacks);
- generate an integration graph (JSON + Mermaid) of the codebase;
- produce a deployment-readiness report to review with a customer.

## Capabilities

| Command | What it does | Output |
|---|---|---|
| `fde init` | Creates the `.fde/` workspace and a starter `fde.yaml` engagement file | `fde.yaml`, `.fde/` |
| `fde scan` | Detects components: Node.js, Python, Docker, Terraform, Kubernetes, GitHub Actions, PostgreSQL, Redis, AWS, OpenAI, Anthropic, Sentry, OpenTelemetry, Okta, Auth0 — each with file-level evidence | `.fde/environment/inventory.json` |
| `fde map` | Builds a normalized integration graph from detected components plus declared systems | `.fde/environment/integration-graph.json`, `.mmd` (Mermaid) |
| `fde check` | Runs readiness checks across Security, Data, Reliability, Evaluation, Observability, and Human Control, with per-category and overall scores | terminal findings + scores |
| `fde report` | Renders engagement summary, detected environment, readiness scores, critical findings, warnings, and next actions | `.fde/report.md` |

Every check explains **why** it fired and which evidence produced it — no opaque AI scoring.

## Installation

Requires Node.js 20+.

```bash
git clone https://github.com/GoldenOwlAsia/open-fde.git
cd open-fde
pnpm install        # or: npm install
pnpm build          # or: npm run build
npm link            # makes the `fde` command available globally
```

Or run directly from the checkout without linking:

```bash
npm run dev -- <command> [path-to-target-repo]
```

## How to use (agent workflow)

Run the full preflight from the root of the target repository:

```bash
fde init      # once per repo — creates fde.yaml and .fde/
fde scan      # discover components
fde map       # build the integration graph
fde check     # run readiness checks
fde report    # write .fde/report.md
```

Then:

1. Read `.fde/report.md` and summarize the readiness score, critical findings, and warnings for the user.
2. If checks flag missing declarations (PII policy, human approval boundaries, eval suites, retry/fallback policies), offer to edit `fde.yaml` — the engagement spec under `spec.constraints`, `spec.systems`, and `spec.successMetrics` — and re-run `fde check`.
3. Use `.fde/environment/integration-graph.mmd` when the user wants a visual architecture map (it is standard Mermaid).

The engagement schema is documented in `docs/FDE_SCHEMA.md` and validated by `schemas/fde.schema.json`.

## Safety notes

- OpenFDE is local-first: it never uploads source code, `.env` files, secrets, or scan output.
- Scanning is deterministic and read-only; the only writes are inside `.fde/` and the starter `fde.yaml`.
- Do not commit customer-sensitive values into `fde.yaml`; declare constraints, not credentials.

## Supported AI assistants

- Claude Code (use as an Agent Skill or invoke the CLI directly)
- Codex CLI
- Cursor / Cline-derived agents
- ChatGPT and other assistants with shell access (drive the CLI and read the `.fde/` artifacts)

## Links

- Repository: https://github.com/GoldenOwlAsia/open-fde
- Architecture: `docs/ARCHITECTURE.md`
- Engagement schema: `docs/FDE_SCHEMA.md`
- Security model: `docs/SECURITY.md`
