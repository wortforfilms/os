#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

OUT_DIR="release/evidence/local-demo"
PORT="${MAATAA_LOCAL_DEMO_PORT:-1420}"
WEB_URL="http://127.0.0.1:${PORT}/"
VITE_BIN="node_modules/.bin/vite"
SERVER_PID=""

mkdir -p "$OUT_DIR"

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

node scripts/local-demo/seed-analytics.mjs

route_ok() {
  MAATAA_LOCAL_DEMO_URL="$WEB_URL" node --input-type=module - <<'NODE'
const url = process.env.MAATAA_LOCAL_DEMO_URL;
try {
  const response = await fetch(url, { redirect: "manual" });
  process.exit(response.status >= 200 && response.status < 500 ? 0 : 1);
} catch {
  process.exit(1);
}
NODE
}

if ! route_ok; then
  if [[ ! -x "$VITE_BIN" ]]; then
    echo "vite binary not found at $VITE_BIN" >&2
    exit 1
  fi
  "$VITE_BIN" --host 127.0.0.1 --port "$PORT" --strictPort --logLevel warn > "$OUT_DIR/web-server.log" 2>&1 &
  SERVER_PID="$!"
fi

for _ in {1..80}; do
  if route_ok; then
    break
  fi
  sleep 0.25
done

if ! route_ok; then
  echo "local web route did not open at $WEB_URL" >&2
  exit 1
fi

MAATAA_LOCAL_DEMO_URL="$WEB_URL" node --input-type=module - <<'NODE'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "release", "evidence", "local-demo");
const webUrl = process.env.MAATAA_LOCAL_DEMO_URL;
mkdirSync(outDir, { recursive: true });

const response = await fetch(webUrl);
const body = await response.text();
const webRoute = {
  schema: "maataa.local-demo.web-route.v1",
  capturedAt: new Date().toISOString(),
  url: webUrl,
  status: response.status,
  ok: response.ok,
  localOnly: true,
  productionReady: false,
  finalStatus: "CONTROLLED_NO_GO",
  bodyBytes: Buffer.byteLength(body),
  hasRootElement: body.includes('id="root"'),
};
writeFileSync(join(outDir, "web-route.json"), `${JSON.stringify(webRoute, null, 2)}\n`, "utf8");

const electronMainPath = join(process.cwd(), "apps", "electron", "main.cjs");
const tauriConfigPath = join(process.cwd(), "src-tauri", "tauri.conf.json");
const packagePath = join(process.cwd(), "package.json");
const electronMain = readFileSync(electronMainPath, "utf8");
const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8"));
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));

const electronChecks = {
  mainExists: existsSync(electronMainPath),
  acceptsLocalOverride: electronMain.includes("MAATAA_ELECTRON_URL"),
  loadsResolvedEntryUrl: electronMain.includes("mainWindow.loadURL(resolveEntryUrl())"),
  allowsLoopbackHost: electronMain.includes('"127.0.0.1"') && electronMain.includes('"localhost"'),
  scriptPresent: pkg.scripts?.["electron:dev"] === "node scripts/electron-dev.mjs",
};
const tauriChecks = {
  configExists: existsSync(tauriConfigPath),
  devUrlMatches: tauriConfig.build?.devUrl === webUrl.replace(/\/$/, ""),
  beforeDevCommand: tauriConfig.build?.beforeDevCommand === "npm run dev",
  frontendDist: tauriConfig.build?.frontendDist === "../dist",
  scriptPresent: typeof pkg.scripts?.["tauri:dev"] === "string" && pkg.scripts["tauri:dev"].includes("tauri dev"),
};

const electronPass = Object.values(electronChecks).every(Boolean);
const tauriPass = Object.values(tauriChecks).every(Boolean);
const shellContracts = {
  schema: "maataa.local-demo.shell-load-contracts.v1",
  capturedAt: new Date().toISOString(),
  localWebUrl: webUrl,
  finalStatus: "CONTROLLED_NO_GO",
  productionReady: false,
  phkdVerdict: "BLOCKED",
  paymentsEnabled: false,
  guiLaunchClaimed: false,
  note: "Automated evidence verifies local route availability plus Electron/Tauri local load contracts. It does not claim GUI launch, production deployment, uptime, or payments.",
  electron: {
    status: electronPass ? "PREVIEW_VERIFIED" : "BLOCKED",
    loadTarget: webUrl,
    checks: electronChecks,
    evidencePath: "apps/electron/main.cjs",
  },
  tauri: {
    status: tauriPass ? "PREVIEW_VERIFIED" : "BLOCKED",
    loadTarget: tauriConfig.build?.devUrl ?? "UNKNOWN",
    checks: tauriChecks,
    evidencePath: "src-tauri/tauri.conf.json",
  },
};
writeFileSync(join(outDir, "shell-load-contracts.json"), `${JSON.stringify(shellContracts, null, 2)}\n`, "utf8");

const seed = JSON.parse(readFileSync(join(outDir, "analytics-seed.json"), "utf8"));
const blockers = [
  "local preview only",
  "no production deployment claimed",
  "no fake live metrics",
  "payments disabled",
  "global final status remains CONTROLLED_NO_GO",
];
const summary = {
  schema: "maataa.local-demo.summary.v1",
  capturedAt: new Date().toISOString(),
  finalStatus: "CONTROLLED_NO_GO",
  productionReady: false,
  phkdVerdict: "BLOCKED",
  localOnly: true,
  paymentsEnabled: false,
  metricsMode: seed.metricsMode,
  web: webRoute,
  electron: shellContracts.electron,
  tauri: shellContracts.tauri,
  blockers,
};
writeFileSync(join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

const lines = [
  "# MAATAA Local Demo Evidence",
  "",
  `- Captured: ${summary.capturedAt}`,
  `- Web route: ${webRoute.ok ? "PASS" : "BLOCKED"} (${webRoute.status}) ${webUrl}`,
  `- Electron local load contract: ${shellContracts.electron.status}`,
  `- Tauri local load contract: ${shellContracts.tauri.status}`,
  "- Production ready: false",
  "- Payments enabled: false",
  "- Final status: CONTROLLED_NO_GO",
  "",
  "## Blockers",
  "",
  ...blockers.map((blocker) => `- ${blocker}`),
  "",
];
writeFileSync(join(outDir, "summary.md"), `${lines.join("\n")}`, "utf8");

if (!webRoute.ok || !electronPass || !tauriPass) {
  process.exit(1);
}
NODE

echo "local demo evidence captured in $OUT_DIR"
