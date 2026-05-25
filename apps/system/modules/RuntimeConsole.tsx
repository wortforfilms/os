import type { ConsoleLine } from "./types";

export type RuntimeConsoleProps = {
  lines?: ConsoleLine[];
};

const defaultLines: ConsoleLine[] = [
  { ts: "boot", level: "info", text: "Maataa OS starting in QEMU..." },
  { ts: "boot", level: "info", text: "storage mounted: virtual flash" },
  { ts: "tick 3", level: "info", text: "drivers sampled virtual GPIO and power rails" },
  { ts: "exit", level: "info", text: "Exiting QEMU." },
];

export function RuntimeConsole({ lines = defaultLines }: RuntimeConsoleProps) {
  return (
    <section className="maataa-module runtime-console">
      <header className="module-header">
        <h2>RuntimeConsole</h2>
      </header>

      <pre className="console-frame">
        {lines.map((line) => `[${line.ts}] ${line.level.toUpperCase()} ${line.text}`).join("\n")}
      </pre>
    </section>
  );
}
