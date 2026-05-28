import React from "react";
import { KbsShell } from "../../components/KbsShell";

export default function SettingsPage() {
  return (
    <KbsShell active="Settings">
      <p>PHKD Mode: Always On</p>
      <p>Evidence Required Before Claims: Enabled</p>
      <p>Auto Classification: Preview only, governed by local claim engine.</p>
    </KbsShell>
  );
}
