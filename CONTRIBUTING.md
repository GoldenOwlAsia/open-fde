# Contributing to OpenFDE

Thanks for helping make Forward Deployed Engineering more repeatable.

## Good first contribution areas

- add a repository scanner — tutorial: [`docs/WRITING_A_SCANNER.md`](docs/WRITING_A_SCANNER.md);
- add an explainable preflight check — tutorial: [`docs/WRITING_A_CHECK.md`](docs/WRITING_A_CHECK.md);
- improve detection evidence;
- add an example engagement to [`examples/`](examples/) (each README documents the exact findings it produces);
- add tests around false positives (`tests/fixtures.test.ts`);
- improve Markdown/terminal output (golden files: `tests/golden/`);
- propose schema fields with a concrete engagement use case.

## Contribution principles

1. Prefer small, composable primitives.
2. Do not add mandatory hosted dependencies.
3. Explain findings with evidence.
4. Avoid scanners that collect secrets.
5. Keep vendor integrations optional.
6. Prefer deterministic logic before adding LLM inference.

## Pull requests

Please include:

- the user problem;
- sample input;
- expected output;
- false-positive considerations;
- security/privacy implications;
- tests when behavior changes.
