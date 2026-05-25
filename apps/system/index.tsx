import {
  BootTimeline,
  CapsuleRegistry,
  KernelDashboard,
  MemoryMap,
  ProcessTable,
  RuntimeConsole,
  SystemMonitor,
} from "./modules";

export function MaataaSystemApp() {
  return (
    <main className="maataa-system-app">
      <KernelDashboard />
      <SystemMonitor />
      <CapsuleRegistry />
      <ProcessTable />
      <BootTimeline />
      <RuntimeConsole />
      <MemoryMap />
    </main>
  );
}
