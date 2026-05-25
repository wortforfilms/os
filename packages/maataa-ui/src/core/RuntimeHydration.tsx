import { useEffect, useState, type ReactNode } from "react";
import { RuntimeSurface } from "../components/status/RuntimeSurface";

export function RuntimeHydration({ children, delayMs = 320 }: { children: ReactNode; delayMs?: number }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(handle);
  }, [delayMs]);

  if (!ready) {
    return <RuntimeSurface title="Hydrating Runtime" subtitle="Loading local state" loading />;
  }

  return <>{children}</>;
}
