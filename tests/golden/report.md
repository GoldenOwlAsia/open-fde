# OpenFDE Deployment Report

Generated: <TIMESTAMP>

## Engagement

- **Engagement:** golden-fixture
- **Customer:** acme
- **Objective:** Golden-file fixture engagement
- **Cloud:** aws

## Readiness

**Overall: 81/100**

| Area | Score |
|---|---:|
| security | 65 |
| data | 65 |
| reliability | 85 |
| evaluation | 85 |
| observability | 85 |
| human control | 100 |

## Detected Environment

- **Node.js** — runtime (medium confidence; evidence: package.json)
- **Terraform** — infrastructure (medium confidence; evidence: main.tf)
- **PostgreSQL** — data (medium confidence; evidence: package.json)
- **AWS** — cloud (medium confidence; evidence: main.tf)
- **OpenAI** — ai (medium confidence; evidence: package.json)

## Critical Findings

### Infrastructure config references regions outside the declared residency boundary

spec.constraints.dataResidency.allowedRegions declares ap-southeast-1, but the repository configures: us-east-1.

**Evidence:**
- main.tf:2: region us-east-1

**Recommendation:** Move the workload into an allowed region, or update spec.constraints.dataResidency.allowedRegions after confirming the boundary with the customer.

### Declared read_only system "primary_db" has write-implying code signals

fde.yaml declares system "primary_db" (type postgres) as read_only, but the repository contains code that appears to write to a postgres system. Each signal is a named heuristic, not proof — verify before deploying.

**Evidence:**
- src/db.ts:1 — SQL INSERT/UPDATE/DELETE

**Recommendation:** Either remove the write path, or change the declared access to read_write after confirming the boundary with the customer.


## Warnings

### No observability signal detected

No Sentry or OpenTelemetry reference was found in the scanned repository, and no observability system is declared in the engagement.

**Evidence:**
- Scanned <ROOT> without an observability match
- fde.yaml: no spec.systems entry of an observability type

**Recommendation:** Add tracing/error monitoring, or declare the customer's observability system in fde.yaml.

### Evaluation is not declared

No evaluation requirement is declared for the engagement (spec.evaluation).

**Evidence:**
- fde.yaml: spec.evaluation is not set

**Recommendation:** Define at least one task-success or regression evaluation before production.

### Reliability controls are not declared

The engagement does not declare: timeout, retry, fallback (spec.reliability).

**Evidence:**
- fde.yaml: spec.reliability.timeout is not set
- fde.yaml: spec.reliability.retry is not set
- fde.yaml: spec.reliability.fallback is not set

**Recommendation:** Declare timeout, retry, and fallback expectations for external dependencies and model calls.


## Open Questions

- How will errors and traces be observed in the customer environment?
- What evaluation must pass before this system reaches production?
- What timeout, retry, and fallback behavior is expected for external calls?
- Which regions may customer data and workloads run in?
- Which systems may the deployment write to, and who approves widening that boundary?

## Architecture Map

- `.fde/environment/integration-graph.json`
- `.fde/environment/integration-graph.mmd`

## Suggested Next Actions

1. Resolve critical findings before production deployment.
2. Review the generated integration map with the customer technical owner.
3. Convert missing constraints into explicit entries in `fde.yaml`.
4. Add evidence for evaluation and observability before handoff.
