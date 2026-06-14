/*
 * @maataa/lipi-runtime — the "shapeshifter": cross-script glyph correspondence.
 *
 * Realizes the Lipi chain  number >> shape >> shapeshifter >> observe_shift >>
 * relation_mind_graph  over the local Unicode authority.
 *
 * A "shapeshift set" is one phonetic LETTER token (e.g. "KA") rendered as many
 * SHAPES across Brahmic scripts (Devanagari क, Bengali ক, Gurmukhi ਕ, …). The
 * correspondence is derived ONLY from Unicode's own character names ("<SCRIPT>
 * LETTER <TOKEN>"). PHKD: no linguistic meaning is invented — shared token = the
 * correspondence Unicode itself encodes, nothing deeper. CONTROLLED_NO_GO.
 */
import { loadUnicodeData, listByRange, UNICODE_BLOCKS } from "./unicode-data.ts";

export interface ShapeVariant { script: string; codepoint: number; hex: string; char: string; name: string }
export interface ShiftSet { token: string; scripts: number; variants: ShapeVariant[] }

const toHex = (n: number) => n.toString(16).toUpperCase().padStart(4, "0");
const indicBlocks = () => UNICODE_BLOCKS.filter((b) => b.indic);

/** "DEVANAGARI LETTER KA" -> "KA"; non-LETTER names -> null (we only shift letters). */
export function letterToken(name: string): string | null {
  const m = /\bLETTER\s+(.+)$/.exec(name);
  return m ? m[1].trim() : null;
}

let INDEX: Map<string, ShapeVariant[]> = new Map();
let LOADED = false;

export function resetShapeshifter(): void { INDEX = new Map(); LOADED = false; }

/** Build the shift index from a UnicodeData.txt path. token -> variants[] across scripts. */
export function buildShiftIndex(path: string): { tokens: number; variants: number } {
  loadUnicodeData(path);
  const idx = new Map<string, ShapeVariant[]>();
  let variants = 0;
  for (const b of indicBlocks()) {
    for (const r of listByRange(b.start, b.end)) {
      const tok = letterToken(r.name);
      if (!tok) continue;
      const v: ShapeVariant = { script: b.name, codepoint: r.codepoint, hex: r.hex, char: String.fromCodePoint(r.codepoint), name: r.name };
      if (!idx.has(tok)) idx.set(tok, []);
      idx.get(tok)!.push(v);
      variants++;
    }
  }
  INDEX = idx; LOADED = true;
  return { tokens: idx.size, variants };
}

function ensure(): void { if (!LOADED) throw new Error("shapeshifter: not built — call buildShiftIndex(path) first (fail-closed)"); }

/** observe_shift: all script SHAPES for one phonetic token. Empty (fail-closed) on a miss. */
export function observeShift(token: string): ShiftSet {
  ensure();
  const variants = INDEX.get(token.toUpperCase()) ?? [];
  return { token: token.toUpperCase(), scripts: new Set(variants.map((v) => v.script)).size, variants };
}

/** All shift sets shared across >= minScripts scripts, ranked by spread. */
export function shiftSets(minScripts = 2): ShiftSet[] {
  ensure();
  const out: ShiftSet[] = [];
  for (const [token, variants] of INDEX) {
    const scripts = new Set(variants.map((v) => v.script)).size;
    if (scripts >= minScripts) out.push({ token, scripts, variants });
  }
  return out.sort((a, b) => b.scripts - a.scripts || a.token.localeCompare(b.token));
}

export interface RelationGraph {
  schema: "maataa.lipi.relation-mind-graph.v1";
  nodes: { tokens: number; scripts: number };
  edges: number; // one per (script, token) shape
  scriptList: string[];
  topShared: Array<{ token: string; scripts: number }>;
  governedProductionGo: false;
  status: "CONTROLLED_NO_GO";
}

/** relation_mind_graph: bipartite tokens<->scripts; edges are real shape correspondences. */
export function relationGraph(): RelationGraph {
  ensure();
  const scripts = new Set<string>();
  let edges = 0;
  for (const variants of INDEX.values()) for (const v of variants) { scripts.add(v.script); edges++; }
  const topShared = shiftSets(2).slice(0, 12).map((s) => ({ token: s.token, scripts: s.scripts }));
  return {
    schema: "maataa.lipi.relation-mind-graph.v1",
    nodes: { tokens: INDEX.size, scripts: scripts.size },
    edges,
    scriptList: [...scripts].sort(),
    topShared,
    governedProductionGo: false,
    status: "CONTROLLED_NO_GO",
  };
}
