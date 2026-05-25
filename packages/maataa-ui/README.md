# Maataa UI

Sovereign runtime UI scaffold for local-first Maataa OS surfaces.

This package exposes typed runtime shells, observatory dashboards, governance
states, accessibility helpers, and skeleton-to-stats loading surfaces. It does
not claim scientific certification; certification remains blocked until
authoritative datasets, tolerance tests, signed manifests, telemetry proof, and
governance approval are available.

```tsx
import { RuntimeShell, RuntimeObservatory } from "@maataa/ui";

export function App() {
  return (
    <RuntimeShell>
      <RuntimeObservatory />
    </RuntimeShell>
  );
}
```
