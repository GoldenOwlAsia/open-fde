# Threat Model: Plugin Loader

> Status: prerequisite document for the v1.0 dynamic plugin loader
> (`docs/PLUGIN_CONTRACT.md`). The loader must not ship until the mitigations
> marked **required** exist and are tested.

## What we are protecting

1. **Customer source code and secrets** in the scanned repository — the most
   sensitive thing OpenFDE ever touches.
2. **The `.fde/` workspace** — findings, evidence, decisions. Its integrity is
   the product: a poisoned workspace produces confident, wrong reports.
3. **The user's machine and credentials** — OpenFDE runs where engineers keep
   SSH keys and cloud sessions.
4. **The local-first guarantee** — "no network calls" is a promise; one
   exfiltrating plugin breaks it for the whole project's reputation.

## Adversaries

- **A malicious plugin author** publishing a useful-looking scanner.
- **A compromised legitimate plugin** (upstream account takeover, dependency
  compromise) — same capabilities, more trust already granted.
- **A malicious repository being scanned** that exploits a parser bug in a
  plugin (attacker controls scanner *input*, not the plugin).

## Attack surfaces and mitigations

### 1. Exfiltration (repo contents / secrets → network)

The highest-impact attack: a plugin reads scanned files and phones home.

- **Required:** default-deny network. A plugin with `network: none` runs with
  no network access *enforced*, not promised — Node's `--experimental-permission`
  / permission model or a subprocess with no network namespace, not an honor
  system. If enforcement is not technically achievable for a plugin type, that
  plugin type does not ship.
- **Required:** declared URL prefixes are an allowlist, shown verbatim at
  approval time.

### 2. Capability escalation across versions

v1.0.0 declares `network: none`, v1.0.1 quietly adds an endpoint.

- **Required:** approvals are stored per **(plugin name, capability set)**.
  Any change — broader files, new network prefix, new exec — invalidates the
  stored approval and re-prompts (or fails in CI without a new explicit
  `--trust-plugin` flag).

### 3. Arbitrary code at load time

`require()`/`import` of a plugin executes top-level code before any contract
is checked.

- **Required:** no auto-discovery. Only plugins explicitly listed by the user
  are ever loaded; nothing is scanned out of `node_modules`.
- **Required:** manifest validation happens **before** import; a plugin whose
  `plugin.yaml` is invalid or whose capability approval is missing is never
  imported at all.
- Considered, deferred: subprocess isolation for the whole plugin runtime
  (strongest boundary; revisit when the loader is built — prefer it if the
  performance cost is acceptable).

### 4. Workspace poisoning

A plugin "contributes" findings that drown real ones, or suppresses them; or
writes files into `.fde/` to fake evidence.

- **Required:** plugins get no filesystem write access, period. Contributions
  flow back as return values; the host writes everything.
- **Required:** provenance — every finding/detection records the contributing
  plugin, and reports render it. A plugin cannot remove or modify another
  contributor's findings.
- Severity overrides remain a user-only mechanism (`fde.yaml`), never a
  plugin capability.

### 5. Secret harvesting via scan access

`files: read` legitimately exposes repository contents — including any
committed secrets — to the plugin.

- **Required:** the host walker, not raw `fs`, mediates all reads: scan root
  only, ignore rules applied, no `.fde/` of other engagements, bounded sizes.
- **Required:** the approval prompt for `files: read` says plainly: *"this
  plugin will see the contents of the scanned repository."*

### 6. Exec and credential capabilities

- `exec` is a full sandbox escape (a binary inherits the user's environment).
  **Decision:** `exec` does not ship in the first loader version. Revisit
  only with subprocess isolation and per-binary allowlists.
- `credentials` likewise deferred; nothing in the current check/scan surface
  needs live credentials, and the local-first posture is stronger without.

### 7. Malicious scanned repository

A hostile repo exploits a plugin's parser (zip bombs, deeply nested YAML,
path traversal in "follow this include" logic).

- **Required:** the host enforces input bounds (file count, file size,
  depth) before content reaches plugins — plugins never do their own
  walking.
- Plugin authors' guide must state: treat repository content as hostile
  input.

## Residual risks (accepted, documented)

- A plugin with approved network access can misuse exactly that access; the
  allowlist bounds *where*, not *what*. Users must treat network-granting
  plugins as trusted code.
- Determinism cannot be enforced mechanically; a plugin can return unstable
  results. Mitigated socially (contract + review), not technically.

## Ship criteria for the loader

1. Network default-deny is enforced by mechanism, with a test that a
   `network: none` plugin attempting a request fails.
2. Capability-set-pinned approval storage + re-prompt on change, tested.
3. Manifest-before-import ordering, tested with a deliberately hostile
   fixture plugin.
4. Provenance on findings end-to-end.
5. `exec`/`credentials` rejected by the loader (not merely undocumented).
