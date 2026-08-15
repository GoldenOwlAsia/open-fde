# `fde map`

```bash
fde map [root]
```

Builds the integration graph from the scan inventory plus the systems declared
in `fde.yaml`. Requires `fde scan` to have run.

## Output

- `.fde/environment/integration-graph.json` — machine-readable nodes + edges
- `.fde/environment/integration-graph.mmd` — the same graph as Mermaid, ready
  to paste into any Mermaid renderer or a GitHub comment

## Semantics

- Detected components in integration categories (data, cloud, ai,
  observability, auth) get `app → component` edges labeled `uses`.
- Access levels declared in `fde.yaml` (`read_only` / `read_write`) are
  attached to matching edges; everything else is `unknown`.
- Systems declared in `fde.yaml` but **not** detected in the repository still
  appear, labeled `(declared)` — the map shows the whole engagement, not just
  what the scanner found.

## Example edge

```json
{ "from": "app", "to": "postgres", "relationship": "uses", "access": "read_only" }
```
