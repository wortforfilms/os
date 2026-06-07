# Governed Production Gate

Generated: 2026-06-07T17:32:35.809Z
Status: GOVERNED_PRODUCTION_NO_GO
Production ready: false
PHKD verdict: BLOCKED
Signature: 7a405456c687a448a3d3a3cb85c64c47054f19f5273f3d0badb58ec73fe629b6

## Inputs

- Completion matrix: 5e8d8a7f6a904c0a86981728fe9465744d23a464c48eed0b91f0233ff1033fcf
- Hardening matrix: f7e75faabfac1ad6ac55d04a260b0cd6fed11550eb4b804b330495f04394318b
- Hardware root of trust: 8115ea340870eb52caf672099562aa278dd39742678cd7ca65cca9fa115626b1
- Release authority: 5f716e30b5a52d1851f68a35031a7c292cc5f4e545db6124c67d024a6544c5a2

## Release Authority

- Status: BLOCKED
- Release candidate: BLOCKED
- Failures: 4

## Hardware Root Of Trust

- Status: PARTIAL
- Trust sources: 3
- Evidence hash: e1cbd36cc3d1fd45f3c9f52487c5ca34f1f7ec368d202b13472ab769b0ce03e1

## Runtime Health

- Sources: runtime-mission=ready, runtime-governance=ready, runtime-observability=ready, runtime-knowledge-graph=ready, runtime-hkd-registry=ready, runtime-validation=ready
- Topology: 7 nodes, 10 edges

## Blockers

- completion: completion matrix is CONTROLLED_NO_GO; productionReady=false
- hardening: hardening matrix is PREVIEW_BLOCKED; productionReady=false
- hardware-root-of-trust: hardware root evidence status must be CAPTURED; found PARTIAL
- hardware-root-of-trust: hardware root evidence production_ready must be true
- hardware-root-of-trust: hardware root blockers must be empty before GO
- hardware-root-of-trust: hardware root phkd_verdict must be PASS
