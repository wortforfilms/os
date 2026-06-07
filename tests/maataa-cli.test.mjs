import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(".");
const cli = join(root, "bin", "maataa");

function run(args, options = {}) {
  const env = {
    ...process.env,
    LANG: "C.UTF-8",
    ...options.env,
  };
  for (const key of Object.keys(env)) {
    if (key.startsWith("NODE_TEST")) delete env[key];
  }

  return spawnSync(cli, args, {
    cwd: root,
    encoding: "utf8",
    env,
  });
}

test("maataa status prints finalStatus from COMPLETION_STATUS_MATRIX.json", () => {
  const matrix = JSON.parse(readFileSync(join(root, "COMPLETION_STATUS_MATRIX.json"), "utf8"));
  const result = run(["status", "--lang", "both"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, new RegExp(`FINAL_STATUS=${matrix.finalStatus}`));
  assert.match(result.stdout, new RegExp(`PRODUCTION_READY=${matrix.productionReady}`));
  assert.match(result.stdout, new RegExp(`अंतिम_स्थिति=${matrix.finalStatus}`));
  assert.match(result.stdout, new RegExp(`उत्पादन_तैयार=${matrix.productionReady}`));
});

test("maataa evidence validate fails closed when required evidence is missing", () => {
  const temp = mkdtempSync(join(tmpdir(), "maataa-cli-missing-evidence-"));
  try {
    mkdirSync(join(temp, "release", "evidence"), { recursive: true });
    writeFileSync(
      join(temp, "COMPLETION_STATUS_MATRIX.json"),
      `${JSON.stringify({ finalStatus: "CONTROLLED_NO_GO", productionReady: false, phkdVerdict: "BLOCKED", blockers: [] })}\n`,
    );

    const result = run(["evidence", "validate"], { env: { MAATAA_REPO_ROOT: temp } });

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /EVIDENCE_STATUS=BLOCKED/);
    assert.match(result.stdout, /MISSING=release\/evidence\/latest\.json/);
    assert.match(result.stdout, /MISSING=release\/evidence\/blockers\.json/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("maataa device trust reports BLOCKED without real hardware evidence", () => {
  const temp = mkdtempSync(join(tmpdir(), "maataa-cli-device-trust-"));
  try {
    mkdirSync(join(temp, "release", "evidence"), { recursive: true });
    writeFileSync(
      join(temp, "COMPLETION_STATUS_MATRIX.json"),
      `${JSON.stringify({ finalStatus: "CONTROLLED_NO_GO", productionReady: false, phkdVerdict: "BLOCKED", blockers: [] })}\n`,
    );

    const result = run(["device", "trust"], { env: { MAATAA_REPO_ROOT: temp } });

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /DEVICE_TRUST=BLOCKED/);
    assert.match(result.stdout, /HARDWARE_EVIDENCE_STATUS=MISSING/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("maataa milestones report does not invent counts", () => {
  const cycle = JSON.parse(readFileSync(join(root, "release", "evidence", "milestones-cycle-last.json"), "utf8"));
  const result = run(["milestones", "report"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, new RegExp(`ACHIEVED=${cycle.totals.achieved}`));
  assert.match(result.stdout, new RegExp(`MILESTONES=${cycle.totals.milestones}`));
  assert.match(result.stdout, new RegExp(`GROUPS=${cycle.totals.groups}`));
});

test("maataa doctor reports repo and evidence status", () => {
  const result = run(["doctor"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, new RegExp(`REPO_ROOT=${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.match(result.stdout, /EVIDENCE_STATUS=AVAILABLE/);
  assert.match(result.stdout, /FINAL_STATUS=CONTROLLED_NO_GO/);
});

test("maataa doctor fonts reports no bundled fonts and unicode samples", () => {
  const result = run(["doctor", "fonts"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /BUNDLED_FONTS=NONE/);
  assert.match(result.stdout, /DEVANAGARI_SAMPLE=अ आ इ/);
  assert.match(result.stdout, /BRAHMI_SAMPLE=𑀅 𑀆 𑀇/);
});

test("maataa lipi transliterate maps Brahmi to Devanagari and marks unknowns", () => {
  const result = run(["lipi", "transliterate", "--from", "brahmi", "--to", "devanagari", "𑀓", "𑀔", "X"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /TRANSLITERATION_FROM=brahmi/);
  assert.match(result.stdout, /TRANSLITERATION_TO=devanagari/);
  assert.match(result.stdout, /TRANSLITERATED_TEXT=क ख \[UNKNOWN\]/);
  assert.match(result.stdout, /OCR_GUESSING=false/);
  assert.match(result.stdout, /CERTIFICATION_CLAIMS=NONE/);
});

test("maataa lipi status stays non-certifying and controlled no-go", () => {
  const result = run(["lipi", "status"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /LIPI_STATUS=FOUND/);
  assert.match(result.stdout, /NO_OCR_GUESSING=true/);
  assert.match(result.stdout, /CERTIFICATION_CLAIMS=NONE/);
  assert.match(result.stdout, /FINAL_STATUS=CONTROLLED_NO_GO/);
});

test("maataa lipi evidence reports real evidence entries", () => {
  const result = run(["lipi", "evidence"]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /LIPI_EVIDENCE=FOUND/);
  assert.match(result.stdout, /LIPI_EVIDENCE_COUNT=[1-9][0-9]*/);
});

test("maataa lipi validate runs the real lipi test suite", () => {
  const env = { ...process.env, LANG: "C.UTF-8" };
  for (const key of Object.keys(env)) {
    if (key.startsWith("NODE_TEST")) delete env[key];
  }

  const output = execFileSync(cli, ["lipi", "validate"], {
    cwd: root,
    encoding: "utf8",
    env,
  });

  assert.match(output, /# pass \d+/);
  assert.match(output, /# fail 0/);
});
