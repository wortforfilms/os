#!/usr/bin/env node --experimental-strip-types
/*
 * maataa lipi unicode <sub> — CLI over the local Unicode authority dataset.
 *
 *   maataa lipi unicode lookup 0905
 *   maataa lipi unicode search DEVANAGARI
 *   maataa lipi unicode range 0900 097F
 *   maataa lipi unicode summary
 *
 * PHKD: reads only the local file; prints UNKNOWN where block is not derivable;
 * fails closed (exit 2) on misses; status stays CONTROLLED_NO_GO.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  loadUnicodeData, getCharacterByCodepoint, searchUnicodeByName,
  listByRange, summarizeUnicodeData,
} from "../packages/lipi-runtime/src/unicode-data.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA = process.env.MAATAA_UNICODE_DATA || join(__dir, "..", "data", "unicode", "UnicodeData.txt");

// accept either ["lipi","unicode",sub,...] or [sub,...]
const argv = process.argv.slice(2);
const uIdx = argv.indexOf("unicode");
const args = uIdx >= 0 ? argv.slice(uIdx + 1) : argv;
const [sub, ...rest] = args;

function fail(msg) { console.error("ERROR: " + msg); process.exit(2); }
const row = (r) => `U+${r.hex}\t${r.category}\t${r.block}\t${r.name}`;

loadUnicodeData(DATA);

switch (sub) {
  case "lookup": {
    if (!rest[0]) fail("usage: maataa lipi unicode lookup <codepointHex>");
    const r = getCharacterByCodepoint(rest[0]);
    if (!r) fail(`codepoint ${rest[0]} not found (fail-closed)`);
    console.log(JSON.stringify(r, null, 2));
    break;
  }
  case "search": {
    if (!rest[0]) fail("usage: maataa lipi unicode search <query>");
    const hits = searchUnicodeByName(rest.join(" "));
    console.log(`# ${hits.length} match(es) for "${rest.join(" ")}"`);
    hits.slice(0, 200).forEach((r) => console.log(row(r)));
    if (hits.length > 200) console.log(`# … ${hits.length - 200} more`);
    break;
  }
  case "range": {
    if (!rest[0] || !rest[1]) fail("usage: maataa lipi unicode range <startHex> <endHex>");
    const hits = listByRange(rest[0], rest[1]);
    console.log(`# ${hits.length} record(s) in U+${rest[0]}..U+${rest[1]}`);
    hits.forEach((r) => console.log(row(r)));
    break;
  }
  case "summary": {
    const s = summarizeUnicodeData();
    console.log(JSON.stringify(s, null, 2));
    break;
  }
  default:
    fail(`unknown subcommand '${sub ?? ""}'. Use: lookup | search | range | summary`);
}
