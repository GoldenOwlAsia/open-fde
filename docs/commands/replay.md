# `fde replay`

```bash
fde replay <trace> [root]
```

Re-runs a recorded, imported trace against the contract fixtures — the
deterministic replay primitive. **No production calls**: this compares what
was recorded with what the contracts say the integrations should look like.

For every contract case:

- **verified** — spans matching the case's `request.operation` exist and
  their attributes cover all `requiredFields` (either as bare keys or
  `response.<field>`).
- **shape-mismatch** — matching spans exist but required fields are missing
  from all of them. This fails the run (exit 1): production traffic no longer
  matches the declared contract.
- **not-exercised** — no span in this trace hit the operation.

Spans with `status: error` are listed alongside.

```text
Replaying prod-trace.json (2 spans) against 1 contract file(s)

  ✓ customers.yaml › lookup by email (customers.lookup) — 1 span(s)
  · customers.yaml › merge accounts (customers.merge) — no matching span in this trace

1 span(s) recorded errors:
  - payments.refund (support-agent)

1 verified, 0 shape mismatch(es), 1 not exercised
```

Prerequisites: `fde import trace` (the recorded trace) and at least one
contract fixture in `.fde/contracts/`.
