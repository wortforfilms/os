# Plug-and-Play Streaming Device

The Radio Vaigyaaniq plug-and-play streaming device is a governed preview profile for an offline-first local audio appliance.

It is designed for:

- Community radio operators
- Education field teams
- Local event producers
- Offline knowledge hubs

## Operator Flow

1. Connect power.
2. Connect microphone or line-in.
3. Connect speaker or local transmitter.
4. Select a local content pack.
5. Press broadcast.
6. Watch local health lights.
7. Export the evidence receipt after the session.

## Local Runtime Modules

- Local Audio Capture
- Offline Playlist Engine
- Loopback Stream Driver
- Field Recovery Console
- Session Evidence Receipt

## Cluster Ports

| Node | Interface | Port | Role |
| --- | --- | --- | --- |
| Delhi Corporate Node | `127.0.0.1` | `8401` | corporate-control |
| Noida Distribution Node | `127.0.0.1` | `8402` | distribution |
| Gurugram Broadcast Hub | `127.0.0.1` | `8403` | broadcast-hub |

## PHKD Status

This profile is not production-ready.

`PRODUCTION_READY=false`

`PHKD_VERDICT=BLOCKED`

`FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO`

Blocked until:

- Hardware-root attestation is captured.
- Operator quorum is verified.
- Signed release authority is verified.
- Rollback drill evidence is captured.
- Physical audio IO is verified.
- Field power-loss recovery is verified.
