"use strict";

// Evidence Agent.
//
// A real worker that registers itself in the agent runtime and sweeps every
// runtime in the repo, capturing GENUINE evidence. It does not fabricate: a
// runtime is only marked VERIFIED if a command actually ran and passed; PARTIAL
// if real source/tests/build exist but could not be executed here; UNVERIFIED
// if there is nothing executable to back it.

const { existsSync, readdirSync, statSync } = require("node:fs");
const { join } = require("node:path");
const { execSync } = require("node:child_process");

const EVIDENCE_AGENT = {
  id: "agent-evidence",
  slug: "evidence",
  name: "Evidence Agent",
  kind: "agent",
  role: "Collects genuine runtime evidence; refuses to fabricate proof",
};

function dirHas(path, names) {
  return names.some((n) => existsSync(join(path, n)));
}

function countSourceFiles(path, limit = 5000) {
  let count = 0;
  const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".cjs", ".mjs", ".py", ".rs"]);
  const walk = (dir, depth) => {
    if (count >= limit || depth > 4) return;
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith("._") || e.name === "node_modules" || e.name === ".git") continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (exts.has(e.name.slice(e.name.lastIndexOf(".")))) count++;
      if (count >= limit) return;
    }
  };
  walk(path, 0);
  return count;
}

// Assess a single runtime honestly.
function assessRuntime(rt) {
  const { path } = rt;
  if (!existsSync(path)) {
    return { status: "UNVERIFIED", detail: "Path not found.", sourceFiles: 0 };
  }
  const sourceFiles = countSourceFiles(path);
  const hasPkg = existsSync(join(path, "package.json"));
  const hasBuild = dirHas(path, ["dist", ".next", "build", "out"]);

  // If a verification command is declared, actually run it — that's real evidence.
  if (rt.verifyCmd) {
    try {
      const out = execSync(rt.verifyCmd, { cwd: rt.cwd || path, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 });
      const passMatch = out.match(/# pass (\d+)/);
      const failMatch = out.match(/# fail (\d+)/);
      const pass = passMatch ? Number(passMatch[1]) : null;
      const fail = failMatch ? Number(failMatch[1]) : null;
      if (fail === 0 && pass > 0) {
        return { status: "VERIFIED", detail: `Ran \`${rt.verifyCmd}\` — ${pass}/${pass} tests pass.`, sourceFiles, tests: { pass, fail } };
      }
      return { status: "PARTIAL", detail: `Ran \`${rt.verifyCmd}\` but pass=${pass} fail=${fail}.`, sourceFiles, tests: { pass, fail } };
    } catch (err) {
      return { status: "PARTIAL", detail: `Verify command failed/unavailable: ${String(err.message).split("\n")[0].slice(0, 120)}`, sourceFiles };
    }
  }

  // No runnable command: classify by what genuinely exists.
  if (!hasPkg && sourceFiles === 0) {
    return { status: "UNVERIFIED", detail: "Empty/stub — no package.json and no source files.", sourceFiles };
  }
  if (!hasPkg) {
    return { status: "UNVERIFIED", detail: `Partial backup — ${sourceFiles} source files but no package.json, so it cannot be built or run here.`, sourceFiles, hasBuild };
  }
  return { status: "PARTIAL", detail: `Has package.json${hasBuild ? " + build output" : ""}; not executed in this sweep.`, sourceFiles, hasBuild };
}

// Run the full sweep through a supervisor: the Evidence Agent registers,
// then records one real task per runtime (completed = produced evidence,
// failed = could not verify).
function runEvidenceSweep(supervisor, runtimes) {
  supervisor.store.register(EVIDENCE_AGENT);
  supervisor.start("evidence");

  const results = [];
  for (const rt of runtimes) {
    const assessment = assessRuntime(rt);
    // Verified/partial counts as evidence produced; unverified is an honest fail.
    const taskStatus = assessment.status === "UNVERIFIED" ? "failed" : "completed";
    supervisor.delegate("evidence", taskStatus);
    results.push({ runtime: rt.name, path: rt.rel || rt.path, ...assessment });
  }
  return { agent: EVIDENCE_AGENT.slug, sweptAt: new Date().toISOString(), results };
}

module.exports = { EVIDENCE_AGENT, assessRuntime, runEvidenceSweep };
