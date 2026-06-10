// Resolution probes for agent HKD claims.
//
// PHKD scope: this only resolves the exact local claim "Active Agents: 12".
// It does not claim deployed agents, marketplace scale, 24h production traffic,
// autonomous evolution, or production readiness.

const runTest = (execFileSync, root, file) => {
  let out;
  try {
    out = execFileSync(process.execPath, ["--test", file], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    out = `${err.stdout || ""}${err.stderr || ""}`;
  }
  const pass = Number((out.match(/# pass (\d+)/) || [])[1] ?? 0);
  const fail = Number((out.match(/# fail (\d+)/) || [])[1] ?? 1);
  return { pass, fail };
};

export const probes = [
  {
    id: "a-resolve-agent-active-agents-12",
    universe: "agent",
    resolves: "c-active-agents-12",
    futureMilestone: "Active Agents: 12 is locally verified by registry rows plus real heartbeats",
    probe({ root, J, execFileSync }) {
      const evidence = J("release/evidence/agent-runtime.json");
      const { pass, fail } = runTest(execFileSync, root, "tests/agent-registry.test.mjs");
      const localVerified = Array.isArray(evidence.claimSplit?.LOCAL_VERIFIED)
        && evidence.claimSplit.LOCAL_VERIFIED.some((item) => item.includes("heartbeats"));
      const blockedScale = Array.isArray(evidence.claimSplit?.BLOCKED)
        && evidence.claimSplit.BLOCKED.some((item) => item.includes("No deployed-agent count"));
      const ok = evidence.claim === "c-active-agents-12"
        && evidence.verificationStatus === "PASS"
        && evidence.activeAgents === 12
        && evidence.registeredAgents === 12
        && localVerified
        && blockedScale
        && fail === 0
        && pass >= 8;

      return {
        pass: ok,
        evidence: ok
          ? `tests/agent-registry.test.mjs → pass=${pass} fail=${fail}; release/evidence/agent-runtime.json activeAgents=12 from heartbeat-backed local registry; deployed/marketplace/production traffic remain BLOCKED`
          : `agent active-count evidence incomplete: test pass=${pass} fail=${fail}; claim=${evidence.claim}; active=${evidence.activeAgents}; registered=${evidence.registeredAgents}; status=${evidence.verificationStatus}`,
      };
    },
  },
];
