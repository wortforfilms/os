/*
 * @maataa/lipi-runtime/src/agent.ts
 * Honest agent wrapper over lipi-runtime transliteration and lineage data.
 *
 * Provides analyze(text, script), suggest(action), and learn(feedback). Scope is
 * transliteration/lineage advisory only: no OCR, no full translation claim, and
 * not production-GO.
 */
import { getCharactersForScript } from "./characters/character-matrix.ts";
import { scriptLineageGraph } from "./lineage/script-lineage-graph.ts";
import { getLipiScriptById, listLipiScripts } from "./registry/script-registry.ts";

export type Ok<T>  = { isOk: true;  data: T;    error: null };
export type Err    = { isOk: false; data: null; error: { code: string; detail: string } };
export type Result<T> = Ok<T> | Err;

const ok = <T>(data: T): Ok<T> => ({ isOk: true, data, error: null });
const err = (code: string, detail: string): Err => ({ isOk: false, data: null, error: { code, detail } });

export type AnalysisResult = {
  script: string;
  scriptName: string;
  confidence: number;
  lineage: Array<{ step: string; runtime: string; timestamp: number }>;
  suggestions: Array<{ kind: "transliteration" | "variant" | "homophone"; text: string; confidence: number }>;
  evidence: {
    scriptRecord: string;
    characterAnchors: number;
    lineageEdges: string[];
    scope: "transliteration-lineage-wrapper";
  };
};

export type SuggestionResult = {
  nextAction: string;
  rationale: string;
  examples: string[];
};

export type LearningFeedback = {
  correct: string[];
  wrong: string[];
};

export type LearningResult = {
  updated: boolean;
  confidence: number;
  newKnowledge: number;
};

export class LipiAgent {
  private knowledgeBase: Set<string>;
  private learningHistory: Array<{ text: string; feedback: LearningFeedback; ts: number }>;
  private lineageChain: Array<{ step: string; runtime: string; timestamp: number }>;

  constructor() {
    this.knowledgeBase = new Set();
    this.learningHistory = [];
    this.lineageChain = [];
  }

  async analyze(text: string, script?: string): Promise<Result<AnalysisResult>> {
    if (!text || typeof text !== "string") {
      return err("invalid_input", "analyze: text is required");
    }

    const ts = Date.now();
    const detected = script || this.detectScript(text);
    const scriptRecord = getLipiScriptById(detected);
    if (!scriptRecord) {
      return err("unknown_script", `analyze: script '${detected}' not recognized`);
    }

    const lineageEdges = scriptLineageGraph.filter((edge) => edge.parentScriptId === detected || edge.childScriptId === detected);
    this.lineageChain.push({ step: `analyze:${detected}`, runtime: "lipi-runtime", timestamp: ts });

    return ok({
      script: detected,
      scriptName: scriptRecord.name,
      confidence: this.confidenceForScript(detected),
      lineage: [...this.lineageChain],
      suggestions: this.generateSuggestions(detected),
      evidence: {
        scriptRecord: scriptRecord.id,
        characterAnchors: getCharactersForScript(detected).length,
        lineageEdges: lineageEdges.map((edge) => edge.id),
        scope: "transliteration-lineage-wrapper",
      },
    });
  }

  async suggest(action: string): Promise<Result<SuggestionResult>> {
    if (!action || typeof action !== "string") {
      return err("invalid_input", "suggest: action is required");
    }

    const ts = Date.now();
    const nextAction = this.computeNextAction(action);
    const rationale = `Based on ${this.learningHistory.length} prior corrections and ${this.knowledgeBase.size} learned patterns`;
    const examples = Array.from(this.knowledgeBase).slice(0, 3);
    this.lineageChain.push({ step: `suggest:${action}`, runtime: "lipi-runtime", timestamp: ts });

    return ok({ nextAction, rationale, examples });
  }

  async learn(feedback: LearningFeedback): Promise<Result<LearningResult>> {
    if (!feedback || !Array.isArray(feedback.correct) || !Array.isArray(feedback.wrong)) {
      return err("invalid_feedback", "learn: feedback.correct and feedback.wrong required");
    }

    const ts = Date.now();
    const priorSize = this.knowledgeBase.size;
    for (const item of feedback.correct) {
      if (typeof item === "string" && item.trim()) this.knowledgeBase.add(item);
    }
    this.learningHistory.push({ text: feedback.correct.join(";"), feedback, ts });

    const newKnowledge = this.knowledgeBase.size - priorSize;
    const updated = newKnowledge > 0;
    const confidence = Math.min(1, 0.5 + this.knowledgeBase.size / 1000);
    this.lineageChain.push({ step: `learn:${feedback.correct.length}`, runtime: "lipi-runtime", timestamp: ts });

    return ok({ updated, confidence, newKnowledge });
  }

  inventory() {
    return {
      scripts: listLipiScripts().length,
      lineageEdges: scriptLineageGraph.length,
      knowledge: this.knowledgeBase.size,
      corrections: this.learningHistory.length,
    };
  }

  private detectScript(text: string): string {
    if (/[\u{10A00}-\u{10A5F}]/u.test(text)) return "kharosthi";
    if (/[\u{11000}-\u{1107F}]/u.test(text)) return "brahmi";
    if (/[\u{11080}-\u{110CF}]/u.test(text)) return "kaithi";
    if (/[\u{11180}-\u{111DF}]/u.test(text)) return "sharada";
    if (/[\u{11580}-\u{115FF}]/u.test(text)) return "siddham";
    if (/[\u0900-\u097F]/.test(text)) return "devanagari";
    if (/[\u0B80-\u0BFF]/.test(text)) return "tamil";
    if (/[\u0A00-\u0A7F]/.test(text)) return "gurmukhi";
    if (/[\u0980-\u09FF]/.test(text)) return "bengali";
    return "unknown";
  }

  private generateSuggestions(script: string): AnalysisResult["suggestions"] {
    const anchors = getCharactersForScript(script).filter((anchor) => anchor.transliteration || anchor.glyph);
    return anchors.slice(0, 5).map((anchor, idx) => ({
      kind: idx === 0 ? "transliteration" : idx === 1 ? "variant" : "homophone",
      text: anchor.transliteration ? `${anchor.glyph} -> ${anchor.transliteration}` : anchor.glyph,
      confidence: Math.max(0.1, this.confidenceForScript(script) - idx * 0.05),
    }));
  }

  private confidenceForScript(script: string): number {
    const record = getLipiScriptById(script);
    if (!record) return 0;
    const anchors = getCharactersForScript(script).length;
    const lineage = scriptLineageGraph.some((edge) => edge.parentScriptId === script || edge.childScriptId === script);
    const statusBase = record.status === "ACTIVE" ? 0.9 : record.status === "HISTORICAL" ? 0.78 : 0.45;
    return Math.min(1, statusBase + (anchors > 0 ? 0.08 : 0) + (lineage ? 0.04 : 0));
  }

  private computeNextAction(action: string): string {
    if (this.learningHistory.length === 0) return `Start with: ${action}`;
    if (this.knowledgeBase.size < 10) return `Continue learning: more examples of ${action} needed`;
    return `Advance to: expert mode for ${action}`;
  }
}

export default LipiAgent;
