const { app, BrowserWindow, ipcMain, session } = require("electron");
const { existsSync, readFileSync } = require("node:fs");
const { createServer } = require("node:http");
const { join, resolve } = require("node:path");
const { pathToFileURL } = require("node:url");
const { createAuthStore } = require("./auth-store.cjs");

const ROOT_DIR = resolve(__dirname, "../..");
const DEV_URL = process.env.MAATAA_ELECTRON_URL || "http://127.0.0.1:1420";
const IS_PRODUCTION = process.env.MAATAA_ELECTRON_MODE === "production";
const PRELOAD = join(__dirname, "preload.cjs");
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const SUPPORT_DOCS_PATH = join(ROOT_DIR, "data", "support-docs.json");

let mainWindow;
let authStore;
let runtimeCursor = 0;
const runtimeStartedAt = Date.now();
let runtimeSseServer;
let runtimeSseUrl = null;
let runtimeSseStatus = "starting";

function isAllowedLocalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === "file:") {
      return decodeURIComponent(url.pathname).startsWith(ROOT_DIR);
    }
    return ["http:", "https:", "ws:", "wss:"].includes(url.protocol) && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function resolveEntryUrl() {
  if (!IS_PRODUCTION) {
    return DEV_URL;
  }

  const indexHtml = join(ROOT_DIR, "dist", "index.html");
  if (!existsSync(indexHtml)) {
    throw new Error("dist/index.html missing; run npm run build:web before MAATAA_ELECTRON_MODE=production");
  }
  return pathToFileURL(indexHtml).toString();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "Maataa OS",
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#050816",
    show: false,
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !IS_PRODUCTION,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedLocalUrl(url)) {
      event.preventDefault();
    }
  });

  mainWindow.loadURL(resolveEntryUrl());
}

app.commandLine.appendSwitch("autoplay-policy", "user-gesture-required");

app.whenReady().then(() => {
  authStore = createAuthStore(join(app.getPath("userData"), "maataa-auth.sqlite"));
  startRuntimeSseServer();

  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedLocalUrl(details.url) });
  });

  ipcMain.handle("maataa:runtime-info", () => ({
    shell: "electron",
    stage: "desktop-alpha",
    localOnly: true,
    telemetryTarget: runtimeSseUrl,
    sseStatus: runtimeSseStatus,
  }));

  ipcMain.handle("maataa:auth-login", (_event, payload) => authStore.login(payload?.username, payload?.password));
  ipcMain.handle("maataa:auth-signup", (_event, payload) => authStore.signup(payload?.username, payload?.password));
  ipcMain.handle("maataa:auth-current", (_event, sessionId) => authStore.currentSession(sessionId));
  ipcMain.handle("maataa:auth-logout", (_event, sessionId) => authStore.logout(sessionId));
  ipcMain.handle("maataa:admin-summary", (_event, sessionId) => authStore.adminSummary(sessionId));
  ipcMain.handle("maataa:domain-registry", () => authStore.domainRegistry());
  ipcMain.handle("maataa:billing-summary", (_event, sessionId) => authStore.billingSummary(sessionId));
  ipcMain.handle("maataa:admin-analytics", (_event, sessionId) => authStore.adminAnalytics(sessionId));
  ipcMain.handle("maataa:runtime-events-since", (_event, cursor) => runtimeEventsSince(Number(cursor) || 0));
  ipcMain.handle("maataa:support-docs", () => readSupportDocsManifest());

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  authStore?.close();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  runtimeSseServer?.close();
});

function startRuntimeSseServer() {
  runtimeSseServer = createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    if (requestUrl.pathname !== "/api/telemetry-stream") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: false, error: "ROUTE_NOT_FOUND" }));
      return;
    }

    response.writeHead(200, {
      "access-control-allow-origin": "*",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    });
    response.flushHeaders?.();
    request.socket.setTimeout(0);

    let clientCursor = 0;
    const send = () => {
      const batch = runtimeEventsSince(clientCursor, "sse");
      clientCursor = batch.cursor;
      response.write(`event: runtime-status\nid: ${batch.cursor}\n`);
      response.write(`data: ${JSON.stringify(batch)}\n\n`);
    };

    send();
    const interval = setInterval(send, 2500);
    request.on("close", () => {
      clearInterval(interval);
    });
  });

  runtimeSseServer.on("error", () => {
    runtimeSseStatus = "blocked";
    runtimeSseUrl = null;
  });

  runtimeSseServer.listen(0, "127.0.0.1", () => {
    const address = runtimeSseServer.address();
    if (address && typeof address === "object") {
      runtimeSseUrl = `http://127.0.0.1:${address.port}/api/telemetry-stream`;
      runtimeSseStatus = "ready";
    }
  });
}

function runtimeEventsSince(cursor, transport = "electron-ipc") {
  runtimeCursor = Math.max(runtimeCursor + 1, cursor + 1);
  const now = Date.now();
  const events = [
    {
      id: runtimeCursor,
      type: "heartbeat",
      at: now,
      title: "Electron IPC heartbeat",
      detail: `Local runtime bus alive for ${Math.round((now - runtimeStartedAt) / 1000)}s.`,
      status: "LIVE",
    },
  ];

  if (runtimeCursor % 4 === 0) {
    events.push({
      id: runtimeCursor + 1,
      type: "evidence",
      at: now,
      title: "Evidence matrix observed",
      detail: "Completion matrix remains CONTROLLED_NO_GO with unresolved non-search blockers.",
      status: "LIVE",
    });
    runtimeCursor += 1;
  }

  return {
    ok: true,
    cursor: runtimeCursor,
    events,
    blockedSystemsCount: 6,
    transport,
  };
}

function readSupportDocsManifest() {
  const manifest = JSON.parse(readFileSync(SUPPORT_DOCS_PATH, "utf8"));
  return {
    ok: true,
    shell: "electron",
    manifest,
  };
}
