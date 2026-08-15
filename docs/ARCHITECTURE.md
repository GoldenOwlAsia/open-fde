# OpenFDE Architecture

## Goal

OpenFDE is a local-first execution layer around a Forward Deployed Engineering engagement. The architecture should remain small enough for a CLI-first project while leaving clean extension points for scanners, policies, adapters, evidence collectors, and later MCP access.

## Core flow

```text
Repository / Customer Environment
            ↓
         Scanner
            ↓
       Normalization
            ↓
      Inventory Graph
            ↓
   Engagement Constraints
            ↓
      Check Engine
            ↓
 Readiness + Evidence
            ↓
        Report
```

## Components

### CLI

Owns command routing and human-facing terminal output. It should contain minimal business logic.

### Workspace

`.fde/` is the source-controlled or selectively source-controlled local state directory. It stores normalized artifacts, not raw customer secrets.

### Scanner engine

Scanners produce normalized `DetectedComponent` objects. A scanner may inspect repository metadata, source references, manifests, infrastructure files, or explicitly configured endpoints.

Scanner output must include evidence and confidence.

### Integration graph

The graph models components and relationships. In early versions, relationship inference should remain conservative. Unknown edges are better than fabricated certainty.

### Check engine

Checks consume engagement declarations and discovered evidence. Each result must include:

- stable check ID;
- severity;
- category;
- explanation;
- evidence when available;
- remediation guidance when practical.

### Reporter

Renderers transform normalized results into Markdown, terminal text, JSON, or later SARIF/HTML.

## Future extension boundaries

### Plugins

Plugins may contribute scanners, checks, graph enrichers, and redaction rules.

### Policy engine

A later policy layer can evaluate declarative rules against the normalized graph. Avoid locking the project to a single policy language in V0.1.

### MCP

The MCP server should be a read-mostly interface over `.fde/` plus explicitly safe commands such as `run_preflight`. It should not become the primary storage layer.

### Hosted UI

A hosted UI is intentionally outside the V0.1 architecture. The OSS core must remain independently useful.
