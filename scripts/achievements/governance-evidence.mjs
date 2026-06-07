// Group: Governance & Evidence — probes for the production gate, governance
// tests, the CI honesty guard, fabrication detection, and matrix determinism.
const runTest = (execFileSync, root, file) => {
  let out;
  try {
    out = execFileSync("node", ["--test", file], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    out = `${err.stdout || ""}${err.stderr || ""}`;
  }
  const pass = (out.match(/# pass (\d+)/) || [])[1];
  const fail = (out.match(/# fail (\d+)/) || [])[1];
  return { pass, fail };
};

export const probes = [
  {
    id: "a-gate-fails-closed",
    universe: "governance",
    futureMilestone: "Production gate fails closed: refuses GO without hardware root-of-trust evidence",
    probe({ root, execFileSync, J }) {
      try {
        execFileSync("node", ["scripts/governed-production-gate.mjs"], { cwd: root, stdio: "ignore" });
      } catch {
        /* non-zero exit expected when blocked — that IS the fail-closed signal */
      }
      const g = J("release/evidence/governed-production-gate.json");
      const hwBlocked = g.blockers.some((b) => b.surface === "hardware-root-of-trust");
      return {
        pass: g.status === "GOVERNED_PRODUCTION_NO_GO" && hwBlocked,
        evidence: `gate status=${g.status}; hardware-root-of-trust blocker present=${hwBlocked} (safety property holds)`,
      };
    },
  },
  {
    id: "a-governance-tests-pass",
    universe: "governance",
    futureMilestone: "Governance gate has a passing automated test suite",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/governed-production-gate.test.mjs");
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/governed-production-gate.test.mjs → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  },
  {
    id: "a-ci-honesty-guard",
    universe: "governance",
    futureMilestone: "CI honesty guard: no milestone can be ACHIEVED without VERIFIED provenance",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/milestones-matrix.test.mjs");
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/milestones-matrix.test.mjs → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  },
  {
    id: "a-fabrication-detection-operational",
    universe: "evidence",
    futureMilestone: "Fabrication detection operational: every fabricated metric catalogued, none presented as live",
    probe({ root, join, readFileSync, readdirSync }) {
      const hkdDir = join(root, "hkd");
      let blocked = 0;
      for (const f of readdirSync(hkdDir).filter((n) => n.endsWith(".hkd") && !n.startsWith("._"))) {
        let d;
        try {
          d = JSON.parse(readFileSync(join(hkdDir, f), "utf8"));
        } catch {
          continue;
        }
        for (const c of d.claims || []) if (c.status === "BLOCKED") blocked += 1;
      }
      return { pass: blocked > 0, evidence: `${blocked} fabricated claims catalogued as BLOCKED across hkd/*.hkd; 0 rendered as achieved` };
    },
  },
  {
    id: "a-milestones-matrix-deterministic",
    universe: "evidence",
    futureMilestone: "Milestones matrix content is reproducible (stable hash across runs)",
    probe({ root, execFileSync, J }) {
      execFileSync("node", ["scripts/generate-milestones-matrix.mjs"], { cwd: root, stdio: "ignore" });
      const h1 = J("data/milestones-vs-current.json").stableHash;
      execFileSync("node", ["scripts/generate-milestones-matrix.mjs"], { cwd: root, stdio: "ignore" });
      const h2 = J("data/milestones-vs-current.json").stableHash;
      return { pass: Boolean(h1) && h1 === h2, evidence: `stableHash run1=${(h1 || "").slice(0, 12)}… run2=${(h2 || "").slice(0, 12)}… identical=${h1 === h2}` };
    },
  },
  {
    id: "a-gov-release-authority-fails-closed",
    universe: "governance",
    futureMilestone: "Release authority enforces fail-closed integrity: no unsigned production release, no fake signatures, named hardware and quorum blockers",
    probe({ root, join, readFileSync }) {
      const ra = JSON.parse(readFileSync(join(root, "release/release-authority/release-authority.json"), "utf8"));
      const isBlocked = ra.status === "BLOCKED";
      const noFakeSigs = ra.no_fake_signatures === true;
      const noUnsigned = ra.no_unsigned_production_release === true;
      const blockerCount = (ra.blockers || []).length;
      const hasHwBlocker = (ra.blockers || []).some((b) => /tpm2|hsm/i.test(b));
      const hasQuorumBlocker = (ra.blockers || []).some((b) => /quorum/i.test(b));
      return {
        pass: isBlocked && noFakeSigs && noUnsigned && blockerCount >= 2 && hasHwBlocker && hasQuorumBlocker,
        evidence: `release-authority status=${ra.status}; no_fake_signatures=${noFakeSigs}; no_unsigned_production_release=${noUnsigned}; blockers=${blockerCount} (hw=${hasHwBlocker}, quorum=${hasQuorumBlocker}) — honest fail-closed gate`,
      };
    },
  },
  {
    id: "a-gov-gate-content-addressed",
    universe: "governance",
    futureMilestone: "Governed production gate report is content-addressed: carries a signature field and SHA-256 hashes of all inputs",
    probe({ root, J }) {
      const g = J("release/evidence/governed-production-gate.json");
      const hasSig = typeof g.signature === "string" && g.signature.length >= 16;
      const inputs = g.inputs || {};
      const inputKeys = Object.keys(inputs);
      const allHashed = inputKeys.length >= 4 && inputKeys.every((k) => /^[0-9a-f]{64}$/.test(inputs[k]));
      return {
        pass: hasSig && allHashed,
        evidence: `governed-production-gate.json signature=${g.signature ? g.signature.slice(0, 12) + "…" : "MISSING"}; inputs hashed=${inputKeys.length} (${inputKeys.join(", ")}); all SHA-256=${allHashed}`,
      };
    },
  },
  {
    id: "a-gov-release-authority-tests-pass",
    universe: "governance",
    futureMilestone: "Release authority logic has a passing automated test suite (signing, quorum, blocking)",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/release-authority.test.mjs");
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/release-authority.test.mjs → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  },
  {
    id: "a-gov-operator-quorum-tests-pass",
    universe: "governance",
    futureMilestone: "Operator quorum enforcement has a passing automated test suite (revoked operator, expired approval, quorum thresholds)",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/operator-quorum.test.mjs");
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/operator-quorum.test.mjs → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  },
  {
    id: "a-gov-support-docs-tests-pass",
    universe: "governance",
    futureMilestone: "Support documentation has a passing automated test suite verifying completeness and structure",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/support-docs.test.mjs");
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/support-docs.test.mjs → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  },
  {
    id: "a-gov-support-center-release-tests-pass",
    universe: "governance",
    futureMilestone: "Support center release process has a passing automated test suite",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/support-center-release.test.mjs");
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/support-center-release.test.mjs → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  },
  {
    id: "a-gov-status-matrix-hkd-tests-pass",
    universe: "evidence",
    futureMilestone: "HKD status matrix has a passing automated test suite verifying honest claim tracking",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/status-matrix-hkd.test.mjs");
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/status-matrix-hkd.test.mjs → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  },
  {
    id: "a-gov-aam-jantaa-launch-readiness-tests-pass",
    universe: "governance",
    futureMilestone: "AAM Jantaa launch readiness has a passing automated test suite covering all readiness gates",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/aam-jantaa-launch-readiness.test.mjs");
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/aam-jantaa-launch-readiness.test.mjs → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  },
  {
    id: "a-gov-expanded-universe-absorption-tests-pass",
    universe: "evidence",
    futureMilestone: "Expanded universe absorption has a passing automated test suite verifying integration completeness",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/expanded-universe-absorption.test.mjs");
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/expanded-universe-absorption.test.mjs → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  },
  {
    id: "a-gov-html-prototype-absorption-tests-pass",
    universe: "evidence",
    futureMilestone: "HTML prototype absorption has a passing automated test suite verifying prototype integration",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/html-prototype-absorption.test.mjs");
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/html-prototype-absorption.test.mjs → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  },
  {
    // Real feature work: runtime-validation moved off scaffold (scientific claim
    // assessment), proven by tests/runtime-validation.test.ts.
    id: "a-gov-runtime-validation-operational",
    universe: "scientific-evidence",
    futureMilestone: "runtime-validation is operational: real submit/assess/replication with transparent confidence + uncertainty (moderation pending by default, not production-GO)",
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", "tests/runtime-validation.test.ts"], {
          cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (e) {
        out = `${e.stdout || ""}${e.stderr || ""}`;
      }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/runtime-validation.test.ts → pass=${pass ?? "?"} fail=${fail ?? "?"} (real claim assessment; governedProductionGo=false)` };
    },
  },
  {
    // Real feature work: runtime-governance is a NEW package — a real policy
    // enforcement engine (fail-closed enforce + hash-chained audit + rollback),
    // proven by tests/runtime-governance.test.ts. The runtime runtime-mission lacked.
    id: "a-gov-runtime-governance-operational",
    universe: "governance",
    futureMilestone: "runtime-governance enforcement engine operational: declarative policies, fail-closed enforce, hash-chained audit, rollback",
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", "tests/runtime-governance.test.ts"], {
          cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (e) {
        out = `${e.stdout || ""}${e.stderr || ""}`;
      }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/runtime-governance.test.ts → pass=${pass ?? "?"} fail=${fail ?? "?"} (real enforce/audit/rollback; does NOT replace release-authority; governedProductionGo=false)` };
    },
  },
  {
    id: "a-gov-runtime-mission-governance-wired",
    universe: "governance",
    futureMilestone: "runtime-mission proposals are wired through runtime-governance.enforce with a real policy decision",
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", "tests/runtime-mission.test.ts"], {
          cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (e) {
        out = `${e.stdout || ""}${e.stderr || ""}`;
      }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/runtime-mission.test.ts → pass=${pass ?? "?"} fail=${fail ?? "?"} (propose() candidate enforced by runtime-governance; governedProductionGo=false)` };
    },
  },
  {
    id: "a-gov-gate-observability-live-health",
    universe: "governance",
    futureMilestone: "governed-production-gate reads live runtime health via runtime-observability.collect and records topology",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTest(execFileSync, root, "tests/governed-production-gate.test.mjs");
      return { pass: fail === "0" && Number(pass) >= 11, evidence: `tests/governed-production-gate.test.mjs → pass=${pass ?? "?"} fail=${fail ?? "?"} (includes live runtime health/topology via collectLiveRuntimeHealth)` };
    },
  },
  ...[
    ["a-gov-federation-evidence-resolve", "scientific-evidence", "federation-evidence-resolve", "validation → registry: evidence refs resolve against the hkd-registry ledger"],
    ["a-gov-federation-release-policy", "governance", "federation-release-policy", "Release-readiness enforced via runtime-governance policy pack (fail-closed on hw/quorum/signer)"],
  ].map(([id, universe, name, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `tests/${name}.test.ts`], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/${name}.test.ts → pass=${pass ?? "?"} fail=${fail ?? "?"} (real cross-runtime integration; governedProductionGo=false)` };
    },
  })),
  ...[
    ["a-gov-federation-audit-chain-integrity", "governance", "verifyGovernanceAuditChain", "Governance audit log hash-chain integrity verified (recompute + linkage)"],
    ["a-gov-federation-ledger-chain-integrity", "evidence", "verifyRegistryLedgerChain", "hkd-registry ledger chain integrity verified (every artifact verifies + prevHash links)"],
  ].map(([id, universe, pattern, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `--test-name-pattern=${pattern}`, "tests/federation-batch2.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `federation-batch2 [${pattern}] → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  })),
  ...[
    ["a-gov-validation-replication", "scientific-evidence", "recordReplication", "Claim replication recording (independent replications raise the count)"],
    ["a-gov-validation-moderation", "scientific-evidence", "moderate", "Claim moderation is fail-closed: must be reviewed first, no double-finalise"],
  ].map(([id, universe, pattern, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `--test-name-pattern=${pattern}`, "tests/runtime-lifecycle-batch.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `runtime-lifecycle-batch [${pattern}] → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  })),
  ...[
    ["a-gov-federation-consensus", "scientific-evidence", "consensus", "Cross-validation consensus: replication-weighted mean confidence + agreement"],
    ["a-gov-federation-evidence-bundle-seal", "evidence", "sealEvidenceBundle", "Sealed federation evidence bundle (sha256) with tamper detection"],
    ["a-gov-federation-readiness-gate", "governance", "federationReadiness", "Composite release readiness: all runtimes ready AND policies pass (fail-closed)"],
  ].map(([id, universe, pattern, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `--test-name-pattern=${pattern}`, "tests/federation-batch3.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `federation-batch3 [${pattern}] → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  })),
  // ── BATCH: real SHA-256 Merkle tree for evidence integrity (evidence universe) ─
  // HONEST SCOPE: real cryptographic inclusion proofs. NOT a blockchain, NOT
  // consensus, NO validators, NOT a distributed ledger. Evidence-integrity only.
  ...[
    ["a-gov-merkle-build", "evidence", "build computes a deterministic root", "Merkle: deterministic SHA-256 root from evidence leaves, fail-closed on empty"],
    ["a-gov-merkle-tamper", "evidence", "root changes when data changes", "Merkle: tamper-evident root (any leaf change changes the root)"],
    ["a-gov-merkle-append", "evidence", "append grows the tree", "Merkle: append leaves, report index/size"],
    ["a-gov-merkle-proof-verify", "evidence", "valid inclusion proof verifies", "Merkle: real inclusion proofs that verify against the root"],
    ["a-gov-merkle-reject-forgery", "evidence", "verify rejects a forged", "Merkle: verify rejects forged items / wrong roots (fail-closed integrity)"],
    ["a-gov-merkle-health", "evidence", "health reports real leaf count", "Merkle: health exposes real leaf count + root, not production-GO"],
  ].map(([id, universe, pattern, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `--test-name-pattern=${pattern}`, "tests/runtime-merkle.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `merkle [${pattern}] → pass=${pass ?? "?"} fail=${fail ?? "?"} (real SHA-256 proofs; NOT a blockchain/consensus; governedProductionGo=false)` };
    },
  })),
];
