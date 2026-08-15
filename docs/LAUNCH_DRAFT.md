# Show HN launch draft

> Status: **draft for review**. Every output block below is real, captured
> from `examples/agent-with-tools` on 2026-08-15. Do not publish before
> `0.1.0` is on npm (`npx openfde` must work on a clean machine).

## Title

**Show HN: OpenFDE – a local-first preflight checker for AI systems entering production**

(72 chars max on HN; this is 77 — fallback: *Show HN: OpenFDE – local-first
preflight checks for AI deployments*)

## Body

We do forward-deployed engineering work: dropping into an unfamiliar customer
repo and getting an AI system safely into their production. Every engagement
started with the same checklist — what's actually in this repo, where may
data go, what can the agent write to, what has to pass before deploy — living
in Slack threads and heads. So we made the checklist executable.

OpenFDE is a CLI (`fde init/scan/map/check/report`) that:

- scans a repository for runtimes, infra, data stores, AI providers, auth and
  observability — every detection backed by file evidence, fully offline;
- reads `fde.yaml`, a small declared contract for the engagement: data
  residency, PII policy, per-system access, human-approval boundaries,
  success metrics;
- checks the two against each other and explains every finding.

The check we care most about, on the bundled example of an LLM support agent
whose database is declared read-only:

```text
CRITICAL
- Declared read_only system "customer_db" has write-implying code signals
    evidence: src/agent.ts:15 — SQL INSERT/UPDATE/DELETE

WARNING
- Human approval boundary is not declared
    evidence: fde.yaml: spec.constraints.humanApproval.requiredFor is empty
```

Other checks: region literals in Terraform/K8s vs the declared residency
boundary, committed secrets (file+line only, values never printed), missing
eval/reliability/observability declarations. `--format sarif` and
`--fail-on critical` make it a CI gate; findings land in GitHub code
scanning.

Design constraints we're committed to: no telemetry, no network calls, no
cloud account — deterministic checks with evidence over AI-generated scores.

It's early (v0.1). The thing we most want feedback on is the `fde.yaml`
engagement primitive: is a declared, checkable contract the right unit for
"AI system meets production"?

https://github.com/GoldenOwlAsia/open-fde

## Pre-publish checklist

- [ ] `0.1.0` published; `npx openfde scan .` works on a clean machine
- [ ] README quickstart GIF recorded
- [ ] Title within HN's 80-char limit at submit time
- [ ] Repo issues triaged / templates in place (already done)
