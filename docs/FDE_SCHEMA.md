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
  successMetrics: []
  environment: {}
  systems: []
  constraints: {}
  reliability: {}
  evaluation: {}
```

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
