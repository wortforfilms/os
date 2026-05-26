import test from "node:test";
import assert from "node:assert/strict";
import { buildUnifiedSearchIndex, isNavigableSearchResult, searchUnifiedIndex } from "../src/search/index.ts";
import { shouldOpenCommandPalette } from "../src/search/paletteLogic.ts";
import { parseRuntimeEventBatch, transportStateFromBatch } from "../src/runtime/transport.ts";

test("search index includes local matrix routes and blocked routes", () => {
  const index = buildUnifiedSearchIndex();
  const searchRoute = index.find((result) => result.id === "route:/search");
  const domainsRoute = index.find((result) => result.id === "route:/domains");

  assert.equal(searchRoute?.status, "PREVIEW_VERIFIED");
  assert.equal(isNavigableSearchResult(searchRoute!), true);
  assert.equal(domainsRoute?.status, "BLOCKED");
  assert.equal(isNavigableSearchResult(domainsRoute!), false);
});

test("unified search returns blocker records without inventing routes", () => {
  const results = searchUnifiedIndex("domains blocked");
  assert.equal(results.some((result) => result.type === "route" && result.path === "/domains" && result.status === "BLOCKED"), true);
});

test("command palette keyboard gate opens only on ctrl/cmd k", () => {
  assert.equal(shouldOpenCommandPalette({ key: "k", metaKey: true, ctrlKey: false }), true);
  assert.equal(shouldOpenCommandPalette({ key: "K", metaKey: false, ctrlKey: true }), true);
  assert.equal(shouldOpenCommandPalette({ key: "k", metaKey: false, ctrlKey: false }), false);
  assert.equal(shouldOpenCommandPalette({ key: "p", metaKey: true, ctrlKey: false }), false);
});

test("runtime transport parses heartbeat and reports live/degraded states", () => {
  const live = parseRuntimeEventBatch({
    ok: true,
    cursor: 1,
    blockedSystemsCount: 6,
    transport: "electron-ipc",
    events: [
      {
        id: 1,
        type: "heartbeat",
        at: Date.now(),
        title: "heartbeat",
        detail: "local event",
        status: "LIVE",
      },
    ],
  });
  assert.equal(transportStateFromBatch(live), "LIVE");

  const degraded = parseRuntimeEventBatch({ ...live, transport: "browser-fallback" });
  assert.equal(transportStateFromBatch(degraded), "DEGRADED");
});

test("runtime transport rejects malformed heartbeat batches", () => {
  assert.throws(
    () =>
      parseRuntimeEventBatch({
        ok: true,
        cursor: -1,
        blockedSystemsCount: 0,
        transport: "electron-ipc",
        events: [],
      }),
    /RUNTIME_EVENT_CURSOR_INVALID/,
  );
});
