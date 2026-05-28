import React from "react";
import { kbsGovernanceState } from "../../../../packages/kbs-runtime/src";
import { KbsBlockedPanel, KbsShell } from "../../components/KbsShell";

export default function PhkdPage() {
  return (
    <KbsShell active="PHKD Status">
      <p>Production Ready: {String(kbsGovernanceState.productionReady)}</p>
      <p>PHKD Verdict: {kbsGovernanceState.phkdVerdict}</p>
      <KbsBlockedPanel />
    </KbsShell>
  );
}
