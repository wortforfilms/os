import type { VisualHKD, VisualHKDValidationResult } from "./types.ts";

export function validateVisualHKDStatus(hkd: VisualHKD): VisualHKDValidationResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  const allItems = [
    ...hkd.sections,
    ...hkd.nodes,
    ...hkd.edges,
    ...hkd.widgets,
    ...hkd.claims,
    ...hkd.evidence
  ];

  for (const item of allItems) {
    if (!item.sourceImage) failures.push(`missing sourceImage on ${"id" in item ? item.id : "edge"}`);
    if (item.confidence < 0.7) warnings.push(`low confidence extraction: ${"id" in item ? item.id : `${item.from}->${item.to}`}`);
  }

  for (const node of hkd.nodes) {
    if (!node.sourceSectionId) warnings.push(`node has no source panel: ${node.id}`);
  }

  for (const claim of hkd.claims) {
    if (claim.status !== "BLOCKED" && claim.status !== "UNVERIFIED" && claim.status !== "PARTIAL") {
      failures.push(`unsupported claim status: ${claim.id}`);
    }
    if (/verified|certified|production|scientific/i.test(claim.text) && !claim.blockedReason) {
      failures.push(`operational claim lacks blocked reason: ${claim.id}`);
    }
  }

  return {
    pass: failures.length === 0,
    productionReady: false,
    phkdVerdict: failures.length === 0 ? "PASS" : "BLOCKED",
    finalStatus: "GOVERNED_PRODUCTION_NO_GO",
    failures,
    warnings
  };
}
