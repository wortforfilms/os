import type { ReactNode } from "react";
import { RuntimeSurface } from "../components/status/RuntimeSurface";
import { RuntimeProvider, useRuntimeSnapshot } from "./RuntimeProvider";

function RuntimeShellInner({ children }: { children?: ReactNode }) {
  const snapshot = useRuntimeSnapshot();
  return (
    <main style={{ minHeight: "100vh", background: "#f7f5ee", padding: 24 }}>
      <RuntimeSurface title="Maataa Sovereign Runtime" subtitle={snapshot.mode} stats={snapshot.stats}>
        {children}
      </RuntimeSurface>
    </main>
  );
}

export function RuntimeShell({ children }: { children?: ReactNode }) {
  return (
    <RuntimeProvider>
      <RuntimeShellInner>{children}</RuntimeShellInner>
    </RuntimeProvider>
  );
}
