import type { ReactNode } from "react";
import { RuntimeSurface } from "../components/status/RuntimeSurface";

export function ObservatoryShell({ children }: { children?: ReactNode }) {
  return (
    <RuntimeSurface title="Observatory Shell" subtitle="Dashboard documentation and evidence panels">
      <div style={{ display: "grid", gap: 12 }}>{children}</div>
    </RuntimeSurface>
  );
}
