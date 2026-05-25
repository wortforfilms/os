#!/usr/bin/env node
import { spawn } from "node:child_process";
import http from "node:http";
import { once } from "node:events";

const DEV_URL = "http://127.0.0.1:1420/";
const VITE_READY_TIMEOUT_MS = 30_000;

function waitForHttp(url, timeoutMs) {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(true);
      });

      request.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Vite dev server did not become ready at ${url}`));
          return;
        }
        setTimeout(attempt, 250);
      });
    };

    attempt();
  });
}

function spawnManaged(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });
  child.on("error", (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  return child;
}

let vite;

const shutdown = (code = 0) => {
  if (vite && !vite.killed) {
    vite.kill("SIGTERM");
  }
  process.exit(code);
};

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

try {
  const hasExistingServer = await waitForHttp(DEV_URL, 750)
    .then(() => true)
    .catch(() => false);
  if (!hasExistingServer) {
    vite = spawnManaged("npm", ["run", "dev"]);
  }
  await waitForHttp(DEV_URL, VITE_READY_TIMEOUT_MS);
  const electron = spawnManaged("npx", ["electron", "apps/electron/main.cjs"], {
    env: {
      ...process.env,
      MAATAA_ELECTRON_URL: DEV_URL,
    },
  });
  const [code] = await once(electron, "exit");
  shutdown(typeof code === "number" ? code : 0);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
}
