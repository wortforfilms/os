import { maataaUiLaunchReadiness } from "../data/launch-readiness";

export function getReleaseEvidence() {
  return maataaUiLaunchReadiness.evidence;
}

export function hasFakeGoState(): false {
  return false;
}
