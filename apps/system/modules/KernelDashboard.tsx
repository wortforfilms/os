import type { MetricDatum, ModuleStatus } from "./types";

export type KernelDashboardProps = {
  status?: ModuleStatus;
  metrics?: MetricDatum[];
};

const defaultMetrics: MetricDatum[] = [
  { label: "Drivers", value: "5/5 ready", status: "nominal" },
  { label: "Capsules", value: "2 loaded", status: "nominal" },
  { label: "Memory", value: "274 / 65536 bytes", status: "nominal" },
  { label: "Scheduler", value: "6 ticks", status: "nominal" },
];

export function KernelDashboard({ status = "nominal", metrics = defaultMetrics }: KernelDashboardProps) {
  return (
    <section className="maataa-module kernel-dashboard" data-status={status}>
      <header className="module-header">
        <div>
          <p className="module-kicker">Maataa OS</p>
          <h2>KernelDashboard</h2>
        </div>
        <span className={`status-pill ${status}`}>{status}</span>
      </header>

      <div className="metric-grid">
        {metrics.map((metric) => (
          <article className="metric-card" data-status={metric.status ?? "nominal"} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
