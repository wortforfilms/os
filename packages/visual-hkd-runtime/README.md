# @maataa/visual-hkd-runtime

Deterministic bridge from Maataa universe-board observations into HKD, knowledge graph contracts, runtime suggestions, dashboard widget inventory, and reality-matrix entries.

PHKD guardrails:

- The package does not perform hidden OCR or hallucinated vision.
- Unreadable text is represented as `UNREADABLE`, never guessed.
- Items below `0.7` confidence remain uncertain.
- Runtime suggestions default to `scaffolded` unless an existing package is explicitly supplied.
- Production readiness remains blocked until real vision providers, operator review, and governed release evidence exist.
