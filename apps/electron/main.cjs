const { app, BrowserWindow, ipcMain, session } = require("electron");
const { existsSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT_DIR = resolve(__dirname, "../..");
const DEV_URL = process.env.MAATAA_ELECTRON_URL || "http://127.0.0.1:1420";
const IS_PRODUCTION = process.env.MAATAA_ELECTRON_MODE === "production";
const PRELOAD = join(__dirname, "preload.cjs");
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

let mainWindow;

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
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedLocalUrl(details.url) });
  });

  ipcMain.handle("maataa:runtime-info", () => ({
    shell: "electron",
    stage: "desktop-alpha",
    localOnly: true,
    telemetryTarget: "http://127.0.0.1:1420/api/telemetry-stream",
  }));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
