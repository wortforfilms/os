#!/usr/bin/env node
import { spawn } from "node:child_process";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });
}

function electronEnv(extra = {}) {
  const env = {
    ...process.env,
    ...extra,
  };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

await run("npm", ["run", "build:web"]);
await run("npx", ["electron", "apps/electron/main.cjs"], {
  env: electronEnv({
    MAATAA_ELECTRON_MODE: "production",
  }),
});
