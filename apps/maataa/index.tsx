import { AuraField } from "./aura/AuraField";
import { ChakraSystem } from "./chakra/ChakraSystem";
import { SensorPanel } from "./sensors/SensorPanel";
import { TimelineView } from "./timeline/TimelineView";
import { MotherShell } from "./ui/MotherShell";

export function MaataaApp() {
  return (
    <main className="maataa-app">
      <MotherShell />
      <ChakraSystem />
      <AuraField />
      <SensorPanel />
      <TimelineView />
    </main>
  );
}

export * from "./aura/AuraField";
export * from "./chakra/ChakraSystem";
export * from "./sensors/SensorPanel";
export * from "./timeline/TimelineView";
export * from "./ui/MotherShell";
