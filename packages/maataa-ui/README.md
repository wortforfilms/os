# @maataa/maataa-ui

Sovereign runtime UI scaffold for local-first Maataa OS surfaces.

This package exposes typed runtime shells, observatory dashboards, governance
states, accessibility helpers, and skeleton-to-stats loading surfaces. It does
not claim scientific certification; certification remains blocked until
authoritative datasets, tolerance tests, signed manifests, telemetry proof, and
governance approval are available.

This release candidate preserves the Maataa / Vaigyaaniq history:

- Maataa sovereign runtime
- Vaigyaaniq umbrella
- TLP production/runtime stack
- Aam Jantaa Interface
- Lipi 426-script database matrix
- Runtime Observatory
- Status Matrix
- evidence-first governance
- offline-first public interface
- Hindi, Haryanvi, Punjabi language modes
- Radio Vaigyaaniq
- Digital Gurukul
- Local Search
- Runtime Health

Allowed public badges are `READY`, `PREVIEW`, `BLOCKED`, `OFFLINE`,
`VERIFYING`, and `DEGRADED`. The package is a governed release candidate, not
a production GO artifact.

```tsx
import { AamJantaaInterface, RuntimeShell, RuntimeObservatory } from "@maataa/maataa-ui";

export function App() {
  return (
    <RuntimeShell>
      <AamJantaaInterface language="hi" />
      <RuntimeObservatory />
    </RuntimeShell>
  );
}
```

## PHKD Status

- `productionReady`: `false`
- `phkdVerdict`: `BLOCKED`
- `finalStatus`: `GOVERNED_PRODUCTION_NO_GO`

Production GO remains blocked until hardware-root attestation, operator quorum,
signed release authority, and rollback drill evidence are all real and passing.
