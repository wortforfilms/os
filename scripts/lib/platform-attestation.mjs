/*
 * Fail-closed host/platform attestation for the HKD Lipi Registry.
 *
 * Rule (PHKD): a Phase 25 platform target may only be treated as host-attested
 * VERIFIED if the record's OWN captured host metadata proves that platform.
 *   - macOS VERIFIED  ⇒ requires nodePlatform=darwin, uname starts "Darwin",
 *                       and a known swVers (sw_vers output, not UNKNOWN).
 *   - Linux VERIFIED  ⇒ requires nodePlatform=linux, uname starts "Linux".
 *   - Windows VERIFIED⇒ requires nodePlatform=win32 (uname "Windows"/MINGW/MSYS).
 * If the claimed status is VERIFIED but host metadata proves a DIFFERENT platform
 * → CONFLICT. If VERIFIED but host metadata is absent/UNKNOWN → UNKNOWN.
 * If the claimed status is not VERIFIED → it passes through (BLOCKED/UNKNOWN).
 *
 * This module NEVER rewrites registry rows, never sets productionReady=true, and
 * never enables runtime rows. It only classifies attestation. Single source of
 * truth shared by the probe, the evidence generator, and the test.
 */
export const PLATFORM_RULES = {
  macos: { nodePlatform: "darwin", unamePrefix: "Darwin", requireSwVers: true },
  linux: { nodePlatform: "linux", unamePrefix: "Linux", requireSwVers: false },
  windows: { nodePlatform: "win32", unamePrefix: "Windows", requireSwVers: false },
};

const hasHostMetadata = (p) => typeof p.nodePlatform === "string" && p.nodePlatform.length > 0 && typeof p.uname === "string" && p.uname.length > 0;

function classifyPlatform(p) {
  const id = String(p.id || "").toLowerCase();
  const rule = PLATFORM_RULES[id];
  const claimedStatus = p.status || "UNKNOWN";

  // Non-VERIFIED claims pass through honestly (already blocked/unknown upstream).
  if (claimedStatus !== "VERIFIED") {
    return {
      id,
      label: p.label || id,
      claimedStatus,
      attestation: claimedStatus === "BLOCKED" ? "BLOCKED" : "UNKNOWN",
      hostAttested: false,
      reason: p.reason || `claimed status is ${claimedStatus}; not a VERIFIED claim`,
    };
  }

  if (!rule) {
    return { id, label: p.label || id, claimedStatus, attestation: "UNKNOWN", hostAttested: false, reason: `unknown platform id '${id}'` };
  }

  if (!hasHostMetadata(p)) {
    return { id, label: p.label || id, claimedStatus, attestation: "UNKNOWN", hostAttested: false, reason: "claimed VERIFIED but no host metadata (nodePlatform/uname) captured" };
  }

  const nodeMatch = p.nodePlatform === rule.nodePlatform;
  const unameMatch = typeof p.uname === "string" && p.uname.trim().startsWith(rule.unamePrefix);
  const swVersKnown = !rule.requireSwVers || (typeof p.swVers === "string" && p.swVers.length > 0 && p.swVers !== "UNKNOWN");

  if (nodeMatch && unameMatch && swVersKnown) {
    return {
      id,
      label: p.label || id,
      claimedStatus,
      attestation: "VERIFIED",
      hostAttested: true,
      reason: `host metadata proves ${id} (nodePlatform=${p.nodePlatform}, uname~"${rule.unamePrefix}"${rule.requireSwVers ? `, swVers=${p.swVers}` : ""})`,
    };
  }

  // VERIFIED claim contradicted by host metadata → CONFLICT (fail closed).
  const mism = [];
  if (!nodeMatch) mism.push(`nodePlatform=${p.nodePlatform} (expected ${rule.nodePlatform})`);
  if (!unameMatch) mism.push(`uname="${String(p.uname).slice(0, 24)}…" (expected prefix ${rule.unamePrefix})`);
  if (!swVersKnown) mism.push(`swVers=${p.swVers ?? "missing"} (expected a known sw_vers)`);
  return {
    id,
    label: p.label || id,
    claimedStatus,
    attestation: "CONFLICT",
    hostAttested: false,
    reason: `claimed VERIFIED but host metadata proves otherwise: ${mism.join("; ")}`,
  };
}

/**
 * Evaluate a Phase 25 cross-platform evidence object. Pure; no I/O, no mutation.
 * Returns the per-platform attestation, blockers, and a fail-closed roll-up.
 */
export function evaluatePlatformAttestation(phase25) {
  const targets = Array.isArray(phase25?.platforms) ? phase25.platforms : [];
  const platforms = targets.map(classifyPlatform);

  const conflicts = platforms.filter((p) => p.attestation === "CONFLICT");
  const verified = platforms.filter((p) => p.attestation === "VERIFIED");
  const blocked = platforms.filter((p) => p.attestation === "BLOCKED");
  const unknown = platforms.filter((p) => p.attestation === "UNKNOWN");

  const blockers = [];
  for (const c of conflicts) blockers.push(`${c.id}: ${c.reason}`);
  for (const b of blocked) blockers.push(`${b.id}: ${b.reason}`);
  for (const u of unknown) blockers.push(`${u.id}: ${u.reason}`);

  // Fail closed: attestation passes ONLY if every target is host-attested VERIFIED
  // with zero conflicts. With macOS-on-Linux that is false today.
  const attestationPass = targets.length > 0 && conflicts.length === 0 && blocked.length === 0 && unknown.length === 0 && verified.length === targets.length;

  return {
    platforms,
    counts: { targets: targets.length, verified: verified.length, conflict: conflicts.length, blocked: blocked.length, unknown: unknown.length },
    blockers,
    attestationPass,
    // These invariants are constants of this audit hardening — never promoted here.
    productionReady: false,
    governedProductionGo: false,
    runtimeEnabledRows: 0,
    phkdVerdict: "CONTROLLED_PREVIEW_NO_GO",
  };
}
