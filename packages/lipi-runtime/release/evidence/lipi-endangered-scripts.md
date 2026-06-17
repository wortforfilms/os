# Lipi Endangered Scripts — Evidence Companion

- **Schema:** `maataa.lipi.endangered.v1`
- **Generated:** 2026-06-16
- **Source dataset:** `data/endangered-scripts-research.json` (provenance-backed research by agent1)
- **Machine evidence:** `lipi-endangered-scripts.json` (same directory)

## PHKD posture — CONTROLLED_NO_GO

These are **source-claim** ENDANGERED / EXTINCT / DORMANT / REVIVING script records.
They carry provenance citations from the cited research authorities (Endangered
Alphabets Project / Atlas, ISO 15924 Registration Authority, ScriptSource/SIL,
Wikipedia, Omniglot, UNESCO classifications surfaced via secondary sources).

They are **NOT** certified, **NOT** a "live revival", and **NOT** production-GO.
Every record is `reviewState: "CONTROLLED_NO_GO"`, pending native / specialist
review before any runtime promotion.

## Honest field handling

- Runtime `status` is the coarse `ENDANGERED` `LipiStatus`; the finer source-claim
  classification is preserved in the new `vitality` field
  (`ENDANGERED | EXTINCT | DORMANT | REVIVING`).
- Source `direction: "UNKNOWN"` (Mayan Hieroglyphs) is mapped to `MIXED` for the
  runtime `LipiDirection` union; the unknown is noted, not invented.
- `nativeName: "UNKNOWN"` source values are omitted rather than fabricated.
- Record ids are prefixed `endangered-` so a source-claim record never collides
  with or masks a distinct canonical historical record of the same script
  (e.g. `sharada`, `siddham`).

## Counts (do not inflate)

- **Total seeded:** 32
- **By vitality:** ENDANGERED 16, EXTINCT 8, REVIVING 5, DORMANT 3

The Lipi master total stays **exactly 426** (`LIPI_426_EXPECTED_COUNT = 426`):
these 32 records **consume** slots from the previously-`BLOCKED` 412-slot
extension reserve. No count was inflated to accommodate them.

## Provenance

Per-script provenance citations are carried verbatim in
`packages/lipi-runtime/src/data/endangered-scripts.ts` (`provenance` array on
each record) and counted in `lipi-endangered-scripts.json`. The authoritative
provenance source is `data/endangered-scripts-research.json`, which must not be
edited by this seeding step.
