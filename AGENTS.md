# Agent Instructions for OpenFDE

When using a coding agent in this repository:

- Preserve the local-first security model.
- Do not add telemetry or network calls without explicit user configuration.
- Keep V0.1 focused on `init`, `scan`, `map`, `check`, and `report`.
- Prefer deterministic scanners and checks before LLM inference.
- Every finding should provide understandable evidence.
- Do not turn OpenFDE into a generic AI-agent framework.
- Keep plugin boundaries clean even before dynamic loading exists.
