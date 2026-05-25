import type { ConsoleLine, MetricDatum } from "./types";

export type SystemMonitorProps = {
  metrics?: MetricDatum[];
  events?: ConsoleLine[];
};

const defaultMetrics: MetricDatum[] = [
  { label: "Runtime", value: "QEMU semihosting" },
  { label: "Health", value: "nominal", status: "nominal" },
  { label: "Driver poll", value: "active" },
];

const defaultEvents: ConsoleLine[] = [
  { ts: "tick 1", level: "info", text: "capsule telemetry cycle 1" },
  { ts: "tick 3", level: "info", text: "drivers sampled virtual GPIO and power rails" },
  { ts: "tick 6", level: "info", text: "prototype demo complete" },
];

export function SystemMonitor({ metrics = defaultMetrics, events = defaultEvents }: SystemMonitorProps) {
  return (
    <section className="maataa-module system-monitor">
      <header className="module-header">
        <h2>SystemMonitor</h2>
      </header>

      <div className="metric-strip">
        {metrics.map((metric) => (
          <div className="metric-inline" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>

      <ol className="event-stream">
        {events.map((event) => (
          <li className={`event-line ${event.level}`} key={`${event.ts}-${event.text}`}>
            <time>{event.ts}</time>
            <span>{event.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
