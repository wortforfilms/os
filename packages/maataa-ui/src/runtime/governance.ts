import { maataaUiLaunchReadiness } from "../data/launch-readiness";

export function getGovernanceSnapshot() {
  return maataaUiLaunchReadiness;
}

export function isProductionReady(): false {
  return false;
}

export function getActiveBlockers(): string[] {
  return maataaUiLaunchReadiness.activeBlockers;
}
