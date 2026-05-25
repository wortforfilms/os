import { RuntimeRecovery } from "../../core/RuntimeRecovery";
import { RuntimeSurface } from "../../components/status/RuntimeSurface";
import type { RuntimeObservatoryEvidence, GlyphVector } from "../loaders/loadRuntimeObservatoryEvidence";

export type EvidenceGraphPanelProps = {
  evidence: RuntimeObservatoryEvidence;
  loading?: boolean;
};

const scriptRows: Record<GlyphVector["script"], number> = {
  brahmi: 52,
  kharosthi: 138,
  siddham: 224,
};

const scriptColors: Record<GlyphVector["script"], string> = {
  brahmi: "#0f766e",
  kharosthi: "#7c3aed",
  siddham: "#b45309",
};

export function EvidenceGraphPanel({ evidence, loading }: EvidenceGraphPanelProps) {
  if (loading) {
    return <RuntimeSurface title="Evidence Graph" subtitle="Validating local script datasets" loading />;
  }

  if (evidence.status === "BLOCKED") {
    return <RuntimeRecovery reason={evidence.reason} />;
  }

  const grouped = groupVectors(evidence.glyphVectors);

  return (
    <RuntimeSurface
      title="Evidence Graph"
      subtitle="REFERENCE_VALIDATED script topology"
      stats={evidence.stats}
      style={{ overflow: "hidden" }}
    >
      <svg
        role="img"
        aria-label="Validated glyph topology graph"
        viewBox="0 0 460 280"
        style={{
          width: "100%",
          minHeight: 280,
          display: "block",
          border: "1px solid #e7e5e4",
          borderRadius: 8,
          background: "#fafaf9",
          shapeRendering: "geometricPrecision",
        }}
      >
        {Object.entries(grouped).map(([script, vectors]) => (
          <g key={script}>
            <text x="18" y={scriptRows[script as GlyphVector["script"]] - 18} fontFamily="ui-monospace, SFMono-Regular" fontSize="11" fill="#57534e">
              {script.toUpperCase()}
            </text>
            {vectors.slice(1).map((vector, index) => {
              const previous = vectors[index];
              return (
                <line
                  key={`${script}-line-${index}`}
                  x1={previous.x}
                  y1={scriptRows[previous.script] + previous.y / 5}
                  x2={vector.x}
                  y2={scriptRows[vector.script] + vector.y / 5}
                  stroke={scriptColors[vector.script]}
                  strokeWidth="1.5"
                  opacity="0.45"
                />
              );
            })}
            {vectors.map((vector, index) => {
              const rowY = scriptRows[vector.script] + vector.y / 5;
              const radius = 3 + Math.min(vector.weight, 5);
              return (
                <g key={`${script}-${vector.codepoint}-${index}`}>
                  <circle cx={vector.x} cy={rowY} r={radius} fill={scriptColors[vector.script]} opacity="0.82" />
                  <text
                    x={vector.x}
                    y={rowY + 21}
                    textAnchor="middle"
                    fontFamily="ui-monospace, SFMono-Regular"
                    fontSize="10"
                    fill="#101315"
                  >
                    {vector.transliteration}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      <pre
        style={{
          margin: 0,
          padding: 12,
          overflow: "auto",
          borderRadius: 8,
          background: "#101315",
          color: "#d9f99d",
          fontFamily: "ui-monospace, SFMono-Regular",
          fontSize: 12,
        }}
      >
        {asciiTopology(evidence.glyphVectors)}
      </pre>
    </RuntimeSurface>
  );
}

function groupVectors(vectors: readonly GlyphVector[]): Record<GlyphVector["script"], GlyphVector[]> {
  return {
    brahmi: vectors.filter((vector) => vector.script === "brahmi"),
    kharosthi: vectors.filter((vector) => vector.script === "kharosthi"),
    siddham: vectors.filter((vector) => vector.script === "siddham"),
  };
}

function asciiTopology(vectors: readonly GlyphVector[]): string {
  const grouped = groupVectors(vectors);
  return Object.entries(grouped)
    .map(([script, scriptVectors]) => {
      const glyphs = scriptVectors.map((vector) => `${vector.transliteration}:${vector.weight}`).join(" -> ");
      return `${script.padEnd(10, " ")} ${glyphs}`;
    })
    .join("\n");
}
