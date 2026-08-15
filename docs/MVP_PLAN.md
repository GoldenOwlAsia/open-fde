# V0.1 MVP Plan

## Positioning

**OpenFDE — Local-first environment discovery and deployment preflight for Forward Deployed Engineers.**

The MVP must create value in under five minutes and must not require a cloud signup.

## In scope

### `fde init`

- create workspace;
- create starter `fde.yaml`;
- preserve existing user files.

### `fde scan`

- languages/runtimes;
- Docker;
- Terraform;
- Kubernetes;
- GitHub Actions;
- PostgreSQL/Redis signals;
- AWS signals;
- OpenAI/Anthropic signals;
- Sentry/OpenTelemetry signals;
- Okta/Auth0 signals.

### `fde map`

- normalize components;
- emit graph JSON;
- emit Mermaid.

### `fde check`

Initial checks:

- external model policy undefined;
- PII policy undefined;
- human approval boundary undefined;
- observability not detected;
- evaluation not declared;
- retry/fallback/timeout policy absent.

### `fde report`

Generate a reviewable Markdown artifact.

## Out of scope

- cloud discovery requiring credentials;
- production writes;
- automatic infrastructure changes;
- AI-generated architecture recommendations;
- hosted dashboard;
- incident replay;
- eval execution;
- MCP server.

## Acceptance criteria

A user should be able to:

```bash
npm install
npm run dev -- init ./example
npm run dev -- scan ./example
npm run dev -- map ./example
npm run dev -- check ./example
npm run dev -- report ./example
```

and receive meaningful local artifacts without providing an API key.
