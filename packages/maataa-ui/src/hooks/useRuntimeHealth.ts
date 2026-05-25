import { useRuntimeSnapshot } from "../core/RuntimeProvider";
export function useRuntimeHealth() { return useRuntimeSnapshot().health; }
