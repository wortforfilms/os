import type { TimelineDatum } from "./types";

export type BootTimelineProps = {
  steps?: TimelineDatum[];
};

const defaultSteps: TimelineDatum[] = [
  { label: "Reset", detail: "cortex-m-rt entry starts main", status: "nominal" },
  { label: "Kernel", detail: "kernel subsystem objects created", status: "nominal" },
  { label: "Drivers", detail: "UART, GPIO, SPI, I2C, and power marked ready", status: "nominal" },
  { label: "Storage", detail: "virtual flash manifest committed", status: "nominal" },
  { label: "Capsules", detail: "telemetry and control capsules loaded", status: "nominal" },
  { label: "Scheduler", detail: "six deterministic ticks executed", status: "nominal" },
];

export function BootTimeline({ steps = defaultSteps }: BootTimelineProps) {
  return (
    <section className="maataa-module boot-timeline">
      <header className="module-header">
        <h2>BootTimeline</h2>
      </header>

      <ol className="timeline">
        {steps.map((step, index) => (
          <li className={`timeline-step ${step.status}`} key={step.label}>
            <span className="step-index">{index + 1}</span>
            <div>
              <strong>{step.label}</strong>
              <p>{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
