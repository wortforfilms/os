# Visual HKD Runtime

`@maataa/visual-hkd-runtime` is the execution bridge from universe-board imagery to machine-readable architecture.

```txt
Image
  -> OCR / vision observations
  -> panel and section extraction
  -> node and edge projection
  -> structured HKD
  -> knowledge graph ingestion
  -> runtime suggestions
  -> dashboard widget inventory
  -> reality matrix validation
```

## PHKD Rules

- Do not invent unreadable text.
- Mark uncertain extraction with confidence below `0.7`.
- Every extracted item must reference its source image.
- Every panel-linked item should reference its source panel when known.
- Generated runtimes are `scaffolded` unless an existing package is explicitly supplied.
- No production, scientific, hardware, or operational claims are accepted from an image alone.

## Current Status

The package is a deterministic scaffold and contract layer. It does not claim a connected OCR provider, operator review, or automatic implementation. Production readiness remains blocked.
