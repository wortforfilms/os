# Unified Search

The unified search slice indexes only local, declared repository data.

## Indexed Sources

- `data/product-surface-matrix.json`
- canonical runtime states
- local documentation paths
- implemented and blocked routes
- evidence and blocker surfaces
- known apps, packages, crates, and kernel surfaces

## UI Surfaces

- `/search`
- Ctrl/Cmd+K command palette

## PHKD Behavior

- Blocked routes appear as `BLOCKED`.
- Blocked routes do not silently navigate.
- Empty queries show local registry data.
- Empty result sets render `MISSING_DATA`.
- No remote search, analytics, or AI search is used.

## Current Limits

The search index is local and static. It does not yet scan full document content or runtime database rows. Those capabilities remain future slices.
