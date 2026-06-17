# PHKD Audit — HKD Lipi Registry (2026-06-17)

**Verdict: `CONTROLLED_PREVIEW_NO_GO`** · productionReady=`false` · governedProductionGo=`false`

## Control flags (from committed runtime-activation evidence)
- registryRuntimeActive: `true`
- runtimeMode: `CONTROLLED_PREVIEW`
- readOnly: `true`
- mutationAllowed: `false`
- runtimeEnabledRows: `0`
- releaseCandidate: `false`
- humanApprovalPresent: `false`

## Verified counts (evidence-only)
- Registry rows: 426 · Unicode scripts: 176 · Numeral systems: 63 · Zero-glyph systems: 63
- KBS: 3372 nodes / 5233 edges
- HarfBuzz 11.2.1: 139 verified, 44 failed-with-evidence, 125 fonts
- Glyph baselines: 139 stable hashes / 139 browser-vs-HarfBuzz comparisons
- ISO 15924: 172 verified / 4 blocked / 0 conflict
- CLDR: 20 verified / 156 unknown
- ICU: 168 verified / 8 blocked / 37 extra codes / 4 name mismatches
- Federation: 7 sources / 36 lineage nodes / 28 edges / 4 blocked comparisons

## Rendering
- Browsers — Chrome: `true`, Firefox: `false`, Safari: `false`
- Platforms — macos: `VERIFIED`, linux: `BLOCKED`, windows: `BLOCKED`
- External review complete: `false` · Human approval: `false` · Production decision: `NO_GO`

## Contradictions
None in the current committed evidence. Synthetic mismatch fixtures are covered by the platform-attestation tests.

## Blockers
- Firefox rendering unverified (phase24 firefoxCaptured=false)
- Safari rendering unverified (phase24 safariCaptured=false)
- Linux platform unverified (phase25 BLOCKED)
- Windows platform unverified (phase25 BLOCKED)
- External review incomplete (phase26 externalReviewComplete=false)
- Human approval absent (phase26 humanApprovalPresent=false, validSignedHumanApproval=false)
- CLDR mostly unknown (20 verified / 156 unknown)
- ICU conflicts (37 extra codes, 4 name mismatches)
- ISO 15924 blocked rows (4)

## Recommended next actions
1. Run the Phase 23 generator on Linux and Windows; attach platform reports to clear those two BLOCKED targets.
2. Capture Firefox and Safari baselines to clear the two browser blockers.
3. Adjudicate the ICU extras + canonical-name mismatches as documented decisions (no silent registry edits).
4. Advance CLDR verified rows with sourced locale-script links; keep the unknown rows fail-closed.
5. Obtain a signed human-approval artifact and complete external review before Phase 27 can be reconsidered.
6. Keep runtimeEnabledRows=0 and mutationAllowed=false until all blockers clear AND a human GO exists.

_Evidence-only. Mission/vision targets are non-facts and excluded. Production remains blocked._
