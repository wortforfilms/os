// Human-reviewed remediation registry for the milestones auto-loop.
//
// PHKD RULE (overriding): a milestone may ONLY advance to ACHIEVED when a real,
// human-authored probe under scripts/achievements/*.mjs passes against real
// artifacts. This registry does NOT add probes and does NOT mark anything
// achieved. Each entry is a *human-reviewed* remediation that attempts to build
// or repair the REAL artifact a milestone describes, so that an existing probe
// can pass for real reasons. The loop then re-runs the honest verification cycle
// to confirm — fail closed otherwise.
//
// Forbidden by directive (do NOT add such entries):
//   - stubbing an artifact purely to flip a probe ("fabrication-by-stub")
//   - satisfying fabricated marketing targets (e.g. "15,000+ glyphs",
//     "thousands of sources", "World's most advanced", invented counts)
//   - auto-adding new achievement probes (those require human-audited review)
//
// Rollback note: some user mounts deny file deletion. Prefer remediations that
// MODIFY existing tracked files (fully restorable) over creating new files; new
// files that fail verification are truncated and reported as orphans for a human.
//
// Entry contract — keyed by the milestone/claim id (matches matrix milestone.id):
//   {
//     claimId:  string,            // the HKD claim / milestone id to advance
//     probeId:  string,            // existing probe id (in scripts/achievements)
//                                  // expected to pass after the fix
//     touches:  string[],          // repo-relative paths the fix may create/modify
//                                  // (used for snapshot + rollback — keep tight)
//     note:     string,            // why this is honest, not a stub
//     reviewedBy: string,          // human who audited this remediation
//     async fix(ctx) {             // ctx = { root, join, fs, execFileSync }
//       // create/repair the REAL artifact; return { changed: boolean }
//       return { changed: true };
//     },
//   }
//
// The map ships EMPTY on purpose. With no entries the loop runs, finds every
// candidate SKIPPED_NO_REMEDIATION, advances nothing, and the honesty guard
// stays green — the correct fail-closed outcome until a human registers a
// reviewed remediation below.

/** @type {Record<string, object>} */
export const remediations = {
  // ── EXAMPLE (commented, inert) ───────────────────────────────────────────
  // "a-resolve-rt-knowledge-active": {
  //   claimId: "a-resolve-rt-knowledge-active",
  //   probeId: "a-resolve-kh-rt-knowledge-active",
  //   touches: ["packages/knowledge-runtime/package.json"],
  //   reviewedBy: "<human reviewer>",
  //   note: "Only valid if a REAL @maataa/knowledge-runtime is implemented — "
  //       + "not an empty stub. Do not register until the runtime genuinely exists.",
  //   async fix() { return { changed: false }; },
  // },
};

export default remediations;
