import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const profile = JSON.parse(readFileSync("data/plug-and-play-streaming-device.json", "utf8"));
const html = readFileSync("release/runtime-html/plug_and_play_streaming_device.html", "utf8");
const evidence = JSON.parse(readFileSync("release/evidence/plug-and-play-streaming-device.json", "utf8"));

test("streaming device profile keeps production gate closed", () => {
  assert.equal(profile.governance.productionReady, false);
  assert.equal(profile.governance.phkdVerdict, "BLOCKED");
  assert.equal(profile.governance.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.equal(profile.governance.noFakeClaims, true);
});

test("streaming device exposes three local cluster ports", () => {
  assert.deepEqual(profile.clusterPorts.map((port) => port.port), [8401, 8402, 8403]);
  assert.equal(profile.clusterPorts.every((port) => port.interface === "127.0.0.1"), true);
});

test("streaming device runtime modules include blocked recovery and receipt gates", () => {
  const blocked = profile.runtimeModules.filter((module) => module.status === "BLOCKED");
  assert.equal(blocked.length >= 2, true);
  for (const module of blocked) {
    assert.equal(typeof module.blockedReason, "string");
    assert.equal(module.blockedReason.length > 0, true);
  }
});

test("streaming device HTML renders local operator surface", () => {
  assert.equal(html.includes("Plug-and-Play Streaming Device"), true);
  assert.equal(html.includes("127.0.0.1:8401"), true);
  assert.equal(html.includes("GOVERNED_PRODUCTION_NO_GO"), true);
});

test("streaming device evidence is honest", () => {
  assert.equal(evidence.productionReady, false);
  assert.equal(evidence.phkdVerdict, "BLOCKED");
  assert.equal(evidence.finalStatus, "GOVERNED_PRODUCTION_NO_GO");
  assert.equal(evidence.noFakeClaims, true);
});
