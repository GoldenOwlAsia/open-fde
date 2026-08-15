# `fde init`

```bash
fde init [root]
```

Creates the OpenFDE workspace and a starter engagement declaration:

- `.fde/` with its standard subdirectories (`environment/`,
  `architecture/decisions/`, `policies/`, `evals/`, `evidence/`, `handoff/`,
  `learnings/`)
- `fde.yaml` — a starter engagement (`apiVersion: openfde.dev/v1alpha1`) with
  a declared PII policy and empty systems/constraints to fill in

Existing files are never overwritten: if `fde.yaml` is already present it is
preserved unchanged.

`root` defaults to the current directory.

## Output

```text
Created /path/to/repo/fde.yaml
Initialized OpenFDE workspace at /path/to/repo
```

## See also

- [`validate`](validate.md) — check the file you filled in against the schema
- [`docs/FDE_SCHEMA.md`](../FDE_SCHEMA.md) — every field explained
