#!/usr/bin/env node
// Parallel test runner + results cache.
//
// The milestone verifier currently spawns one Node process PER probe (~60),
// serially — which blows past tight shell time budgets. This runs every test
// file ONCE, concurrently (bounded pool), and writes a per-file results cache to
// release/evidence/test-cache.json. The verifier (and CI) can then read cached
// pass/fail instead of re-spawning, cutting wall-time dramatically.
//
// Honest: this only CACHES real results — it runs the actual tests; it never
// fabricates a pass. Files that error are recorded as failed (fail-closed).
import { exec } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const CONCURRENCY = Number(process.env.MAATAA_TEST_CONCURRENCY || 8);

// Discover test files (TS needs --experimental-strip-types).
function discover() {
  const files = [];
  const add = (dir, base = dir) => {
    if (!existsSync(join(root, dir))) return;
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (e.name.startsWith("._")) continue;
      const rel = `${base}/${e.name}`;
      if (e.isDirectory()) add(`${dir}/${e.name}`, rel);
      else if (/\.test\.(mjs|ts)$/.test(e.name)) files.push(rel);
    }
  };
  add("tests");
  for (const p of existsSync(join(root, "packages")) ? readdirSync(join(root, "packages")) : []) {
    add(`packages/${p}/tests`);
  }
  return [...new Set(files)].sort();
}

const runOne = (file) => new Promise((resolve) => {
  const strip = file.endsWith(".ts") ? "--experimental-strip-types " : "";
  exec(`node ${strip}--test ${JSON.stringify(file)}`, { cwd: root, maxBuffer: 8 * 1024 * 1024 }, (_err, stdout, stderr) => {
    const out = `${stdout}${stderr}`;
    const pass = Number((out.match(/# pass (\d+)/) || [])[1] ?? 0);
    const fail = Number((out.match(/# fail (\d+)/) || [])[1] ?? 1);
    resolve([file, { pass, fail, ok: fail === 0 && pass > 0 }]);
  });
});

async function pool(items, n, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results.push(await worker(items[idx]));
    }
  });
  await Promise.all(runners);
  return results;
}

const t0 = Date.now();
const files = discover();
const entries = await pool(files, CONCURRENCY, runOne);
const cache = Object.fromEntries(entries);
const ok = entries.filter(([, r]) => r.ok).length;
const ms = Date.now() - t0;

writeFileSync(
  join(root, "release/evidence/test-cache.json"),
  `${JSON.stringify({ schema: "maataa.test-cache.v1", generatedAt: new Date().toISOString(), concurrency: CONCURRENCY, durationMs: ms, totals: { files: files.length, ok, failed: files.length - ok }, files: cache }, null, 2)}\n`,
  "utf8",
);
console.log(`test-cache: ${ok}/${files.length} files green in ${ms}ms (concurrency=${CONCURRENCY})`);
for (const [f, r] of entries) if (!r.ok) console.log(`  FAIL ${f} (pass=${r.pass} fail=${r.fail})`);
