import React from "react";
import { KbsBlockedPanel, KbsShell } from "../../components/KbsShell";

export default function GovernancePage() {
  return (
    <KbsShell active="Governance">
      <KbsBlockedPanel />
    </KbsShell>
  );
}
