# Contributing to OpenFDE

Thanks for helping make Forward Deployed Engineering more repeatable.

## Good first contribution areas

- add a repository scanner;
- improve detection evidence;
- add an explainable preflight check;
- improve the example engagement;
- add tests around false positives;
- improve Markdown/terminal output;
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
