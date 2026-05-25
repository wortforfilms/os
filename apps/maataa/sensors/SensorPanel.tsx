export type SensorReading = {
  name: string;
  value: string;
  status: "nominal" | "warning" | "offline";
};

const defaultReadings: SensorReading[] = [
  { name: "virtual-gpio", value: "ready", status: "nominal" },
  { name: "power-rail", value: "sampled", status: "nominal" },
];

export function SensorPanel({ readings = defaultReadings }: { readings?: SensorReading[] }) {
  return (
    <section className="sensor-panel">
      <h2>SensorPanel</h2>
      <dl>
        {readings.map((reading) => (
          <div data-status={reading.status} key={reading.name}>
            <dt>{reading.name}</dt>
            <dd>{reading.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
