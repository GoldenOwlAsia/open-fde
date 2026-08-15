# Example: agent-with-tools

An LLM support agent holding database tools — the deployment shape OpenFDE
cares most about.

```bash
fde scan examples/agent-with-tools
fde check examples/agent-with-tools
```

What OpenFDE shows here:

- **Scan** detects Node.js, Anthropic, and PostgreSQL, plus a **write signal**
  (the `INSERT INTO resolutions` in `src/agent.ts`).
- **Check** fires the critical **`write-boundary-violation`**: `customer_db`
  is declared `read_only`, but the agent code writes to it. Evidence points at
  the exact line.
- **Check** also warns that `humanApproval.requiredFor` is declared but
  **empty** — a side-effecting agent with no approval boundary is a decision
  someone should make on purpose.
