# Security Model

OpenFDE is intended to run inside customer repositories and potentially sensitive enterprise environments. The project should assume that source code and infrastructure metadata are sensitive by default.

## Baseline guarantees

- No telemetry by default.
- No external API call is required for V0.1.
- Do not read `.env` values as part of ordinary repository discovery.
- Do not persist raw secrets.
- Generated artifacts should contain paths and normalized evidence, not credential values.
- Future networked scanners must require explicit opt-in.
- Future destructive actions must require explicit confirmation and should live outside ordinary scan/check flows.

## Scanner guidance

Prefer:

- filenames;
- dependency manifests;
- infrastructure resource types;
- redacted configuration keys;
- package references.

Avoid collecting:

- tokens;
- passwords;
- private keys;
- production records;
- document contents unrelated to technical discovery.

## Reporting vulnerabilities

Until a dedicated security address exists, open a GitHub security advisory rather than a public issue for vulnerabilities that could expose secrets or customer data.
