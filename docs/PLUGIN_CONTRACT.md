# Plugin Contract (design)

> Status: **design only**. There is no dynamic plugin loader yet, and building
> one is an explicit non-goal until v0.3+ (after a threat-model doc, see
> `SECURITY.md`). This document fixes the contract so built-in code and early
> plugin authors converge on the same shapes before loading exists.

The built-ins already implement this contract internally:

- Checks: [`src/checks/registry.ts`](../src/checks/registry.ts) —
  `Check { id, category, description, appliesTo(context), run(context) }`.
  `src/checks/defaultChecks.ts` and `src/checks/constraintChecks.ts` are
  plain arrays of these objects.
- Scanners: [`src/scanners/contributions.ts`](../src/scanners/contributions.ts) —
  `FileSignature` (detect from a path shape) and `ContentSignature` (detect
  from bounded file contents). `src/scanners/repo.ts` is the host that walks
  the repository and feeds both lists.

A plugin is those same arrays plus a manifest.

## Manifest

Every plugin ships a `plugin.yaml` at its package root:

```yaml
apiVersion: openfde.dev/plugin/v1alpha1
name: openfde-plugin-salesforce      # npm-style unique name
version: 0.1.0                       # semver of the plugin itself
description: Salesforce discovery signals and write-boundary checks
homepage: https://github.com/example/openfde-plugin-salesforce

# Capability declarations — the security core of the contract.
# Everything defaults to the most restrictive value; a plugin only lists
# what it needs, and OpenFDE shows this block to the user before first run.
capabilities:
  files: read          # none | read          (write is not offered)
  network: none        # none | list of URL prefixes the plugin may contact
  exec: none           # none | list of binaries it wants to invoke
  credentials: none    # none | list of named credentials it will ask for

contributes:
  scanners: true       # exports fileSignatures / contentSignatures
  checks: true         # exports checks
  graphEnrichers: false
  redactors: false
```

Rules:

- `apiVersion` is validated exactly like `fde.yaml` — unknown versions are
  rejected with the supported version named.
- A plugin that declares `network: none` (the default) must work fully
  offline; OpenFDE will treat any network attempt as a bug.
- Capability escalation between versions (e.g. `network: none` → a URL list)
  must be re-approved by the user — approval is stored per plugin+capability
  set, not per plugin name.
- `files: read` means read-only access to the scanned repository through the
  host-provided walker — never raw `fs` access outside the scan root, and
  never the `.fde/` workspace of another engagement.

## Code contract

The plugin's entry module exports the same shapes the built-ins use:

```ts
import type { Check } from "openfde/checks";
import type { FileSignature, ContentSignature } from "openfde/scanners";

export const fileSignatures: FileSignature[] = [ /* ... */ ];
export const contentSignatures: ContentSignature[] = [ /* ... */ ];
export const checks: Check[] = [ /* ... */ ];
```

Contract obligations (identical to the built-in rules):

- Every check finding carries **evidence** (`file:line` where possible) and a
  recommendation. Findings without evidence are rejected by the host.
- Scanner contributions must be deterministic: same repository in, same
  inventory out. No wall-clock, no randomness, no network.
- Secret-shaped values are never persisted — report location and kind only.
- Check ids are namespaced by plugin name (`salesforce/write-boundary`) so
  `--only`/`--skip` and `spec.checks.overrides` address them unambiguously.

## Lifecycle

1. **Discover** — explicit only: the user lists plugins in `fde.yaml`
   (`spec.plugins`) or a workspace config. No auto-loading from
   `node_modules`.
2. **Validate** — manifest schema-checked; version + capability set compared
   against the stored approval.
3. **Approve** — first run (or any capability escalation) prints the
   capability block and requires interactive confirmation, or an explicit
   `--trust-plugin <name>` flag in CI.
4. **Register** — contributions are merged: signatures into the scan pass,
   checks into the registry (subject to `--only`/`--skip`/overrides).
5. **Run** — the host enforces the declared capabilities (no network/exec
   unless declared) and bounds file access to the scan root.
6. **Report** — every finding and detection records which plugin produced it,
   so reports stay auditable.

## Non-goals

- No dynamic loading in v0.2 — this document exists so the loader can be
  built against a stable contract later.
- No plugin-provided output renderers or report templates yet.
- No remote plugin registries; installation is npm/file-path based.
