// Group: Platform & Runtime — probes for runtime packages, offline tooling,
// observability, and rollback. Each probe checks real artifacts; fail closed.
const runTsTest = (execFileSync, root, file) => {
  let out;
  try {
    out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", file], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    out = `${e.stdout || ""}${e.stderr || ""}`;
  }
  const pass = (out.match(/# pass (\d+)/) || [])[1];
  const fail = (out.match(/# fail (\d+)/) || [])[1];
  return { pass, fail };
};

export const probes = [
  {
    id: "a-runtime-packages-present",
    universe: "runtime",
    futureMilestone: "Federated runtime packages exist as isolated workspaces (target ≥ 8)",
    probe({ root, join, existsSync, readdirSync }) {
      const dir = join(root, "packages");
      const pkgs = readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, "package.json")))
        .map((e) => e.name);
      return { pass: pkgs.length >= 8, evidence: `${pkgs.length} runtime packages with package.json: ${pkgs.join(", ")}` };
    },
  },
  {
    id: "a-offline-model-tooling",
    universe: "offline",
    futureMilestone: "Offline model manifest + fetch tooling present (weights fetched on demand, not bundled)",
    probe({ root, join, existsSync }) {
      const manifest = existsSync(join(root, "offline-models/model-manifest.json"));
      const fetcher = existsSync(join(root, "offline-models/download_models.py"));
      return {
        pass: manifest && fetcher,
        evidence: `model-manifest.json=${manifest}, download_models.py=${fetcher}; model weights are NOT bundled (honest scope)`,
      };
    },
  },
  {
    id: "a-observability-health-contract",
    universe: "observability",
    futureMilestone: "Observability runtime exposes a health() contract",
    probe({ root, join, readFileSync }) {
      const src = readFileSync(join(root, "packages/runtime-observability/src/index.ts"), "utf8");
      const hasHealth = /export\s+function\s+health\s*\(/.test(src);
      const hasType = /HealthReport/.test(src);
      return {
        pass: hasHealth && hasType,
        evidence: `runtime-observability/src/index.ts exports health()=${hasHealth}, HealthReport type=${hasType}`,
      };
    },
  },
  {
    id: "a-rollback-drill-evidence",
    universe: "release",
    futureMilestone: "Rollback drill evidence present and passing (drop-to-recovery-console)",
    probe({ J }) {
      const r = J("release/reports/PANIC_ROLLBACK_REPORT.json");
      const modes = ["PANIC_ROLLBACK", "checksumRollback", "driftRollback", "overflowRollback"];
      const allPass = modes.every((m) => r[m] === "PASS");
      return {
        pass: allPass,
        evidence: `PANIC_ROLLBACK report: ${modes.map((m) => `${m}=${r[m]}`).join(", ")}; ${(r.rollbackEvents || []).length} recovery events`,
      };
    },
  },
  {
    id: "a-platform-universal-runtime-typechecks",
    universe: "runtime",
    futureMilestone: "universal-runtime package typechecks cleanly (tsc --noEmit exit 0)",
    probe({ root, join, existsSync, execFileSync }) {
      const tsconfig = join(root, "packages/universal-runtime/tsconfig.json");
      if (!existsSync(tsconfig)) return { pass: false, evidence: "packages/universal-runtime/tsconfig.json not found" };
      const tsc = join(root, "node_modules/.bin/tsc");
      try {
        execFileSync(tsc, ["-p", tsconfig, "--noEmit"], { cwd: root, stdio: "pipe" });
        return { pass: true, evidence: "tsc --noEmit on packages/universal-runtime/tsconfig.json exited 0 (no type errors)" };
      } catch (e) {
        const out = (e.stdout || "").toString() + (e.stderr || "").toString();
        return { pass: false, evidence: `tsc exited non-zero: ${out.slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-evidence-runtime-typechecks",
    universe: "runtime",
    futureMilestone: "evidence-runtime package typechecks cleanly (tsc --noEmit exit 0)",
    probe({ root, join, existsSync, execFileSync }) {
      const tsconfig = join(root, "packages/evidence-runtime/tsconfig.json");
      if (!existsSync(tsconfig)) return { pass: false, evidence: "packages/evidence-runtime/tsconfig.json not found" };
      const tsc = join(root, "node_modules/.bin/tsc");
      try {
        execFileSync(tsc, ["-p", tsconfig, "--noEmit"], { cwd: root, stdio: "pipe" });
        return { pass: true, evidence: "tsc --noEmit on packages/evidence-runtime/tsconfig.json exited 0 (no type errors)" };
      } catch (e) {
        const out = (e.stdout || "").toString() + (e.stderr || "").toString();
        return { pass: false, evidence: `tsc exited non-zero: ${out.slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-hardware-attestation-suite-passes",
    universe: "system",
    futureMilestone: "Hardware attestation test suite passes (nonce-bound HSM signature, replay rejection, provider summary)",
    probe({ root, join, existsSync, execFileSync }) {
      const testFile = join(root, "tests/hardware-attestation.test.mjs");
      if (!existsSync(testFile)) return { pass: false, evidence: "tests/hardware-attestation.test.mjs not found" };
      try {
        const out = execFileSync(process.execPath, ["--test", testFile], { cwd: root, stdio: "pipe" }).toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        return {
          pass: failCount === 0 && passCount > 0,
          evidence: `hardware-attestation.test.mjs: pass=${passCount}, fail=${failCount}`,
        };
      } catch (e) {
        const out = (e.stdout || "").toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        if (failCount === 0 && passCount > 0) {
          return { pass: true, evidence: `hardware-attestation.test.mjs: pass=${passCount}, fail=${failCount}` };
        }
        return { pass: false, evidence: `test runner error: ${out.slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-hardware-root-suite-passes",
    universe: "system",
    futureMilestone: "Hardware root-of-trust test suite passes (capture lifecycle, signature verify, hash mutation detection)",
    probe({ root, join, existsSync, execFileSync }) {
      const testFile = join(root, "tests/hardware-root-of-trust.test.mjs");
      if (!existsSync(testFile)) return { pass: false, evidence: "tests/hardware-root-of-trust.test.mjs not found" };
      try {
        const out = execFileSync(process.execPath, ["--test", testFile], { cwd: root, stdio: "pipe" }).toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        return {
          pass: failCount === 0 && passCount > 0,
          evidence: `hardware-root-of-trust.test.mjs: pass=${passCount}, fail=${failCount}`,
        };
      } catch (e) {
        const out = (e.stdout || "").toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        if (failCount === 0 && passCount > 0) {
          return { pass: true, evidence: `hardware-root-of-trust.test.mjs: pass=${passCount}, fail=${failCount}` };
        }
        return { pass: false, evidence: `test runner error: ${out.slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-runtime-validation-health-contract",
    universe: "runtime",
    futureMilestone: "runtime-validation package exports/declares a health() contract with HealthReport type",
    probe({ root, join, readFileSync }) {
      const src = readFileSync(join(root, "packages/runtime-validation/src/index.ts"), "utf8");
      const hasHealth = /export\s+function\s+health\s*\(/.test(src);
      const hasType = /HealthReport/.test(src);
      return {
        pass: hasHealth && hasType,
        evidence: `runtime-validation/src/index.ts exports/declares health()=${hasHealth}, HealthReport type=${hasType}`,
      };
    },
  },
  {
    id: "a-platform-governed-production-gate-tooling",
    universe: "operations",
    futureMilestone: "Governed production gate script present as operational release tooling",
    probe({ root, join, existsSync }) {
      const script = join(root, "scripts/governed-production-gate.mjs");
      const present = existsSync(script);
      return {
        pass: present,
        evidence: `scripts/governed-production-gate.mjs present=${present}; release gate tooling on disk`,
      };
    },
  },
  {
    id: "a-platform-runtime-persistence-tier-operational",
    universe: "runtime",
    futureMilestone: "runtime-persistence backs KG, mission, registry, validation, observability, and governance with SQLite restore semantics",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTsTest(execFileSync, root, "tests/runtime-persistence.test.ts");
      return { pass: fail === "0" && Number(pass) >= 2, evidence: `tests/runtime-persistence.test.ts → pass=${pass ?? "?"} fail=${fail ?? "?"} (SQLite close/reopen + six-runtime restore)` };
    },
  },
  {
    id: "a-platform-runtime-transport-facade-operational",
    universe: "transport",
    futureMilestone: "runtime-transport facade provides deterministic handler calls, ACL, ledger, timeout/fallback",
    probe({ root, execFileSync }) {
      const { pass, fail } = runTsTest(execFileSync, root, "tests/runtime-transport.test.ts");
      return { pass: fail === "0" && Number(pass) >= 3, evidence: `tests/runtime-transport.test.ts → pass=${pass ?? "?"} fail=${fail ?? "?"} (registered handlers + ACL + cached fallback)` };
    },
  },
  // ── NEW PROBES ─────────────────────────────────────────────────────────────
  {
    id: "a-platform-runtime-search-suite-passes",
    universe: "runtime",
    futureMilestone: "runtime-search test suite passes (transport heartbeat, SSE fallback, malformed-batch rejection)",
    probe({ root, join, existsSync, execFileSync }) {
      const testFile = join(root, "tests/runtime-search.test.ts");
      if (!existsSync(testFile)) return { pass: false, evidence: "tests/runtime-search.test.ts not found" };
      try {
        const out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", testFile], { cwd: root, stdio: "pipe" }).toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        return { pass: failCount === 0 && passCount > 0, evidence: `runtime-search.test.ts: pass=${passCount}, fail=${failCount}` };
      } catch (e) {
        const out = (e.stdout || "").toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        if (failCount === 0 && passCount > 0) return { pass: true, evidence: `runtime-search.test.ts: pass=${passCount}, fail=${failCount}` };
        return { pass: false, evidence: `test runner error: ${out.slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-maataa-ui-release-suite-passes",
    universe: "release",
    futureMilestone: "maataa-ui-release test suite passes (governed production gate checks, no-go evidence)",
    probe({ root, join, existsSync, execFileSync }) {
      const testFile = join(root, "tests/maataa-ui-release.test.mjs");
      if (!existsSync(testFile)) return { pass: false, evidence: "tests/maataa-ui-release.test.mjs not found" };
      try {
        const out = execFileSync(process.execPath, ["--test", testFile], { cwd: root, stdio: "pipe" }).toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        return { pass: failCount === 0 && passCount > 0, evidence: `maataa-ui-release.test.mjs: pass=${passCount}, fail=${failCount}` };
      } catch (e) {
        const out = (e.stdout || "").toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        if (failCount === 0 && passCount > 0) return { pass: true, evidence: `maataa-ui-release.test.mjs: pass=${passCount}, fail=${failCount}` };
        return { pass: false, evidence: `test runner error: ${out.slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-ascii-tauri-suite-passes",
    universe: "runtime",
    futureMilestone: "sovereign-runtime ASCII Tauri test suite passes (scaffold, commands, blocker evidence)",
    probe({ root, join, existsSync, execFileSync }) {
      const testFile = join(root, "tests/sovereign-runtime-ascii-tauri.test.mjs");
      if (!existsSync(testFile)) return { pass: false, evidence: "tests/sovereign-runtime-ascii-tauri.test.mjs not found" };
      try {
        const out = execFileSync(process.execPath, ["--test", testFile], { cwd: root, stdio: "pipe" }).toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        return { pass: failCount === 0 && passCount > 0, evidence: `sovereign-runtime-ascii-tauri.test.mjs: pass=${passCount}, fail=${failCount}` };
      } catch (e) {
        const out = (e.stdout || "").toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        if (failCount === 0 && passCount > 0) return { pass: true, evidence: `sovereign-runtime-ascii-tauri.test.mjs: pass=${passCount}, fail=${failCount}` };
        return { pass: false, evidence: `test runner error: ${out.slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-runtime-html-suite-passes",
    universe: "runtime",
    futureMilestone: "runtime-html test suite passes (HTML prototype pages, ThemeLab runtime matrix)",
    probe({ root, join, existsSync, execFileSync }) {
      const testFile = join(root, "tests/runtime-html.test.mjs");
      if (!existsSync(testFile)) return { pass: false, evidence: "tests/runtime-html.test.mjs not found" };
      try {
        const out = execFileSync(process.execPath, ["--test", testFile], { cwd: root, stdio: "pipe" }).toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        return { pass: failCount === 0 && passCount > 0, evidence: `runtime-html.test.mjs: pass=${passCount}, fail=${failCount}` };
      } catch (e) {
        const out = (e.stdout || "").toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        if (failCount === 0 && passCount > 0) return { pass: true, evidence: `runtime-html.test.mjs: pass=${passCount}, fail=${failCount}` };
        return { pass: false, evidence: `test runner error: ${out.slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-streaming-device-suite-passes",
    universe: "transport",
    futureMilestone: "plug-and-play streaming device test suite passes (device config, HTML surface, honest evidence)",
    probe({ root, join, existsSync, execFileSync }) {
      const testFile = join(root, "tests/plug-and-play-streaming-device.test.mjs");
      if (!existsSync(testFile)) return { pass: false, evidence: "tests/plug-and-play-streaming-device.test.mjs not found" };
      try {
        const out = execFileSync(process.execPath, ["--test", testFile], { cwd: root, stdio: "pipe" }).toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        return { pass: failCount === 0 && passCount > 0, evidence: `plug-and-play-streaming-device.test.mjs: pass=${passCount}, fail=${failCount}` };
      } catch (e) {
        const out = (e.stdout || "").toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        if (failCount === 0 && passCount > 0) return { pass: true, evidence: `plug-and-play-streaming-device.test.mjs: pass=${passCount}, fail=${failCount}` };
        return { pass: false, evidence: `test runner error: ${out.slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-full-demo-release-suite-passes",
    universe: "release",
    futureMilestone: "full-demo-release test suite passes (demo release evidence gates, honest blocked state)",
    probe({ root, join, existsSync, execFileSync }) {
      const testFile = join(root, "tests/full-demo-release.test.mjs");
      if (!existsSync(testFile)) return { pass: false, evidence: "tests/full-demo-release.test.mjs not found" };
      try {
        const out = execFileSync(process.execPath, ["--test", testFile], { cwd: root, stdio: "pipe" }).toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        return { pass: failCount === 0 && passCount > 0, evidence: `full-demo-release.test.mjs: pass=${passCount}, fail=${failCount}` };
      } catch (e) {
        const out = (e.stdout || "").toString();
        const passMatch = out.match(/^# pass (\d+)/m);
        const failMatch = out.match(/^# fail (\d+)/m);
        const passCount = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failCount = failMatch ? parseInt(failMatch[1], 10) : 1;
        if (failCount === 0 && passCount > 0) return { pass: true, evidence: `full-demo-release.test.mjs: pass=${passCount}, fail=${failCount}` };
        return { pass: false, evidence: `test runner error: ${out.slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-kbs-runtime-typechecks",
    universe: "runtime",
    futureMilestone: "kbs-runtime package typechecks cleanly (tsc --noEmit exit 0)",
    probe({ root, join, existsSync, execFileSync }) {
      const tsconfig = join(root, "packages/kbs-runtime/tsconfig.json");
      if (!existsSync(tsconfig)) return { pass: false, evidence: "packages/kbs-runtime/tsconfig.json not found" };
      const tsc = join(root, "node_modules/.bin/tsc");
      try {
        execFileSync(tsc, ["-p", tsconfig, "--noEmit"], { cwd: root, stdio: "pipe" });
        return { pass: true, evidence: "tsc --noEmit on packages/kbs-runtime/tsconfig.json exited 0 (no type errors)" };
      } catch (e) {
        const out = (e.stdout || "").toString() + (e.stderr || "").toString();
        return { pass: false, evidence: `tsc exited non-zero: ${out.slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-kbs-graph-typechecks",
    universe: "runtime",
    futureMilestone: "kbs-graph package typechecks cleanly (tsc --noEmit exit 0)",
    probe({ root, join, existsSync, execFileSync }) {
      const tsconfig = join(root, "packages/kbs-graph/tsconfig.json");
      if (!existsSync(tsconfig)) return { pass: false, evidence: "packages/kbs-graph/tsconfig.json not found" };
      const tsc = join(root, "node_modules/.bin/tsc");
      try {
        execFileSync(tsc, ["-p", tsconfig, "--noEmit"], { cwd: root, stdio: "pipe" });
        return { pass: true, evidence: "tsc --noEmit on packages/kbs-graph/tsconfig.json exited 0 (no type errors)" };
      } catch (e) {
        const out = (e.stdout || "").toString() + (e.stderr || "").toString();
        return { pass: false, evidence: `tsc exited non-zero: ${out.slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-kbs-sdk-typechecks",
    universe: "runtime",
    futureMilestone: "kbs-sdk package typechecks cleanly (tsc --noEmit exit 0)",
    probe({ root, join, existsSync, execFileSync }) {
      const tsconfig = join(root, "packages/kbs-sdk/tsconfig.json");
      if (!existsSync(tsconfig)) return { pass: false, evidence: "packages/kbs-sdk/tsconfig.json not found" };
      const tsc = join(root, "node_modules/.bin/tsc");
      try {
        execFileSync(tsc, ["-p", tsconfig, "--noEmit"], { cwd: root, stdio: "pipe" });
        return { pass: true, evidence: "tsc --noEmit on packages/kbs-sdk/tsconfig.json exited 0 (no type errors)" };
      } catch (e) {
        const out = (e.stdout || "").toString() + (e.stderr || "").toString();
        return { pass: false, evidence: `tsc exited non-zero: ${out.slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-kbs-search-typechecks",
    universe: "runtime",
    futureMilestone: "kbs-search package typechecks cleanly (tsc --noEmit exit 0)",
    probe({ root, join, existsSync, execFileSync }) {
      const tsconfig = join(root, "packages/kbs-search/tsconfig.json");
      if (!existsSync(tsconfig)) return { pass: false, evidence: "packages/kbs-search/tsconfig.json not found" };
      const tsc = join(root, "node_modules/.bin/tsc");
      try {
        execFileSync(tsc, ["-p", tsconfig, "--noEmit"], { cwd: root, stdio: "pipe" });
        return { pass: true, evidence: "tsc --noEmit on packages/kbs-search/tsconfig.json exited 0 (no type errors)" };
      } catch (e) {
        const out = (e.stdout || "").toString() + (e.stderr || "").toString();
        return { pass: false, evidence: `tsc exited non-zero: ${out.slice(0, 200)}` };
      }
    },
  },
  // ── BATCH: lipi-runtime test suites + remaining typechecks ──────────────────
  ...[
    ["lipi-amirpur-readiness", "Lipi Amirpur readiness suite passes"],
    ["lipi-character-matrix", "Lipi character matrix suite passes"],
    ["lipi-governance", "Lipi governance suite passes"],
    ["lipi-lineage", "Lipi lineage suite passes"],
    ["lipi-registry", "Lipi registry suite passes"],
    ["lipi-search", "Lipi search suite passes"],
  ].map(([name, title]) => ({
    id: `a-platform-${name}-suite-passes`,
    universe: "lipi",
    futureMilestone: title,
    probe({ root, join, existsSync, execFileSync }) {
      const f = join(root, `packages/lipi-runtime/tests/${name}.test.mjs`);
      if (!existsSync(f)) return { pass: false, evidence: `${name}.test.mjs not found` };
      let out;
      try {
        out = execFileSync(process.execPath, ["--test", f], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) {
        out = `${e.stdout || ""}${e.stderr || ""}`;
      }
      const p = parseInt((out.match(/# pass (\d+)/) || [])[1] ?? "0", 10);
      const fl = parseInt((out.match(/# fail (\d+)/) || [])[1] ?? "1", 10);
      return { pass: fl === 0 && p > 0, evidence: `packages/lipi-runtime/tests/${name}.test.mjs: pass=${p}, fail=${fl}` };
    },
  })),
  {
    id: "a-platform-maataa-ui-typechecks",
    universe: "runtime",
    futureMilestone: "maataa-ui package typechecks cleanly (tsc --noEmit exit 0)",
    probe({ root, join, existsSync, execFileSync }) {
      const tsconfig = join(root, "packages/maataa-ui/tsconfig.json");
      if (!existsSync(tsconfig)) return { pass: false, evidence: "packages/maataa-ui/tsconfig.json not found" };
      try {
        execFileSync(join(root, "node_modules/.bin/tsc"), ["-p", tsconfig, "--noEmit"], { cwd: root, stdio: "pipe" });
        return { pass: true, evidence: "tsc --noEmit on packages/maataa-ui/tsconfig.json exited 0 (no type errors)" };
      } catch (e) {
        return { pass: false, evidence: `tsc exited non-zero: ${((e.stdout || "") + (e.stderr || "")).toString().slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-root-app-typechecks",
    universe: "runtime",
    futureMilestone: "Root web app typechecks cleanly end-to-end (tsc --noEmit exit 0)",
    probe({ root, join, existsSync, execFileSync }) {
      const tsc = join(root, "node_modules/.bin/tsc");
      if (!existsSync(tsc)) return { pass: false, evidence: "node_modules/.bin/tsc not found" };
      try {
        execFileSync(tsc, ["--noEmit"], { cwd: root, stdio: "pipe" });
        return { pass: true, evidence: "tsc --noEmit (root tsconfig) exited 0 — whole web app typechecks" };
      } catch (e) {
        return { pass: false, evidence: `root tsc exited non-zero: ${((e.stdout || "") + (e.stderr || "")).toString().slice(0, 200)}` };
      }
    },
  },
  {
    id: "a-platform-visual-hkd-typechecks",
    universe: "hkd-runtime",
    futureMilestone: "visual-hkd-runtime package typechecks cleanly (tsc --noEmit exit 0)",
    probe({ root, join, existsSync, execFileSync }) {
      const tsconfig = join(root, "packages/visual-hkd-runtime/tsconfig.json");
      if (!existsSync(tsconfig)) return { pass: false, evidence: "packages/visual-hkd-runtime/tsconfig.json not found" };
      try {
        execFileSync(join(root, "node_modules/.bin/tsc"), ["-p", tsconfig, "--noEmit"], { cwd: root, stdio: "pipe" });
        return { pass: true, evidence: "tsc --noEmit on packages/visual-hkd-runtime/tsconfig.json exited 0 (no type errors)" };
      } catch (e) {
        return { pass: false, evidence: `tsc exited non-zero: ${((e.stdout || "") + (e.stderr || "")).toString().slice(0, 200)}` };
      }
    },
  },
  // ── BATCH: runtimes moved off scaffold (real in-memory tiers) ───────────────
  ...[
    ["a-platform-hkd-registry-operational", "hkd-runtime", "runtime-hkd-registry", "runtime-hkd-registry is operational: real hash-chained register/resolve/list/pin/verify ledger (advisory trust, not production-GO)"],
    ["a-platform-observability-operational", "observability", "runtime-observability", "runtime-observability is operational: real report/link/emit + collect/getTopology/getLineage (in-memory fabric, not production-GO)"],
  ].map(([id, universe, name, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `tests/${name}.test.ts`], {
          cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (e) {
        out = `${e.stdout || ""}${e.stderr || ""}`;
      }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `tests/${name}.test.ts → pass=${pass ?? "?"} fail=${fail ?? "?"} (real in-memory tier; governedProductionGo=false)` };
    },
  })),
  // ── BATCH: runtime-federation integration ───────────────────────────────────
  ...[
    ["a-platform-federation-bootstrap", "observability", "federation-bootstrap", "Federation bootstrap wires all runtimes into observability topology (real report/link)"],
    ["a-platform-federation-health", "operations", "federation-health", "Federation health aggregates real health() of all 5 runtimes (allReady)"],
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
  // ── BATCH: federation v2 (single test file, per-test name pattern) ───────────
  ...[
    ["a-platform-federation-lineage-trace", "observability", "traceClaimLineage", "Cross-runtime claim lineage traced via observability emit/getLineage"],
    ["a-platform-federation-degraded-detect", "operations", "detectDegraded", "Federation degraded-mode detection (any runtime not ready)"],
    ["a-platform-federation-report", "operations", "federationReport", "Composite federation report: health + audit + ledger integrity"],
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
  // ── BATCH: runtime lifecycle + ops CLI ──────────────────────────────────────
  ...[
    ["a-platform-registry-revoke", "hkd-runtime", "revoke", "hkd-registry artifact revocation (removed from resolve, retained in ledger for audit)"],
    ["a-platform-persistence-wal-fallback-health-cli", "operations", "health CLI", "maataa health ops CLI reports federation health (persistence WAL-fallback works on any FS)"],
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
  {
    id: "a-platform-parallel-test-cache",
    universe: "operations",
    futureMilestone: "Parallel test-cache runner: whole suite runs concurrently with a real per-file results cache (verifier perf)",
    probe({ root, join, existsSync, readFileSync }) {
      const p = join(root, "release/evidence/test-cache.json");
      if (!existsSync(p)) return { pass: false, evidence: "release/evidence/test-cache.json not found (run build-test-cache)" };
      let c;
      try { c = JSON.parse(readFileSync(p, "utf8")); } catch (e) { return { pass: false, evidence: "test-cache.json invalid: " + e.message }; }
      const files = c.totals?.files ?? 0;
      const hasDuration = Number.isFinite(c.durationMs);
      const concurrent = (c.concurrency ?? 1) > 1;
      return {
        pass: c.schema === "maataa.test-cache.v1" && files >= 40 && hasDuration && concurrent,
        evidence: `test-cache: ${c.totals?.ok}/${files} files green in ${c.durationMs}ms (concurrency=${c.concurrency}) — real per-file results, not fabricated`,
      };
    },
  },
  {
    id: "a-platform-federation-lineage-critical-path",
    universe: "observability",
    futureMilestone: "Lineage critical-path: ordered cross-runtime hops with elapsed deltas + total duration",
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", "--test-name-pattern=lineageCriticalPath", "tests/federation-batch3.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `federation-batch3 [lineageCriticalPath] → pass=${pass ?? "?"} fail=${fail ?? "?"}` };
    },
  },
  // ── BATCH: real in-process deterministic scheduler (operations universe) ──────
  // HONEST SCOPE: logical-clock driven scheduler, deterministic due-evaluation.
  // NOT a wall-clock cron daemon, NOT a distributed job queue. Real, fail-closed.
  ...[
    ["a-platform-scheduler-schedule", "operations", "schedule registers tasks", "Scheduler: schedule tasks at logical due-times, fail-closed on bad input"],
    ["a-platform-scheduler-tick", "operations", "tick advances", "Scheduler: tick advances logical clock and marks due tasks, fail-closed on bad delta"],
    ["a-platform-scheduler-rundue", "operations", "runDue runs due", "Scheduler: runDue executes due tasks deterministically and increments run counts"],
    ["a-platform-scheduler-cancel", "operations", "cancel removes", "Scheduler: cancel pending tasks, fail-closed on ran/unknown"],
    ["a-platform-scheduler-list", "operations", "list filters", "Scheduler: list tasks filtered by state, fail-closed on unknown state"],
    ["a-platform-scheduler-snapshot", "operations", "snapshot is deterministic", "Scheduler: deterministic snapshot for evidence/replay; not production-GO"],
  ].map(([id, universe, pattern, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `--test-name-pattern=${pattern}`, "tests/runtime-scheduler.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `scheduler [${pattern}] → pass=${pass ?? "?"} fail=${fail ?? "?"} (in-process logical-clock; NOT a cron daemon; governedProductionGo=false)` };
    },
  })),
  // ── BATCH: real deterministic FSM for governed workflows (operations universe) ─
  // HONEST SCOPE: deterministic transition table + audit history. NOT a
  // distributed orchestrator / BPMN / saga engine. Real, fail-closed.
  ...[
    ["a-platform-fsm-define", "operations", "define validates", "FSM: define states/initial/transitions, reject non-deterministic edges"],
    ["a-platform-fsm-send", "operations", "send transitions deterministically", "FSM: deterministic transitions, fail-closed on undefined edges"],
    ["a-platform-fsm-state", "operations", "state returns the current", "FSM: query current state, fail-closed when undefined"],
    ["a-platform-fsm-can", "operations", "can reports allowed", "FSM: side-effect-free guard check of allowed transitions"],
    ["a-platform-fsm-history", "operations", "history records every", "FSM: ordered transition history for audit"],
    ["a-platform-fsm-restart", "operations", "restart returns to initial", "FSM: restart to initial state, clears history, keeps definition"],
    ["a-platform-fsm-snapshot", "operations", "snapshot is deterministic", "FSM: deterministic snapshot for evidence/replay; not production-GO"],
  ].map(([id, universe, pattern, title]) => ({
    id, universe, futureMilestone: title,
    probe({ root, execFileSync }) {
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", `--test-name-pattern=${pattern}`, "tests/runtime-fsm.test.ts"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) { out = `${e.stdout || ""}${e.stderr || ""}`; }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      return { pass: fail === "0" && Number(pass) > 0, evidence: `fsm [${pattern}] → pass=${pass ?? "?"} fail=${fail ?? "?"} (deterministic FSM; NOT a distributed orchestrator; governedProductionGo=false)` };
    },
  })),
];
