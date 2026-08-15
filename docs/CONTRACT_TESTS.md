# Contract Tests

Contract fixtures pin the **shape** of a declared integration — which
operation an agent calls and which response fields the deployment depends on —
as local, deterministic files. No live credentials, no network calls: they are
the executable record of "what we agreed this system looks like", checkable in
CI and reviewable by the customer.

They catch the failure mode where an integration changes shape (a field
renamed, an operation split) and nobody updates the engagement's assumptions.

## Format

One YAML file per integration under `.fde/contracts/`:

```yaml
# .fde/contracts/customer-lookup.yaml
system: customer_db          # must reference a spec.systems[].id in fde.yaml
description: Customer lookup used by the support agent
cases:
  - name: lookup by email
    request:
      operation: customers.lookup
      params:
        email: user@example.com     # representative fixture values, never real PII
    response:
      example:                       # a sanitized, representative response
        id: "123"
        name: Ada
        plan: pro
      requiredFields: [id, name, plan]   # the fields the deployment relies on
```

Rules:

- `system` must be declared in `fde.yaml` — a contract against an undeclared
  system fails (the boundary must exist before the shape can be pinned).
- Every case needs a `name`, a `request.operation`, and a `response.example`
  containing every `requiredFields` entry. An empty `requiredFields` fails:
  a contract that asserts nothing is not a contract.
- Fixture values must be sanitized. These files are committed evidence.

## Running

```bash
fde test --contracts
```

```text
Running 1 contract file(s) from .fde/contracts/

  ✓ customer-lookup.yaml › lookup by email

1 passed, 0 failed
```

Failures list the exact file, case, and missing field, and the command exits 1
(CI-friendly). No fixtures is a clean no-op.

## Scope (v0.3)

The runner validates fixtures against the engagement and their own declared
shape. Replaying recorded traffic against these contracts is Stage 3 (v0.4)
territory — see `docs/IMPLEMENTATION_PLAN.md`.
