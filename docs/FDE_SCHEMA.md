# `fde.yaml` Schema

## Purpose

`fde.yaml` is the human-readable declaration of a Forward Deployed Engineering engagement.

It answers questions that repository scanning cannot safely infer:

- What business outcome matters?
- Which customer is this for?
- What are the deployment boundaries?
- Can PII leave the customer region?
- Which actions require approval?
- What success metrics define a useful deployment?

## Design rules

1. Keep customer-specific secrets out of the file.
2. Prefer declarations that can be validated.
3. Allow unknown values rather than forcing false certainty.
4. Keep vendor-specific configuration behind namespaced extensions when possible.
5. Version the schema explicitly.

## Minimal example

```yaml
apiVersion: openfde.dev/v1alpha1
kind: Engagement
metadata:
  name: customer-support
spec:
  customer:
    name: acme
  objective:
    summary: Reduce first-line support handling time
```

## Recommended production fields

```yaml
spec:
  successMetrics: []          # [{ name, target }]
  environment: {}             # { cloud, regions: [] }
  systems: []                 # [{ id, type, access: read_only|read_write|unknown }]
  constraints:
    dataResidency:
      allowedRegions: []      # region ids, e.g. ap-southeast-1
    pii:
      allowExternalModel: false
    humanApproval:
      requiredFor: []         # side-effecting action ids, e.g. refund.execute
  ownership:
    owner: Phil               # who owns this engagement after handoff
    contacts: []              # [{ name, role, contact }]
  agents: []                  # see "Agent declarations" below
  reliability:
    timeout: 30s
    retry: exponential-backoff
    fallback: human-escalation
  evaluation:
    required: true
    suites: []                # see docs/EVALS.md
```

## Agent declarations

AI agents declare what tools they hold and what each tool may touch:

```yaml
spec:
  agents:
    - id: support_agent
      description: Answers tickets
      tools:
        - id: lookup_customer
          system: customer_db     # must reference a spec.systems[].id
          access: read_only       # read_only | read_write | unknown
          sideEffects: false
          containsPii: true
```

This feeds three things:

- `fde map` renders `agent → tool → system` edges with access and PII flags.
- `agent-side-effect-unapproved` (critical): a `sideEffects: true` tool whose
  id (or `agentId.toolId`) is not listed in `humanApproval.requiredFor`.
- `agent-access-exceeds-boundary` (critical): a tool writing to a system
  declared `read_only`; `agent-tool-system-undeclared` (warning): a tool
  pointing at a system with no `spec.systems` entry.

## Check severity overrides

When the customer has explicitly accepted a risk, a check's severity can be
overridden in `fde.yaml`. A `reason` is **required** — an override without one
fails the run:

```yaml
spec:
  checks:
    overrides:
      - id: observability-not-detected
        severity: info
        reason: Customer uses a homegrown metrics stack; accepted 2026-08-01
```

Overridden findings keep their evidence and gain a line recording the original
severity and the reason. Unknown check ids are rejected with the list of
available checks (`fde check --only`/`--skip` use the same ids).

## Validation

`fde validate` checks `fde.yaml` against
[`schemas/fde.schema.json`](../schemas/fde.schema.json) and reports errors with
`fde.yaml:line:col` positions. The same validation runs automatically inside
`fde map`, `fde check`, and `fde report`; schema errors abort the command.

- The current schema version is `apiVersion: openfde.dev/v1alpha1`. Any other
  value is an error naming the supported version.
- Unknown fields inside known objects (e.g. a typo under `spec`) produce
  **warnings**, not errors, so the file can carry forward-looking data.
- Unknown **top-level** fields are errors — the root of the document is closed.

## Future schema candidates

- stakeholders
- ownership
- data classifications
- network boundaries
- approvals
- model/provider policy
- rollout strategy
- evidence requirements
- handoff owner
- SLOs
- cost limits
