import { ScriptRegistryTable } from "./ScriptRegistryTable";
import { LipiHealthPanel } from "./LipiHealthPanel";

export function LipiDashboard() {
  return (
    <main>
      <h1>Lipi Runtime</h1>
      <LipiHealthPanel />
      <ScriptRegistryTable />
    </main>
  );
}
