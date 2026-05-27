#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { readOperatorRegistry, scrubRegistry } from "./operator-registry.mjs";

export function listOperators({ root = process.cwd() } = {}) {
  return scrubRegistry(readOperatorRegistry({ root }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const registry = listOperators();
  console.log(`OPERATORS=${registry.operators.length}`);
  console.log(`REVOKED=${registry.revoked_operators.length}`);
  console.log(JSON.stringify(registry, null, 2));
}
