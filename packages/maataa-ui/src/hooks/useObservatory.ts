import { useRuntimeSnapshot } from "../core/RuntimeProvider";
export function useObservatory() { return useRuntimeSnapshot().route; }
