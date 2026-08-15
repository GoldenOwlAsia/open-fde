# Writing a Check

Checks turn declared engagements + scanned inventories into **evidenced
findings**. They live in `src/checks/` as plain objects implementing the
registry contract ([`src/checks/registry.ts`](../src/checks/registry.ts)):

```ts
import type { Check } from "./registry.js";

const myCheck: Check = {
  id: "my-check-id",                 // kebab-case, stable forever (used by --only/--skip/overrides)
  category: "security",              // security | data | reliability | evaluation | observability | human_control
  description: "One sentence shown in SARIF rules and docs.",
  appliesTo: ({ engagement }) => Boolean(engagement?.spec?.agents?.length),
  run: ({ inventory, engagement, root }) => {
    // return zero or more findings — or a Promise of them if you need the
    // filesystem (root is the engagement root; see evalChecks.ts)
    return [];
  }
};
```

Register it in `builtinChecks` (`src/checks/defaultChecks.ts`).

## The rules that make a check good

1. **Evidence or it didn't happen.** Every finding needs `evidence` entries
   the user can go look at — `file:line` for repository facts,
   `fde.yaml: spec...` for declaration facts. A finding without evidence is
   rejected by review (and by `tests/checks.test.ts`, which asserts evidence
   presence).
2. **`appliesTo` is a cheap relevance gate.** Don't fire "you have no X
   policy" at repositories where X is irrelevant — see how
   `external-model-policy-undefined` only applies when an AI provider was
   actually detected.
3. **Deterministic.** Same inputs, same findings. Filesystem reads are fine
   (eval artifact checks do it); network, clocks-as-logic, and randomness are
   not. (Freshness checks may compare against *now* — that is the documented
   exception, named in the finding.)
4. **Explain, then recommend.** `explanation` says why this matters;
   `recommendation` says exactly what to change, ideally naming the
   `fde.yaml` path.
5. **Never print secret values.** Report location + kind. The scanner's
   signals (`inventory.signals`) already follow this rule — keep it.
6. **Severity honestly.** `critical` means "do not deploy past this".
   Customers can downgrade with a reasoned override; that is their call, not
   the check's.

## Tests to write

In `tests/` (see `constraintChecks.test.ts` for the pattern):

- fires with the right severity + evidence on a minimal failing fixture;
- stays silent on a passing fixture;
- `appliesTo` gating (does not apply where irrelevant).

If your check reads new repository signals, extend the scanner via
[`docs/WRITING_A_SCANNER.md`](WRITING_A_SCANNER.md) and put the signal in
`inventory.signals` with `file:line` evidence — checks should consume
signals, not re-walk the repository.
