import type { ReactNode } from "react";
import { MobileRuntimeStatus } from "./MobileRuntimeStatus";

export function MobileRuntimeShell({ children }: { children?: ReactNode }) {
  return (
    <section style={{ maxWidth: 430, minHeight: 640, margin: "0 auto", background: "#050816", border: "1px solid #1f2937", borderRadius: 8, padding: 16 }}>
      <MobileRuntimeStatus />
      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  );
}
