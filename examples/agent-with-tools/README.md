# Example: agent-with-tools

An LLM support agent holding database tools — the deployment shape OpenFDE
cares most about. The engagement declares the agent, its tools, and their
per-tool access (`spec.agents`).

```bash
fde scan examples/agent-with-tools
fde map examples/agent-with-tools     # agent → tool → system edges
fde check examples/agent-with-tools
```

What OpenFDE shows here:

- **Scan** detects Node.js, Anthropic, and PostgreSQL, plus a **write signal**
  (the `INSERT INTO resolutions` in `src/agent.ts`).
- **Map** renders `support_agent → lookup_customer → customer_db` with
  `read_only` access and `containsPii: true` on the edge.
- **Check** fires three criticals:
  - **`write-boundary-violation`** — `customer_db` is declared `read_only`,
    but the agent code writes to it (`src/agent.ts:15`).
  - **`agent-access-exceeds-boundary`** — tool `record_resolution` declares
    `access: read_write` against the `read_only` system.
  - **`agent-side-effect-unapproved`** — tool `issue_refund` is
    side-effecting but `humanApproval.requiredFor` is empty.
- **Check** also warns that tool `issue_refund` points at `payments`, a system
  never declared under `spec.systems`, and that the approval boundary is empty.
- The declared eval suite (`evals/ticket-regression`) **exists on disk**, so
  no eval finding fires — delete the directory to see
  `eval-artifact-missing` turn critical.
