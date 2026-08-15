# OpenFDE Implementation Plan

This is the working plan for taking OpenFDE from the V0.1 MVP to the v1.0 delivery harness.
It expands [`ROADMAP.md`](ROADMAP.md) into concrete, checkable work items.

**How to use this document**

- Each stage has a goal, a checklist, and an exit criterion.
- Check items off (`[x]`) as they are implemented **and verified** (tests or a documented manual run).
- Do not start a stage before the previous stage's exit criterion is met, unless an item is explicitly marked as parallel-safe.
- Every stage must respect the standing rules in [`AGENTS.md`](../AGENTS.md) and [`SECURITY.md`](SECURITY.md): local-first, no telemetry, deterministic before LLM, evidence for every finding.

**Status legend**

- `[x]` implemented and verified
- `[ ]` not started / in progress

---

## Stage 0 — V0.1 MVP: Environment Doctor ✅ (core complete)

> Goal: `init → scan → map → check → report` produces a useful, evidenced readiness artifact on an unfamiliar repository in under five minutes, fully offline.

### CLI + workspace

- [x] CLI command routing (`commander`, `fde <command> [root]`)
- [x] `.fde/` workspace creation (`environment/`, `architecture/decisions/`, `policies/`, `evals/`, `evidence/`, `handoff/`, `learnings/`)
- [x] `fde init` creates starter `fde.yaml`, preserves existing user files
- [x] Engagement parsing via typed YAML loader (`src/core/engagement.ts`), clear error on invalid YAML

### Scanning

- [x] Runtime signals: Node.js, Python
- [x] Infrastructure: Docker, Terraform, Kubernetes manifests
- [x] CI/CD: GitHub Actions
- [x] Data: PostgreSQL, Redis
- [x] Cloud: AWS
- [x] AI: OpenAI, Anthropic
- [x] Observability: Sentry, OpenTelemetry
- [x] Auth: Okta, Auth0
- [x] File-level evidence recorded for every detection (no vague "reference" strings)
- [x] `.fde/` and `fde.yaml` excluded from discovery (declared systems are input, not findings)
- [x] Bounded walk (file cap, ignore `node_modules`, `.git`, build output, venvs)

### Mapping

- [x] Normalized nodes from inventory + declared systems
- [x] Deterministic `app → component` edges with declared access (`read_only` / `read_write` / `unknown`)
- [x] Declared-but-undetected systems rendered as `(declared)` nodes
- [x] `integration-graph.json` + `integration-graph.mmd` (Mermaid) output

### Checks (all with evidence + recommendation)

- [x] External model policy undefined (fires only when an AI provider is actually detected)
- [x] PII policy undefined (critical)
- [x] Human approval boundary undefined (including declared-but-empty list)
- [x] Observability not detected (repo scan + declared systems both consulted)
- [x] Evaluation not declared
- [x] Retry/fallback/timeout policy absent (lists exactly which are missing)
- [x] Category scores + overall readiness score

### Report

- [x] Markdown report: engagement summary, detected environment, readiness table, critical findings, warnings, open questions, map location, next actions

### Quality gate

- [x] Unit tests for checks (finding IDs, severities, evidence presence)
- [x] Scanner tests on a temp fixture (evidence paths, exclusion rules)
- [x] End-to-end test: `init → scan → map → check → report` on a temp directory
- [x] CI runs build + tests (pnpm)

### Remaining V0.1 polish (release blockers for `0.1.0`)

- [ ] README quickstart GIF / screenshot (placeholders exist)
- [x] `CHANGELOG.md` with `0.1.0` entry
- [x] Verify `pnpm build && node dist/cli.js` works as an installed binary (`fde` bin path, shebang, `files` field in `package.json`) — verified via `npm pack` + install into a clean directory: `fde --version/init/scan/map/check` all work
- [ ] Publish `0.1.0` to npm (`npx openfde` / `pnpm dlx openfde` works on a clean machine)
- [ ] Show HN / launch draft reviewed against actual output

**Exit criterion:** a stranger can run `npx openfde init && npx openfde scan .` on their repo and get the documented experience without cloning this repo.

---

## Stage 1 — v0.2: Policy-aware Preflight

> Goal: `fde.yaml` becomes a validated, richer contract, and `fde check` becomes usable as a CI gate.

### 1.1 Schema validation

- [x] Wire [`schemas/fde.schema.json`](../schemas/fde.schema.json) into the loader (validate on every `check`/`map`/`report`)
- [x] `fde validate` command (or `fde check --schema-only`) with line-level error messages
- [x] Keep schema and `docs/FDE_SCHEMA.md` in sync; add schema version handling (`apiVersion`)
- [x] Tests: valid/invalid fixture files, unknown-field warnings

### 1.2 Richer constraints

- [x] Data residency check: declared `allowedRegions` vs regions found in Terraform/K8s config
- [x] Secrets hygiene check: `.env` committed, obvious credential patterns in tracked files (report file + line, never print the secret value)
- [x] Write-boundary check: declared `access: read_only` systems vs write-implying code signals
- [x] Success metrics declared check (at least one measurable metric)

### 1.3 Check packs

- [x] Internal check registry: each check = `{ id, category, appliesTo, run(context) }` (keeps plugin boundary clean per `PLUGIN_MODEL.md`, still no dynamic loading)
- [x] `fde check --only <ids>` / `--skip <ids>`
- [x] Severity overrides in `fde.yaml` (e.g. downgrade a check the customer has accepted, with a required `reason` field)
- [x] Tests: registry selection, overrides require reasons

### 1.4 CI integration

- [x] `fde check --format json` (stable machine-readable output)
- [x] `fde check --format sarif` (GitHub code scanning upload)
- [x] Exit code policy: `--fail-on critical|warning|never` (default `critical`)
- [ ] Reusable GitHub Action (`openfde/action` or `action.yml` in this repo) that runs scan + check and comments/uploads SARIF — `action.yml` implemented (composite: build → scan → check → SARIF upload → enforce exit code); still needs one live GitHub run to verify before checking off
- [x] Docs: "OpenFDE in CI" guide (`docs/CI.md`)

### 1.5 Plugin contract (design only)

- [x] Write `docs/PLUGIN_CONTRACT.md`: manifest shape, capability declarations (files/network/exec/credentials), lifecycle
- [x] Refactor built-in scanners/checks to consume the same internal interfaces the contract will expose (`src/checks/registry.ts`, `src/scanners/contributions.ts`)
- [x] No dynamic loader yet (explicit non-goal until v0.3+)

**Exit criterion:** a team can add OpenFDE to CI, fail the build on critical findings, and see results in GitHub code scanning — still with zero network calls from OpenFDE itself.

---

## Stage 2 — v0.3: Agent Deployment Validation

> Goal: OpenFDE understands AI-agent-shaped systems: what tools they hold, what they may touch, and how they are evaluated.

### 2.1 Tool / permission graph

- [ ] Extend `fde.yaml`: agent declarations (tools, per-tool access, side-effecting flags)
- [ ] Enrich integration graph with `agent → tool → system` edges, including `containsPii` where declared
- [ ] Check: side-effecting tool without a matching `humanApproval.requiredFor` entry (critical)
- [ ] Check: agent granted broader access than the declared system boundary (e.g. tool writes to a `read_only` system)

### 2.2 Eval declarations

- [ ] `fde.yaml` eval schema: suite name, type (regression / task-success), location, required-before-deploy flag
- [ ] `fde check` verifies declared eval artifacts exist on disk (existence + freshness, not execution — eval *execution* stays out of scope per `MVP_PLAN.md`)
- [ ] `.fde/evals/` conventions documented

### 2.3 Contract tests

- [ ] Define agent contract-test format (declared integration ↔ expected request/response shape)
- [ ] `fde test --contracts` runs local, deterministic contract fixtures (no live credentials)

### 2.4 Agent context export + MCP

- [ ] `fde export context` → single Markdown/JSON bundle for Claude Code / Cursor / Codex (engagement, inventory, graph, findings)
- [ ] MCP server exposing read-only tools: `get_engagement`, `get_environment`, `get_integrations`, `get_constraints`, `run_preflight`
- [ ] MCP server is opt-in, local (stdio), read-only; no tool may mutate the workspace

**Exit criterion:** for a repo with a declared agent, OpenFDE can show what the agent may touch, flag unapproved side effects, and hand a coding agent the full engagement context via one export or MCP.

---

## Stage 3 — v0.4: Production Evidence

> Goal: close the loop after deployment — import what actually happened and attach it to the engagement as evidence.

- [ ] OpenTelemetry trace import (file-based OTLP JSON first; no live collectors required)
- [ ] Evidence packs: `fde evidence add <file>` with automatic secret/token redaction, stored under `.fde/evidence/`
- [ ] Incident import: normalize a minimal incident record (`.fde/incidents/`), link to graph nodes
- [ ] Deterministic replay primitives: re-run a recorded trace against contract fixtures (no production calls)
- [ ] `fde status`: deployment health summary from imported evidence (declared vs observed)
- [ ] Redaction rules test suite (never persist raw credentials — verify with fixtures containing planted fake secrets)

**Exit criterion:** an FDE can attach real production evidence (traces, incidents) to the workspace and show a customer "declared vs observed" without OpenFDE ever contacting production itself.

---

## Stage 4 — v0.5: Handoff

> Goal: an engagement can be handed to another engineer or the customer without losing context.

- [ ] `fde decision add` — lightweight ADR flow into `.fde/architecture/decisions/`
- [ ] Known-failure-modes registry (`.fde/learnings/`), linked from findings/incidents
- [ ] `fde handoff` — generates the handoff package: ownership, unresolved risks, open questions, runbook index
- [ ] Runbook generator: skeleton runbooks from graph + checks (deploy, rollback, incident triage)
- [ ] Machine-readable handoff manifest (`handoff.json`) + human Markdown pair

**Exit criterion:** a second engineer can pick up an engagement from `.fde/` alone and know the architecture decisions, risks, and operational procedures.

---

## Stage 5 — v1.0: Forward Deployment Harness

> Goal: the six pillars (Discover, Model, Govern, Validate, Operate, Compound) are all served by stable commands, and the ecosystem can grow without core changes.

- [ ] Dynamic plugin loader implementing the v0.2 contract (capability prompts before first run)
- [ ] Recipe format + `fde recipe use <name>` (architecture, policies, evals, contracts, runbooks as a reusable unit)
- [ ] `fde extract` — turn a finished engagement into a sanitized recipe (redaction enforced)
- [ ] Schema `v1` freeze with documented migration from `v1alpha1`
- [ ] Community surfaces: contribution guides for scanners, check packs, recipes, integration fixtures
- [ ] 1.0 release: semver policy, deprecation policy, security disclosure process

**Exit criterion:** knowledge from engagement #1 measurably accelerates engagement #10 via recipes and plugins, with no customer data leaking between them.

---

## Cross-cutting workstreams (every stage)

### Testing & quality

- [x] Unit + e2e test baseline (`pnpm test`, node:test + tsx)
- [ ] Fixture repositories per scanner family (false-positive regression suite)
- [ ] Golden-file tests for report/Mermaid/JSON outputs
- [ ] Windows path handling audit (walker and evidence paths currently assume POSIX-style separators in places)

### Security (see `SECURITY.md`)

- [x] No telemetry, no network calls, local-first (verified: zero network code in `src/`)
- [ ] Threat-model doc for the plugin loader before it ships
- [ ] Redaction utilities shared by evidence/handoff/extract features

### Docs & community

- [x] Design docs (architecture, schema, plugin model, roadmap, MVP plan)
- [ ] Per-command reference docs (`docs/commands/`)
- [ ] "Writing a scanner" contributor tutorial
- [ ] Example gallery: at least 3 example repos beyond `customer-support` (python-ml, k8s-heavy, agent-with-tools)

---

## Suggested execution order (next 3 milestones)

1. **Ship `0.1.0`** — finish the "Remaining V0.1 polish" checklist. Everything else is blocked on real-user feedback this release generates.
2. **Stage 1.1 + 1.4 first** (schema validation + JSON output + exit codes): smallest slice that makes OpenFDE adoptable in CI, which drives the early-validation metrics in `PROJECT_PLAN.md`.
3. **Stage 1.2 checks** next, prioritized by scanner false-positive feedback from real repos.
