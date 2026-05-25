import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { RuntimeStore, runtimeStore } from "./RuntimeStore";

const RuntimeContext = createContext<RuntimeStore>(runtimeStore);

export function RuntimeProvider({ children, store }: { children: ReactNode; store?: RuntimeStore }) {
  const value = useMemo(() => store ?? runtimeStore, [store]);
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function useRuntimeSnapshot() {
  const store = useContext(RuntimeContext);
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
    () => store.getSnapshot(),
  );
}
