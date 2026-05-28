# KBS Architecture

KBS is split into four local packages:

- `@maataa/kbs-runtime`: core types, registries, claims, graph, provenance, review, moderation, observability, export.
- `@maataa/kbs-governance`: claim classification, moderation, review queue, and PHKD gate helpers.
- `@maataa/kbs-graph`: graph traversal, validation, and metrics.
- `@maataa/kbs-search`: local keyword, citation, and semantic-preview search.
- `@maataa/kbs-sdk`: local SDK contract and OpenAPI surface.

The `apps/kbs` frame tree maps the extracted KBS visual runtime into route surfaces without pretending that missing backend maturity is complete.
