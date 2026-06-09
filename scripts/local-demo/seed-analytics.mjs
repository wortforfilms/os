#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outDir = join(root, "release", "evidence", "local-demo");
mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const events = [
  {
    id: "local-demo-route-open",
    surface: "web",
    kind: "route_probe",
    route: "/",
    source: "LOCAL_DEMO_SEED",
    liveMetric: false,
  },
  {
    id: "local-demo-electron-contract",
    surface: "electron",
    kind: "load_contract_probe",
    route: "/",
    source: "LOCAL_DEMO_SEED",
    liveMetric: false,
  },
  {
    id: "local-demo-tauri-contract",
    surface: "tauri",
    kind: "load_contract_probe",
    route: "/",
    source: "LOCAL_DEMO_SEED",
    liveMetric: false,
  },
];

const payload = {
  schema: "maataa.local-demo.analytics-seed.v1",
  generatedAt,
  finalStatus: "CONTROLLED_NO_GO",
  productionReady: false,
  phkdVerdict: "BLOCKED",
  paymentsEnabled: false,
  metricsMode: "LOCAL_SEEDED_NOT_LIVE",
  honesty:
    "Seeded local demo events are deterministic preview evidence. They are not live usage metrics, revenue, payments, uptime, or production readiness.",
  totals: {
    events: events.length,
    liveMetrics: events.filter((event) => event.liveMetric).length,
  },
  events,
};

writeFileSync(join(outDir, "analytics-seed.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
writeFileSync(join(outDir, "analytics-events.jsonl"), `${events.map((event) => JSON.stringify({ ...event, generatedAt })).join("\n")}\n`, "utf8");
console.log(`local demo analytics seed: ${events.length} seeded preview events -> release/evidence/local-demo/analytics-seed.json`);
