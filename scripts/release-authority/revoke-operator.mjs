#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { revokeOperator, writeOperatorRegistry, scrubRegistry } from "./operator-registry.mjs";

export function revokeOperatorFromEnv({ root = process.cwd(), env = process.env } = {}) {
  const result = revokeOperator({
    root,
    operatorId: env.MAATAA_OPERATOR_ID,
    reason: env.MAATAA_OPERATOR_REVOKE_REASON || "operator revoked",
  });
  if (result.ok) {
    writeOperatorRegistry({ root, registry: result.registry });
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = revokeOperatorFromEnv();
  console.log(`OPERATOR_REVOKE_STATUS=${result.ok ? "PASS" : "BLOCKED"}`);
  for (const failure of result.failures ?? []) {
    console.log(`- ${failure}`);
  }
  if (result.registry) {
    console.log(JSON.stringify(scrubRegistry(result.registry), null, 2));
  }
  if (!result.ok) {
    process.exitCode = 1;
  }
}
