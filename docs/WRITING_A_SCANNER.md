# Writing a Scanner

Scanners turn repository contents into **evidenced detections**. This tutorial
adds detection for a fictional vendor, "Acme Queue", end to end.

All built-in detectors live in
[`src/scanners/contributions.ts`](../src/scanners/contributions.ts) as plain
data. There are two kinds:

- **`FileSignature`** — detects from a file *path* (e.g. `Dockerfile`
  means Docker). Cheap; no file is opened.
- **`ContentSignature`** — detects from file *contents* during the bounded
  text scan (e.g. `import anthropic` means Anthropic).

## 1. Pick the signature kind

Acme Queue is used via an SDK, so its signal lives in file contents
(`package.json` dependencies, imports). That is a `ContentSignature`:

```ts
// src/scanners/contributions.ts
export const builtinContentSignatures: ContentSignature[] = [
  // ...
  { id: "acme-queue", name: "Acme Queue", category: "data", pattern: /\bacme-queue\b/i }
];
```

Rules of thumb for patterns:

- Anchor with `\b` word boundaries — `aws_` once matched `flaws_found`; the
  false-positive regression suite (`tests/fixtures.test.ts`) exists because
  of exactly this class of bug.
- Prefer the package/import name over a generic product word.
- Detection must be **deterministic**: no network, no time, no randomness.

`category` must be one of the `ComponentCategory` values in
[`src/core/types.ts`](../src/core/types.ts); it controls where the component
appears in scan output and whether it gets an integration-graph edge.

## 2. Add fixture tests

Every scanner needs two tests in `tests/fixtures.test.ts`: what it **must**
detect and what it **must not**:

```ts
test("data family: acme queue from package.json", async () => {
  const ids = await scanFixture({
    "package.json": JSON.stringify({ dependencies: { "acme-queue": "^1.0.0" } })
  });
  assert.ok(ids.has("acme-queue"));
});

test("false positives: acmeQueueTheatre is not acme-queue", async () => {
  const ids = await scanFixture({ "notes.ts": "const acmeQueueTheatre = 1;" });
  assert.ok(!ids.has("acme-queue"));
});
```

Run `pnpm test`. The golden-file suite (`tests/golden.test.ts`) will also
catch any accidental change to existing outputs.

## 3. Wire the graph (optional)

If the system should carry declared access from `fde.yaml`
(`spec.systems[].type: acme-queue`), add its type → category mapping to
`SYSTEM_TYPE_CATEGORIES` in [`src/commands/map.ts`](../src/commands/map.ts).

## 4. Evidence is the contract

A detection without evidence is a bug. The scan host records which files
matched your signature; never bypass that by fabricating a component without
paths. The same applies to signals: report `file:line` and a **kind** — never
a matched secret value.

## Where this is going

The shapes above are the internal half of the future plugin contract
([`docs/PLUGIN_CONTRACT.md`](PLUGIN_CONTRACT.md)). A scanner you write today
as a built-in contribution should port to a plugin without changes.
