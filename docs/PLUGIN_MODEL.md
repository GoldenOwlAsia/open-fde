# Plugin Model

## Objective

OpenFDE should grow through small adapters rather than a monolithic scanner.

## Proposed plugin contract

A future plugin may expose:

```ts
interface OpenFDEPlugin {
  manifest: PluginManifest;
  scanners?: Scanner[];
  checks?: Check[];
  graphEnrichers?: GraphEnricher[];
  redactors?: Redactor[];
}
```

## Plugin safety

Plugins must declare whether they:

- read files;
- execute commands;
- access network endpoints;
- request credentials;
- write to the environment.

OpenFDE should make these capabilities visible before execution.

## Contribution-friendly plugin categories

- cloud providers;
- databases;
- CRMs;
- ticketing systems;
- document stores;
- observability tools;
- AI providers;
- auth providers;
- CI/CD systems.

## V0.1 rule

Do not build a dynamic plugin loader yet. Keep internal scanner boundaries clean so the public contract can be designed after real scanner experience.
