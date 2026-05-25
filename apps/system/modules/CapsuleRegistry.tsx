import type { CapsuleDatum } from "./types";

export type CapsuleRegistryProps = {
  capsules?: CapsuleDatum[];
};

const defaultCapsules: CapsuleDatum[] = [
  { id: 0, name: "telemetry", bytes: 251, cycles: 6, status: "nominal" },
  { id: 1, name: "control", bytes: 23, cycles: 6, status: "nominal" },
];

export function CapsuleRegistry({ capsules = defaultCapsules }: CapsuleRegistryProps) {
  return (
    <section className="maataa-module capsule-registry">
      <header className="module-header">
        <h2>CapsuleRegistry</h2>
      </header>

      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Bytes</th>
            <th>Cycles</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {capsules.map((capsule) => (
            <tr key={capsule.id}>
              <td>{capsule.id}</td>
              <td>{capsule.name}</td>
              <td>{capsule.bytes}</td>
              <td>{capsule.cycles}</td>
              <td>
                <span className={`status-pill ${capsule.status}`}>{capsule.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
