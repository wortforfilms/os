# Governed Production Gate

Generated: 2026-06-04T20:14:30.679Z
Status: GOVERNED_PRODUCTION_NO_GO
Production ready: false
PHKD verdict: BLOCKED
Signature: 27a50957b9ba457af06bd9d82d66fc41336406026cb8751407d5b1d51a0ef71c

## Inputs

- Completion matrix: 17c8a5f6395e36188549a61d06a857038298cef732486375a563a3039647b1d2
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

## Blockers

- completion: completion matrix is CONTROLLED_NO_GO; productionReady=false
- hardening: hardening matrix is PREVIEW_BLOCKED; productionReady=false
- hardware-root-of-trust: hardware root evidence status must be CAPTURED; found PARTIAL
- hardware-root-of-trust: hardware root evidence production_ready must be true
- hardware-root-of-trust: hardware root blockers must be empty before GO
- hardware-root-of-trust: hardware root phkd_verdict must be PASS
