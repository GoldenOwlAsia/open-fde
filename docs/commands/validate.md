# `fde validate`

```bash
fde validate [root]
```

Validates `fde.yaml` against the engagement schema
([`schemas/fde.schema.json`](../../schemas/fde.schema.json)) and prints every
issue with its position:

```text
error   fde.yaml:1:13 apiVersion: unsupported apiVersion "openfde.dev/v2" — this build of OpenFDE supports "openfde.dev/v1alpha1"
error   fde.yaml:13:15 spec.systems[0].access: must be one of "read_only", "read_write", "unknown", got "write_everything"
warning fde.yaml:9:3 spec.observability: unknown field "observability" (not part of the openfde.dev/v1alpha1 schema)
```

- **Errors** (wrong types, missing required fields, invalid enum values,
  unsupported `apiVersion`, unknown top-level fields) exit with code 1.
- **Warnings** (unknown fields inside known objects) do not fail the command.

The same validation runs automatically inside `fde map`, `fde check`, and
`fde report`; those commands abort on schema errors and point here.
