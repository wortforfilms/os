import type { ProductionMetric } from "../types";

const defaultMetrics: ProductionMetric[] = [
  { label: "shoot days locked", value: "12/18", status: "watch" },
  { label: "vendor readiness", value: "8/10", status: "nominal" },
  { label: "cash exposure", value: "18%", status: "nominal" },
  { label: "approval blockers", value: "1", status: "watch" },
];

export function ProductionDashboard({ metrics = defaultMetrics }: { metrics?: ProductionMetric[] }) {
  return (
    <section className="production-dashboard">
      <h2>ProductionDashboard</h2>
      <dl>
        {metrics.map((metric) => (
          <div data-status={metric.status} key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
