import { readFileSync, writeFileSync } from "node:fs";

const dataPath = "data/plug-and-play-streaming-device.json";
const htmlPath = "release/runtime-html/plug_and_play_streaming_device.html";
const evidencePath = "release/evidence/plug-and-play-streaming-device.json";

const profile = JSON.parse(readFileSync(dataPath, "utf8"));
const html = readFileSync(htmlPath, "utf8");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const failures = [];

for (const marker of [
  "Plug-and-Play Streaming Device",
  "Local Audio Capture",
  "Offline Playlist Engine",
  "Loopback Stream Driver",
  "Field Recovery Console",
  "Session Evidence Receipt",
  "127.0.0.1:8401",
  "127.0.0.1:8402",
  "127.0.0.1:8403",
  "GOVERNED_PRODUCTION_NO_GO"
]) {
  if (!html.includes(marker)) failures.push(`missing html marker: ${marker}`);
}

if (profile.governance.productionReady !== false) failures.push("profile productionReady must remain false");
if (profile.governance.finalStatus !== "GOVERNED_PRODUCTION_NO_GO") failures.push("profile finalStatus must remain governed no-go");
if (profile.deviceFrame.externalTelemetry !== false) failures.push("external telemetry must be disabled");
if (profile.deviceFrame.remoteControl !== false) failures.push("remote control must be disabled");
if (profile.clusterPorts.length !== 3) failures.push("expected three cluster ports");
if (!profile.runtimeModules.some((module) => module.status === "BLOCKED")) failures.push("at least one runtime module must remain BLOCKED");
if (evidence.productionReady !== false) failures.push("evidence productionReady must remain false");
if (evidence.noFakeClaims !== true) failures.push("evidence noFakeClaims must be true");

evidence.verifiedAt = new Date().toISOString();
evidence.verificationStatus = failures.length === 0 ? "PASS" : "BLOCKED";
evidence.failures = failures;
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

if (failures.length > 0) {
  console.error("PLUG_AND_PLAY_STREAMING_DEVICE=BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("PLUG_AND_PLAY_STREAMING_DEVICE=RELEASED_STATIC_PREVIEW");
console.log("PRODUCTION_READY=false");
console.log("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO");
