import type { ProcessDatum } from "./types";

export type ProcessTableProps = {
  processes?: ProcessDatum[];
};

const defaultProcesses: ProcessDatum[] = [
  { pid: "k-main", name: "kernel::run", state: "running", ticks: 6, owner: "kernel" },
  { pid: "drv-poll", name: "driver poll", state: "ready", ticks: 6, owner: "drivers" },
  { pid: "cap-telemetry", name: "telemetry capsule", state: "ready", ticks: 6, owner: "capsule" },
  { pid: "cap-control", name: "control capsule", state: "ready", ticks: 6, owner: "capsule" },
];

export function ProcessTable({ processes = defaultProcesses }: ProcessTableProps) {
  return (
    <section className="maataa-module process-table">
      <header className="module-header">
        <h2>ProcessTable</h2>
      </header>

      <table className="data-table dense">
        <thead>
          <tr>
            <th>PID</th>
            <th>Name</th>
            <th>State</th>
            <th>Ticks</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          {processes.map((process) => (
            <tr key={process.pid}>
              <td>{process.pid}</td>
              <td>{process.name}</td>
              <td>{process.state}</td>
              <td>{process.ticks}</td>
              <td>{process.owner}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
