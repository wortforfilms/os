export type AuraBand = {
  name: string;
  intensity: number;
};

const defaultBands: AuraBand[] = [
  { name: "attention", intensity: 72 },
  { name: "breath", intensity: 64 },
  { name: "presence", intensity: 81 },
];

export function AuraField({ bands = defaultBands }: { bands?: AuraBand[] }) {
  return (
    <section className="aura-field">
      <h2>AuraField</h2>
      {bands.map((band) => (
        <meter key={band.name} min={0} max={100} value={band.intensity}>
          {band.name}
        </meter>
      ))}
    </section>
  );
}
