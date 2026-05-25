import type { MemoryRegion } from "./types";

export type MemoryMapProps = {
  regions?: MemoryRegion[];
};

const defaultRegions: MemoryRegion[] = [
  { name: "FLASH", origin: "0x08000000", size: "512K", used: "11912 bytes", role: "kernel image" },
  { name: "RAM", origin: "0x20000000", size: "128K", used: "8 bytes bss", role: "runtime state" },
  { name: "Capsule Budget", origin: "logical", size: "64K", used: "274 bytes", role: "capsule accounting" },
];

export function MemoryMap({ regions = defaultRegions }: MemoryMapProps) {
  return (
    <section className="maataa-module memory-map">
      <header className="module-header">
        <h2>MemoryMap</h2>
      </header>

      <div className="memory-regions">
        {regions.map((region) => (
          <article className="memory-region" key={region.name}>
            <header>
              <strong>{region.name}</strong>
              <code>{region.origin}</code>
            </header>
            <p>{region.role}</p>
            <dl>
              <dt>Size</dt>
              <dd>{region.size}</dd>
              <dt>Used</dt>
              <dd>{region.used}</dd>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
