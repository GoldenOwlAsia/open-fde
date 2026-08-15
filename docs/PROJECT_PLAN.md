# OpenFDE Project Plan

## Product thesis

Forward Deployed Engineering is increasingly a distinct delivery discipline, but engineers still assemble discovery, architecture context, deployment constraints, eval readiness, evidence, and handoff processes manually. OpenFDE aims to define a small executable layer around that lifecycle.

## Primary user

Senior Forward Deployed Engineer / AI Engineer entering an enterprise customer environment.

## Secondary users

- Solutions/implementation engineers
- Platform engineers
- Technical founders
- CTOs reviewing deployment readiness
- Security/architecture reviewers

## First pain to solve

"I just entered an unfamiliar repository/customer environment. What is here, what is missing for production, and what should I clarify before I deploy?"

## V0.1 promise

In under five minutes:

1. initialize engagement metadata;
2. scan repository signals;
3. build a normalized environment inventory;
4. generate an initial system map;
5. run explainable deployment-readiness checks;
6. create a report that can be reviewed with the customer.

## Product moat direction

The long-term moat is not an LLM. It is the combination of:

```text
FDE schema
+ integration graph
+ policy/check ecosystem
+ reusable recipes
+ handoff/evidence format
+ community adapters
```

## Metrics for early validation

- time to first useful report;
- number of repositories scanned;
- scanner false-positive rate;
- number of community checks/adapters;
- repeat usage across multiple customer engagements;
- issues asking for support of real enterprise systems.
