import type { RuntimeSurfaceProps } from "../../types";

const toneColor = {
  nominal: "#0f766e",
  degraded: "#b45309",
  recovery: "#b91c1c",
};

export function RuntimeSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" style={{ display: "grid", gap: 8 }}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          style={{
            height: 12,
            width: `${92 - index * 13}%`,
            borderRadius: 4,
            background: "linear-gradient(90deg, #e5e7eb, #f8fafc, #e5e7eb)",
          }}
        />
      ))}
    </div>
  );
}

export function RuntimeSurface({
  title = "Runtime Surface",
  subtitle,
  loading,
  stats = [],
  children,
  style,
  className,
}: RuntimeSurfaceProps) {
  return (
    <section
      className={className}
      style={{
        border: "1px solid #d6d3d1",
        borderRadius: 8,
        padding: 16,
        background: "#fffdf8",
        color: "#101315",
        fontFamily: "Inter, ui-sans-serif, system-ui",
        ...style,
      }}
    >
      <header style={{ display: "grid", gap: 4, marginBottom: 12 }}>
        <strong>{title}</strong>
        {subtitle ? <span style={{ color: "#57534e", fontSize: 13 }}>{subtitle}</span> : null}
      </header>
      {loading ? (
        <RuntimeSkeleton />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {stats.length ? (
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, margin: 0 }}>
              {stats.map((stat) => (
                <div key={stat.label} style={{ borderLeft: `3px solid ${toneColor[stat.tone ?? "nominal"]}`, paddingLeft: 8 }}>
                  <dt style={{ fontSize: 12, color: "#57534e" }}>{stat.label}</dt>
                  <dd style={{ margin: 0, fontWeight: 700 }}>{stat.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {children}
        </div>
      )}
    </section>
  );
}

export function createRuntimeSurface(title: string, subtitle: string) {
  return function GeneratedRuntimeSurface(props: RuntimeSurfaceProps) {
    return <RuntimeSurface title={props.title ?? title} subtitle={props.subtitle ?? subtitle} {...props} />;
  };
}
