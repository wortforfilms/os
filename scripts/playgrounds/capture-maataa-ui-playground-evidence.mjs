#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const root = process.cwd();
const outDir = join(root, "release/evidence/maataa-ui-playground");
const screenshotDir = join(outDir, "screenshots");
const port = Number(process.env.MAATAA_PLAYGROUND_PORT || 1467);
const baseUrl = `http://127.0.0.1:${port}`;
const chromePath = process.env.PLAYWRIGHT_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

mkdirSync(screenshotDir, { recursive: true });

const { playgroundRoutes, PLAYGROUND_FINAL_STATUS, PLAYGROUND_PRODUCTION_STATUS } = await import(
  pathToFileURL(join(root, "src/playgrounds/data.ts")).href
);

const server = spawn(join(root, "node_modules/.bin/vite"), ["--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: root,
  stdio: ["ignore", "pipe", "pipe"],
});

let serverLog = "";
server.stdout.on("data", (chunk) => {
  serverLog += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverLog += chunk.toString();
});

try {
  await waitForServer(baseUrl);
  if (!existsSync(chromePath)) {
    throw new Error(`CHROME_EXECUTABLE_MISSING: ${chromePath}`);
  }

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const screenshots = [];

  for (const route of playgroundRoutes) {
    const url = `${baseUrl}${route.path}`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.getByText(route.title, { exact: true }).first().waitFor({ timeout: 5000 });
    await page.getByText(PLAYGROUND_FINAL_STATUS, { exact: true }).first().waitFor({ timeout: 5000 });
    await page.getByText(PLAYGROUND_PRODUCTION_STATUS, { exact: true }).first().waitFor({ timeout: 5000 });
    const fileName = `${route.path.replace(/^\//, "").replaceAll("/", "__")}.png`;
    const screenshotPath = join(screenshotDir, fileName);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    screenshots.push({
      route: route.path,
      title: route.title,
      status: route.status,
      file: `release/evidence/maataa-ui-playground/screenshots/${fileName}`,
    });
  }

  await browser.close();

  const report = {
    schema: "maataa.ui-playground.visual-evidence.v1",
    generatedAt: new Date().toISOString(),
    finalStatus: PLAYGROUND_FINAL_STATUS,
    productionStatus: PLAYGROUND_PRODUCTION_STATUS,
    productionReady: false,
    productionDatabase: false,
    realPayments: false,
    runtimePromotion: false,
    visualEvidence: {
      engine: "playwright-core",
      browser: "system-chrome",
      baseUrl,
      screenshots,
    },
    routes: playgroundRoutes.map((route) => ({
      path: route.path,
      title: route.title,
      family: route.family,
      status: route.status,
      productionReady: route.productionReady,
      runtimePromotion: route.runtimePromotion,
      paymentMode: route.paymentMode,
      dataMode: route.dataMode,
      blockers: route.sections.filter((section) => section.blocker).map((section) => ({ id: section.id, label: section.label, blocker: section.blocker })),
    })),
  };

  writeFileSync(join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(join(outDir, "report.md"), renderMarkdown(report), "utf8");
  writeFileSync(join(outDir, "vite.log"), serverLog, "utf8");
  console.log(`playground evidence: captured ${screenshots.length} routes → release/evidence/maataa-ui-playground/report.json`);
} finally {
  server.kill("SIGTERM");
}

async function waitForServer(url) {
  const deadline = Date.now() + 15000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = `HTTP_${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`VITE_SERVER_UNAVAILABLE: ${lastError}\n${serverLog.slice(-1200)}`);
}

function renderMarkdown(report) {
  const lines = [
    "# Maataa UI + ThemeLab Playground Evidence",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Runtime: ${report.finalStatus}`,
    `- Production: ${report.productionStatus}`,
    `- Production ready: ${report.productionReady}`,
    `- Production database: ${report.productionDatabase}`,
    `- Real payments: ${report.realPayments}`,
    `- Runtime promotion: ${report.runtimePromotion}`,
    `- Visual engine: ${report.visualEvidence.engine} (${report.visualEvidence.browser})`,
    "",
    "## Routes",
    "",
  ];
  for (const route of report.routes) {
    lines.push(`- \`${route.path}\` — ${route.status}; blockers=${route.blockers.length}; screenshot captured`);
  }
  return `${lines.join("\n")}\n`;
}
