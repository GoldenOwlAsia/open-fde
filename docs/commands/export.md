# `fde export`

```bash
fde export context [root]
```

Bundles the full engagement context into two files for handing to a coding
agent (Claude Code, Cursor, Codex, or any MCP-less tool):

- `.fde/context.md` — one Markdown document: the raw `fde.yaml`, detected
  environment with evidence, the integration graph as inline Mermaid,
  preflight findings, and standing rules for agents working in the repo.
- `.fde/context.json` — the same data programmatically:
  `{ engagement, engagementYaml, inventory, graph, checkResult }`.

The export runs the preflight fresh and uses the existing scan artifact if
present (falling back to an in-memory scan). Nothing is uploaded anywhere —
you decide what to paste where.

For live access instead of a snapshot, see [`mcp`](mcp.md).
