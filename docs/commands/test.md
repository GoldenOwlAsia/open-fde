# `fde test`

```bash
fde test --contracts [root]
```

Runs local, deterministic engagement tests. In this version the only test
type is **contract fixtures**: files under `.fde/contracts/` that pin the
request/response shape of a declared integration. No live credentials, no
network calls.

```text
Running 1 contract file(s) from .fde/contracts/

  ✓ customer-lookup.yaml › lookup by email

1 passed, 0 failed
```

- Every contract must target a system declared in `fde.yaml`.
- Every case must assert at least one required response field.
- Failures print file › case › missing field and exit 1 (CI-friendly).
- No fixtures is a clean no-op (exit 0).

Format details and rules: [`docs/CONTRACT_TESTS.md`](../CONTRACT_TESTS.md).
