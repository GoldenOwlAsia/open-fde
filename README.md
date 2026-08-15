# OpenFDE

> **Local-first environment discovery and deployment preflight for Forward Deployed Engineers.**

OpenFDE is an open-source delivery harness for engineers who enter unfamiliar customer environments, map what is really there, validate deployment constraints, and leave behind reusable operational knowledge instead of another one-off implementation.

The long-term goal is simple:

> Make Forward Deployed Engineering repeatable, inspectable, and portable across customer engagements.

OpenFDE is **not** another AI agent framework, LLM gateway, observability backend, or project-management product. It is the lifecycle layer that sits around the tools you already use.

---

## Why OpenFDE?

Forward Deployed Engineers repeatedly face the same class of problems:

- Every customer has a different cloud, auth model, network layout, data boundary, and deployment process.
- Important constraints live in Slack threads, architecture calls, spreadsheets, and people's heads.
- AI prototypes often reach production without a consistent preflight for data, permissions, evals, reliability, or human approval.
- The same Salesforce/Slack/Postgres/S3 integration patterns are rebuilt from scratch.
- Handoffs lose the context behind architecture decisions and known failure modes.
- Knowledge from customer #1 rarely compounds into faster delivery for customer #10.

OpenFDE turns that repeated work into an executable workspace.

```text
Customer Problem
      ↓
Discovery
      ↓
Environment
      ↓
Architecture
      ↓
Build
      ↓
Eval
      ↓
Deploy
      ↓
Operate
      ↓
Handoff
      ↓
Reusable Knowledge
```

---

# V0.1: the useful wedge

The first release deliberately focuses on five commands:

```bash
fde init
fde scan
fde map
fde check
fde report
```

The goal is to make OpenFDE useful within five minutes of cloning an unfamiliar repository.

### Example

```bash
git clone git@github.com:customer/support-platform.git
cd support-platform

fde init
fde scan
fde map
fde check
fde report
```

Runnable examples live in [`examples/`](examples/): a customer-support app, a
Python ML pipeline, a Kubernetes/Terraform deployment with a residency
violation, and an LLM agent whose tools cross a declared write boundary.

Expected output:

```text
OpenFDE Scan

Detected 14 components

Runtime
  ✓ Node.js
  ✓ Python

Infrastructure
  ✓ Docker
  ✓ Terraform
  ✓ Kubernetes manifests

Data
  ✓ PostgreSQL
  ✓ Redis
  ✓ S3 references

AI
  ✓ OpenAI SDK

Observability
  ✓ Sentry
  ✓ OpenTelemetry

CI/CD
  ✓ GitHub Actions
```

Then:

```text
OpenFDE Deployment Readiness

Security       72
Data           61
Reliability    84
Evaluation     42
Observability  91
Human Control  55

Overall        68 / 100

CRITICAL
- Production database write boundary is not declared.
- AI policy allows external model access but PII handling is undefined.

WARNING
- No regression evaluation suite declared.
- No model fallback policy detected.
- Human approval boundary is missing for a side-effecting workflow.
```

---

# Core primitive: the FDE Engagement

OpenFDE treats an **engagement** as the primary unit of work.

Terraform models infrastructure state. Kubernetes models workload state. OpenFDE models the state and constraints of a customer deployment engagement.

A repository can declare an engagement using `fde.yaml`:

```yaml
apiVersion: openfde.dev/v1alpha1
kind: Engagement
metadata:
  name: acme-ai-support

spec:
  customer:
    name: acme

  objective:
    summary: Automate first-line support resolution

  successMetrics:
    - name: resolution_rate
      target: ">= 0.70"
    - name: p95_response_time
      target: "< 30s"

  environment:
    cloud: aws
    regions:
      - ap-southeast-1

  systems:
    - id: crm
      type: salesforce
      access: read_write
    - id: primary_db
      type: postgres
      access: read_only
    - id: collaboration
      type: slack
      access: read_write

  constraints:
    dataResidency:
      allowedRegions:
        - ap-southeast-1
    pii:
      allowExternalModel: false
    humanApproval:
      requiredFor:
        - refund.execute
        - customer.delete
```

The schema is intentionally designed to be:

- machine-readable;
- source-controlled;
- local-first;
- vendor-neutral;
- extensible by plugins;
- understandable by humans and coding agents.

See [`schemas/fde.schema.json`](schemas/fde.schema.json) and [`docs/FDE_SCHEMA.md`](docs/FDE_SCHEMA.md).

---

# Workspace layout

OpenFDE stores engagement artifacts in `.fde/`.

```text
.fde/
├── engagement.yaml
├── environment/
│   ├── inventory.json
│   ├── integration-graph.json
│   └── integration-graph.mmd
├── architecture/
│   └── decisions/
├── policies/
├── evals/
├── deployments/
├── traces/
├── incidents/
├── evidence/
├── runbooks/
├── handoff/
└── learnings/
```

V0.1 only uses a subset of this structure. The rest documents the direction of the project without forcing a large platform into the first release.

---

# Command overview

## `fde init`

Creates the engagement workspace and a starter `fde.yaml`.

```bash
fde init
```

Creates:

```text
fde.yaml
.fde/
└── environment/
```

The first version keeps prompts minimal and safe for source control.

---

## `fde scan`

Discovers technical signals from the local repository.

```bash
fde scan
```

Initial scanners look for:

- languages and runtimes;
- package managers;
- Docker;
- Kubernetes manifests;
- Terraform;
- GitHub Actions;
- common databases;
- common queues/caches;
- cloud SDK references;
- AI providers;
- observability tooling;
- auth/SSO signals.

Output:

```text
.fde/environment/inventory.json
```

### Local-first by default

`fde scan` must never upload source code, `.env` files, secrets, customer data, or inventory output unless a future integration is explicitly configured by the user.

---

## `fde map`

Turns discovered components into a machine-readable integration graph plus Mermaid output.

```bash
fde map
```

Outputs:

```text
.fde/environment/integration-graph.json
.fde/environment/integration-graph.mmd
```

Example edge:

```json
{
  "from": "ai-agent",
  "to": "primary-db",
  "relationship": "queries",
  "access": "read_only",
  "data": ["customer_profile"],
  "containsPii": true
}
```

The graph becomes a common substrate for later policy checks, risk analysis, incident replay, agent permissions, and deployment evidence.

---

## `fde check`

Runs deployment-readiness checks against repository discovery plus the declared engagement.

```bash
fde check
```

Initial check groups:

1. **Security** — secrets handling, privileged access declarations, dangerous write boundaries.
2. **Data** — PII handling, residency, external model policy.
3. **Reliability** — timeout/retry/fallback declarations.
4. **Evaluation** — regression/eval artifacts.
5. **Observability** — tracing/error monitoring signals.
6. **Human Control** — declared approval boundaries for side-effecting actions.

Checks should always explain **why** something was flagged and which evidence produced the result.

OpenFDE should prefer explainable checks over opaque AI scores.

For CI use, `fde check` supports machine-readable output and an exit-code policy:

```bash
fde check --format json|sarif      # stable JSON, or SARIF for GitHub code scanning
fde check --fail-on critical       # critical (default) | warning | never
fde check --only <ids> / --skip <ids>
```

See [`docs/CI.md`](docs/CI.md) and the reusable GitHub Action ([`action.yml`](action.yml)).

---

## `fde validate`

Validates `fde.yaml` against the engagement schema with `fde.yaml:line:col`
error positions. Unknown fields warn; schema violations fail with exit code 1.
The same validation runs automatically inside `map`, `check`, and `report`.

```bash
fde validate
```

---

## `fde report`

Generates a shareable Markdown report from the current workspace.

```bash
fde report
```

Output:

```text
.fde/report.md
```

The report includes:

- engagement summary;
- detected environment;
- deployment-readiness score;
- critical findings;
- warnings;
- open questions;
- architecture map location;
- suggested next actions.

This gives FDEs a concrete artifact they can review with a customer without requiring a hosted dashboard.

---

# Design principles

## 1. Local-first

A Forward Deployed Engineer may be working inside highly restricted customer environments. OpenFDE should provide useful value without requiring a cloud account.

## 2. Vendor-neutral

OpenFDE should work around Terraform, Kubernetes, Sentry, OpenTelemetry, LangSmith, cloud providers, coding agents, and internal tooling rather than attempting to replace them.

## 3. Executable over documentation-only

Markdown templates can support the workflow, but the core value should come from executable discovery, validation, tests, and evidence generation.

## 4. Human-readable + machine-readable

Every important artifact should be understandable in Git while remaining structured enough for automation.

## 5. Evidence over magic scoring

Every warning or score should map back to observable evidence, declared configuration, or a clearly named heuristic.

## 6. Safe defaults

No automatic secret upload. No arbitrary production writes. No hidden network calls. Destructive operations should require explicit opt-in.

## 7. Existing tools stay in place

OpenFDE should orchestrate existing tools rather than rebuild mature infrastructure.

---

# Architecture

```text
                     FDE ENGINEER
                          │
                          ▼
                  ┌───────────────┐
                  │  OpenFDE CLI  │
                  └───────┬───────┘
                          │
                          ▼
             ┌────────────────────────┐
             │       FDE CORE         │
             │                        │
             │ Engagement             │
             │ Environment            │
             │ Integration Graph      │
             │ Constraints            │
             │ Checks                 │
             │ Evidence               │
             └────────────┬───────────┘
                          │
                    .fde workspace
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
          Scanners      Plugins      Policies
             │            │            │
             └────────────┼────────────┘
                          ▼
                 Existing Tooling
          Terraform / K8s / OTel / Sentry
                          │
                          ▼
                 Customer Production
```

For the detailed component model, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

# Proposed long-term lifecycle

OpenFDE may eventually cover six pillars:

```text
01 DISCOVER   Customer environment
02 MODEL      Systems + relationships
03 GOVERN     Constraints + policies
04 VALIDATE   Tests + evals + preflight
05 OPERATE    Deploy + observe + replay
06 COMPOUND   Handoff + reusable recipes
```

Possible future commands:

```bash
fde decision add
fde test
fde eval
fde deploy
fde status
fde incident import
fde replay
fde evidence
fde handoff
fde extract
fde recipe use
```

These are roadmap directions, **not promises for V0.1**.

---

# What OpenFDE will not become

To keep the project sharp, OpenFDE does not aim to become:

- a generic project-management system;
- a CRM;
- a Slack/Jira replacement;
- a generic coding agent;
- another LLM gateway;
- another agent framework;
- another full observability backend;
- another Terraform/Kubernetes replacement;
- a cloud service required to use the open-source core.

---

# Plugin direction

OpenFDE should eventually support scanners and integration adapters for systems commonly encountered in enterprise deployments.

Potential plugin families:

```text
cloud/
  aws
  azure
  gcp

data/
  postgres
  snowflake
  bigquery
  s3

enterprise/
  salesforce
  hubspot
  slack
  jira
  sharepoint

ai/
  openai
  anthropic
  bedrock
  vertex-ai

observability/
  opentelemetry
  sentry
  datadog
```

A plugin should be able to contribute:

- discovery signals;
- normalized components;
- optional graph edges;
- checks;
- documentation links;
- redaction rules.

See [`docs/PLUGIN_MODEL.md`](docs/PLUGIN_MODEL.md).

---

# Reusable recipes

The long-term compounding layer is a recipe ecosystem.

Example recipes:

```text
recipes/
├── aws-bedrock-private-agent/
├── salesforce-support-agent/
├── sharepoint-rag/
├── human-approval-workflow/
├── fintech-kyc-agent/
└── pii-safe-agent/
```

A recipe might contain:

```text
architecture
policies
evals
integration contracts
Terraform/Helm examples
runbooks
known failure modes
```

The goal is for knowledge from one engagement to become reusable engineering IP without exposing customer-specific data.

---

# Agent compatibility

OpenFDE should not force a proprietary coding agent.

The `.fde/` workspace can be consumed by:

- Claude Code;
- Codex;
- Cursor;
- Cline-derived agents;
- Gemini CLI;
- internal coding agents;
- future MCP clients.

Two commands serve this directly:

```bash
fde export context   # one Markdown + JSON bundle to paste into any agent
fde mcp              # read-only MCP server (stdio, opt-in)
```

The MCP server exposes `get_engagement`, `get_environment`,
`get_integrations`, `get_constraints`, and `run_preflight` — all read-only;
no tool can mutate the workspace. Later releases may add `get_decisions`,
`get_incidents`, and `get_handoff`.

---

# Repository structure

```text
openfde/
├── src/
│   ├── cli.ts
│   ├── commands/
│   │   ├── init.ts
│   │   ├── scan.ts
│   │   ├── map.ts
│   │   ├── check.ts
│   │   └── report.ts
│   ├── core/
│   ├── scanners/
│   ├── checks/
│   └── report/
│
├── schemas/
│   └── fde.schema.json
│
├── examples/
│   └── customer-support/
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── FDE_SCHEMA.md
│   ├── MVP_PLAN.md
│   ├── PLUGIN_MODEL.md
│   ├── ROADMAP.md
│   └── SECURITY.md
│
├── .github/
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

---

# Development

Requirements:

- Node.js 20+
- npm 10+

Install:

```bash
npm install
```

Run locally:

```bash
npm run dev -- init
npm run dev -- scan .
npm run dev -- map
npm run dev -- check
npm run dev -- report
```

Build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

---

# 7-day MVP target

### Day 1 — CLI + workspace

- CLI command routing
- `.fde/` workspace
- `fde init`
- engagement schema

### Day 2 — repository scanner

- Node/Python signals
- Docker
- Terraform
- Kubernetes
- GitHub Actions

### Day 3 — integration detection

- PostgreSQL
- Redis
- AWS
- OpenAI
- Sentry/OpenTelemetry

### Day 4 — graph

- normalized components
- integration graph JSON
- Mermaid export

### Day 5 — preflight

- first explainable checks
- severity model
- readiness score

### Day 6 — report

- Markdown report
- sample project
- improve terminal output

### Day 7 — OSS polish

- README GIF/screenshot placeholders
- tests
- CI
- release package
- Show HN launch draft

See [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md).

---

# Roadmap

## v0.1 — Environment Doctor

```text
init → scan → map → check → report
```

## v0.2 — Policy-aware preflight

- richer `fde.yaml` constraints;
- policy packs;
- CI/GitHub Action;
- plugin discovery.

## v0.3 — Agent deployment validation

- agent permission graph;
- contract tests;
- eval declarations;
- MCP server;
- coding-agent context export.

## v0.4 — Production evidence

- OpenTelemetry ingestion;
- deployment evidence packs;
- incident import and replay;
- operational status views.

## v1.0 — Delivery Harness

```text
Discover
→ Model
→ Govern
→ Validate
→ Operate
→ Handoff
→ Compound
```

See [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

# Security model

OpenFDE is expected to operate around customer source code and infrastructure metadata, so security is a first-class design constraint.

Baseline rules:

- no telemetry by default;
- no cloud account required;
- no source-code upload by default;
- never print raw secrets;
- avoid reading secret values unless a scanner explicitly requires it;
- redact tokens/credentials from generated evidence;
- destructive integrations disabled by default;
- scanning should be deterministic where possible;
- AI-assisted analysis must be explicit and configurable.

See [`docs/SECURITY.md`](docs/SECURITY.md).

---

# Contribution opportunities

OpenFDE is intentionally designed around contribution-friendly surfaces:

- scanners;
- integration adapters;
- policy packs;
- checks;
- schemas;
- example customer environments;
- recipes;
- output renderers.

If you regularly enter new enterprise environments and keep rebuilding the same checklist or glue script, that workflow is probably a good OpenFDE contribution candidate.

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

# Possible launch positioning

### Show HN

> Show HN: OpenFDE – a local-first preflight checker for forward-deployed AI systems

### Alternative

> We kept rebuilding the same customer-environment checklist, so we made it executable

### Alternative

> Open source: scan an enterprise AI deployment for missing evals, unsafe permissions and data-boundary risks

---

# North Star

> An FDE should be able to enter an unfamiliar customer environment and understand, validate, deploy, and hand over a production system without rebuilding the delivery process from scratch.

If OpenFDE cannot produce something useful within the first five minutes, the project is becoming too heavy.

---

# Status

**Early design / V0.1 starter.**

The repository currently contains the initial CLI skeleton, schema, example engagement, and design documents needed to begin implementation.

Contributions and critical feedback on the primitive, schema, and V0.1 scope are welcome.
