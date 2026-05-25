import { useRuntimeSnapshot } from "../core/RuntimeProvider";
export function useGovernance() { return useRuntimeSnapshot().governanceState; }
