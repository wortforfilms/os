import test from "node:test";
import assert from "node:assert/strict";
import { buildUnifiedSearchIndex, isNavigableSearchResult, searchUnifiedIndex } from "../src/search/index.ts";
import { shouldOpenCommandPalette, updateCommandPaletteState } from "../src/search/paletteLogic.ts";
import {
  createBrowserFallbackBatch,
  parseRuntimeEventBatch,
  parseRuntimeSseData,
  transportStateFromBatch,
} from "../src/runtime/transport.ts";

test("search index includes local matrix routes and blocked routes", () => {
  const index = buildUnifiedSearchIndex();
  const searchRoute = index.find((result) => result.id === "route:/search");
  const rootTrustBlocker = index.find((result) => result.id === "blocker:MSAR");

  assert.equal(searchRoute?.status, "PREVIEW_VERIFIED");
  assert.equal(isNavigableSearchResult(searchRoute!), true);
  assert.equal(rootTrustBlocker?.status, "BLOCKED");
  assert.equal(isNavigableSearchResult(rootTrustBlocker!), false);
});

test("blocked route search result is visible but not navigable", () => {
  const result = searchUnifiedIndex("runtime observatory route").find((item) => item.id === "route:/runtime-observatory");

  assert.equal(result?.type, "route");
  assert.equal(result?.tags.includes("route-blocked"), true);
  assert.equal(isNavigableSearchResult(result!), false);
});

test("unified search returns blocker records without inventing routes", () => {
  const results = searchUnifiedIndex("hardware root trust blocked");
  assert.equal(results.some((result) => result.type === "blocker" && result.id === "blocker:MSAR"), true);
});

test("unified search includes evidence blockers from completion status", () => {
  const results = searchUnifiedIndex("blockers", { type: "evidence" });
  assert.equal(results.some((result) => result.type === "evidence" && result.status === "BLOCKED"), true);
});

test("unified search includes repository docs in the docs index", () => {
  const results = searchUnifiedIndex("search", { type: "doc" });
  assert.equal(results.some((result) => result.path === "docs/search.md"), true);
});

test("command palette keyboard gate opens only on ctrl/cmd k", () => {
  assert.equal(shouldOpenCommandPalette({ key: "k", metaKey: true, ctrlKey: false }), true);
  assert.equal(shouldOpenCommandPalette({ key: "K", metaKey: false, ctrlKey: true }), true);
  assert.equal(shouldOpenCommandPalette({ key: "k", metaKey: false, ctrlKey: false }), false);
  assert.equal(shouldOpenCommandPalette({ key: "p", metaKey: true, ctrlKey: false }), false);
});

test("command palette state opens, toggles, and closes", () => {
  const closed = { open: false };
  const opened = updateCommandPaletteState(closed, { type: "keyboard", event: { key: "k", metaKey: true, ctrlKey: false } });
  const toggledClosed = updateCommandPaletteState(opened, { type: "keyboard", event: { key: "K", metaKey: false, ctrlKey: true } });
  const reopened = updateCommandPaletteState(toggledClosed, { type: "open" });
  const escaped = updateCommandPaletteState(reopened, { type: "keyboard", event: { key: "Escape", metaKey: false, ctrlKey: false } });

  assert.equal(opened.open, true);
  assert.equal(toggledClosed.open, false);
  assert.equal(reopened.open, true);
  assert.equal(escaped.open, false);
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

test("SSE heartbeat parsing reports live SSE state", () => {
  const batch = parseRuntimeSseData(
    JSON.stringify({
      ok: true,
      cursor: 12,
      blockedSystemsCount: 6,
      transport: "sse",
      events: [
        {
          id: 12,
          type: "heartbeat",
          at: Date.now(),
          title: "SSE heartbeat",
          detail: "local event",
          status: "LIVE",
        },
      ],
    }),
  );

  assert.equal(batch.transport, "sse");
  assert.equal(batch.events[0]?.type, "heartbeat");
  assert.equal(transportStateFromBatch(batch), "LIVE");
});

test("SSE/browser fallback remains degraded without fake heartbeat", () => {
  const fallback = createBrowserFallbackBatch(0);

  assert.equal(fallback.transport, "browser-fallback");
  assert.equal(transportStateFromBatch(fallback), "DEGRADED");
  assert.equal(fallback.events.some((event) => event.type === "heartbeat"), false);
  assert.equal(fallback.events[0]?.title, "Runtime stream unavailable");
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
