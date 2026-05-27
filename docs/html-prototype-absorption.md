# HTML Prototype Absorption

This document records the governed extraction of the local Maataa HTML prototype set into Maataa OS.

## Source Boundary

The source prototypes live outside this repository at:

`/Volumes/LaCie/pprm/revenue/live/maataa/code/html`

They are treated as local-only design inputs. They are not copied into `assets/html/`, not bundled into production, and not used as release runtime source.

## Extracted Surfaces

| Source | Absorbed Surface | Status | Notes |
| --- | --- | --- | --- |
| `boot_ritual.html` | Boot ritual runtime frames | PREVIEW | Stage flow extracted as deterministic metadata. |
| `dashboard.html` | Runtime dashboard cards | PREVIEW | Metrics require real telemetry before READY. |
| `desktop.html` | Desktop workspace shell | PREVIEW | Window/taskbar model extracted. |
| `features.html` | Feature catalog | BLOCKED | Product claims require evidence. |
| `landing_page.html` | Cinematic homepage/catalog | BLOCKED | Pricing, uptime, and proof claims are not verified. |
| `maataa_avataar_v2.html` | Avatar expression controls | PREVIEW | Animation/input runtime requires tests. |
| `monitor.html` | Operator monitor panels | PREVIEW | Live subsystem metrics remain evidence-gated. |
| `os_holy_screen.html` | Operator console | PREVIEW | Transport controls require governed runtime wiring. |
| `quick_start.html` | Onboarding flow | PREVIEW | Completion persistence is not verified. |
| `sales.html` | Sales/pricing shell | BLOCKED | Billing and entitlement evidence missing. |
| `services.html` | Services/support catalog | PREVIEW | Operational response commitments need measured support process. |
| `systemprocesses.html` | Process supervisor table | PREVIEW | Real process telemetry must come from local runtime. |
| `usp.html` | Proof/USP presentation | BLOCKED | Performance and uptime claims remain blocked. |

## Absorbed Contracts

The extraction is stored in `data/html-prototype-inventory.json`.

It contains:

- Type signatures for prototype surfaces, statuses, frames, and workflows.
- Schema fragments for boot stages, runtime metrics, desktop windows, commerce plans, support services, and avatar controls.
- Data frame groupings that can be promoted into package-level runtime models later.
- Runtime names for boot, desktop, dashboard, avatar, monitor, onboarding, commerce, support, and process supervision.
- Workflow records connecting boot, operator monitoring, product education, and onboarding.
- UI and widget names mapped from each prototype.

## PHKD Verdict

The absorption is useful, but it is not a production release.

`PRODUCTION_READY=false`

`PHKD_VERDICT=BLOCKED`

`FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO`

The active blockers are preserved in `release/evidence/html-prototype-absorption.json`.

## Runtime HTML Output

The structured inventory can be rendered into release-preview HTML with:

`npm run runtime-html:generate`

This generates:

- `release/runtime-html/index.html`
- `release/runtime-html/{prototype-id}.html`
- `release/runtime-html/manifest.json`
- `release/evidence/runtime-html-release.json`

The generated runtime HTML pages are governed previews. They are not raw prototype copies and they do not change production readiness.
