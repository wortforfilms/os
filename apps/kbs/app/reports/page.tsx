import React from "react";
import { kbsGovernanceState } from "../../../../packages/kbs-runtime/src";
import { KbsShell } from "../../components/KbsShell";

export default function ReportsPage() {
  return (
    <KbsShell active="Reports">
      <article>Knowledge Report - PREVIEW_VERIFIED</article>
      <article>Claims Report - PREVIEW_VERIFIED</article>
      <article>Evidence Report - PREVIEW_VERIFIED</article>
      <article>Production Report - {kbsGovernanceState.finalStatus}</article>
    </KbsShell>
  );
}
