// Achievement probe for the sku universe.
//
// PHKD: passes ONLY when the real @maataa/runtime-entitlements tests are green at
// run time — proving the entitlement boundary actually enforces per-SKU caps
// (allows within cap, DENIES over cap, denies unknown accounts; quota meter real).
// Fails closed otherwise.
//
// Resolves c-sku-licensing-enforced (BLOCKED → ACHIEVED). Honest scope:
// enforcement engine + quota meter only. It does NOT make SKUs purchasable
// (c-skus-purchasable stays BLOCKED: no checkout/provisioning/license keys) and
// does NOT add support desk/ticketing (c-support-tiers stays BLOCKED). The
// billing side is a deterministic SIMULATION — no payment network.

export const probes = [
  {
    id: "a-resolve-sku-licensing-enforced",
    universe: "sku",
    resolves: "c-sku-licensing-enforced",
    futureMilestone: "Per-SKU user/device caps and storage quotas are enforced",
    probe({ root, join, existsSync, execFileSync }) {
      const testFile = "tests/runtime-entitlements.test.ts";
      const pkg = "packages/runtime-entitlements/src/index.ts";
      if (!existsSync(join(root, pkg)) || !existsSync(join(root, testFile))) {
        return { pass: false, evidence: "runtime-entitlements package or tests missing" };
      }
      let out;
      try {
        out = execFileSync(process.execPath, ["--experimental-strip-types", "--test", testFile], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      } catch (e) {
        out = `${e.stdout || ""}${e.stderr || ""}`;
      }
      const pass = (out.match(/# pass (\d+)/) || [])[1];
      const fail = (out.match(/# fail (\d+)/) || [])[1];
      const ok = fail === "0" && Number(pass) > 0;
      return {
        pass: ok,
        evidence: ok
          ? `tests/runtime-entitlements → pass=${pass} fail=${fail}: entitlement engine enforces per-SKU seat/device/storage caps fail-closed (over-cap & unknown-account denied; quota meter real). Scope: enforcement only — not purchasable SKUs (c-skus-purchasable BLOCKED), not support desk (c-support-tiers BLOCKED); billing is simulation, no payment network.`
          : `entitlement tests not green → pass=${pass ?? "?"} fail=${fail ?? "?"}`,
      };
    },
  },
];
