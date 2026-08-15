# Example: k8s-heavy

A Kubernetes + Terraform deployment with a data-residency contract.

```bash
fde scan examples/k8s-heavy
fde check examples/k8s-heavy
```

What OpenFDE shows here:

- **Scan** detects Kubernetes manifests, Terraform, AWS, PostgreSQL, and
  OpenTelemetry, and extracts the `us-east-1` region literal from `main.tf`
  with its line number.
- **Check** fires the critical **`data-residency-violation`**: the engagement
  allows only `eu-central-1`, but the infrastructure provisions `us-east-1`.
  Evidence points at `main.tf:2`.
