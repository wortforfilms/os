import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "scripts", "maataa-lipi-unicode.mjs");

function run(args) {
  try {
    const out = execFileSync(process.execPath, ["--experimental-strip-types", CLI, ...args], { encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") };
  }
}

test("maataa lipi unicode lookup 0905 → DEVANAGARI LETTER A", () => {
  const { code, out } = run(["lipi", "unicode", "lookup", "0905"]);
  assert.equal(code, 0);
  const r = JSON.parse(out);
  assert.equal(r.name, "DEVANAGARI LETTER A");
  assert.equal(r.block, "Devanagari");
});

test("maataa lipi unicode search DEVANAGARI lists matches", () => {
  const { code, out } = run(["lipi", "unicode", "search", "DEVANAGARI"]);
  assert.equal(code, 0);
  assert.match(out, /DEVANAGARI LETTER A/);
  assert.match(out, /match\(es\)/);
});

test("maataa lipi unicode range 0900 097F returns Devanagari", () => {
  const { code, out } = run(["lipi", "unicode", "range", "0900", "097F"]);
  assert.equal(code, 0);
  assert.match(out, /DEVANAGARI LETTER KA/);
  assert.match(out, /U\+0915/);
});

test("maataa lipi unicode summary prints generated counts + NO_GO", () => {
  const { code, out } = run(["lipi", "unicode", "summary"]);
  assert.equal(code, 0);
  const s = JSON.parse(out);
  assert.equal(s.status, "CONTROLLED_NO_GO");
  assert.ok(s.totalRecords > 20000);
  assert.equal(s.generated, true);
});

test("unknown codepoint fails closed (non-zero exit)", () => {
  const { code } = run(["lipi", "unicode", "lookup", "FFFFF"]);
  assert.notEqual(code, 0);
});

test("unknown subcommand fails closed", () => {
  const { code } = run(["lipi", "unicode", "bogus"]);
  assert.notEqual(code, 0);
});
