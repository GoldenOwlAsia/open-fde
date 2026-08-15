# `fde mcp`

```bash
fde mcp [root]
```

Serves the engagement over the Model Context Protocol — stdio transport,
**read-only**, opt-in (it runs only while you run it). No tool can mutate the
workspace or the repository; `run_preflight` computes everything in memory and
writes nothing.

## Tools

| Tool | Returns |
|---|---|
| `get_engagement` | Parsed `fde.yaml` plus the raw text |
| `get_environment` | The scan inventory (existing artifact, or an in-memory scan) |
| `get_integrations` | The integration graph incl. agent → tool → system edges |
| `get_constraints` | Residency, PII, human-approval constraints and agent declarations |
| `run_preflight` | Fresh check result: scores + findings with evidence |

## Wiring it up

Claude Code:

```bash
claude mcp add openfde -- fde mcp /path/to/engagement
```

Generic MCP client config:

```json
{
  "mcpServers": {
    "openfde": { "command": "fde", "args": ["mcp", "/path/to/engagement"] }
  }
}
```

The server speaks JSON-RPC 2.0 (newline-delimited) on stdio and implements
`initialize`, `ping`, `tools/list`, and `tools/call`.
