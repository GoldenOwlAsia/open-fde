# `fde scan`

```bash
fde scan [root]
```

Discovers technical signals from the local repository and writes
`.fde/environment/inventory.json`. Fully offline and deterministic: the same
repository always produces the same inventory.

## What is detected

| Family | Signals |
|---|---|
| Runtime | Node.js (`package.json`), Python (`pyproject.toml`, `requirements.txt`, `Pipfile`) |
| Infrastructure | Docker (`Dockerfile`, compose files), Terraform (`*.tf`), Kubernetes (manifests under k8s/helm paths) |
| CI/CD | GitHub Actions workflows |
| Data | PostgreSQL, Redis |
| Cloud | AWS (SDKs, boto3, Terraform provider) |
| AI | OpenAI, Anthropic |
| Observability | Sentry, OpenTelemetry |
| Auth | Okta, Auth0 |

Every detection records **file-level evidence** — the paths that produced it —
and a confidence level.

## Signals for the policy checks

The scan also extracts deterministic signals consumed by `fde check`:

- **Regions** — region literals in Terraform/Kubernetes config (`file:line`)
- **Secret suspects** — `.env` files and credential-looking lines
  (`file:line` and kind only; **values are never persisted**)
- **Write signals** — write-implying code per system type (SQL writes, S3
  uploads, Redis write commands)

## Boundaries

- Bounded walk: `node_modules`, `.git`, `.fde`, build output, and virtualenvs
  are ignored; file and content limits keep large repos fast.
- `fde.yaml` is **excluded** from discovery — declared systems are engagement
  input, not findings.
- Nothing is uploaded, ever.
