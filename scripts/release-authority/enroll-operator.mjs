#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { enrollOperator, writeOperatorRegistry, scrubRegistry } from "./operator-registry.mjs";

export function enrollOperatorFromEnv({ root = process.cwd(), env = process.env } = {}) {
  const publicKeyPem = env.MAATAA_OPERATOR_PUBLIC_KEY_PEM ? readTextFile(env.MAATAA_OPERATOR_PUBLIC_KEY_PEM) : "";
  const certificatePem = env.MAATAA_OPERATOR_CERTIFICATE_PEM ? readTextFile(env.MAATAA_OPERATOR_CERTIFICATE_PEM) : null;
  const result = enrollOperator({
    root,
    operatorId: env.MAATAA_OPERATOR_ID,
    role: env.MAATAA_OPERATOR_ROLE,
    signerType: env.MAATAA_OPERATOR_SIGNER_TYPE,
    publicKeyPem,
    certificatePem,
  });

  if (result.ok) {
    writeOperatorRegistry({ root, registry: result.registry });
  }
  return result;
}

function readTextFile(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = enrollOperatorFromEnv();
  console.log(`OPERATOR_ENROLL_STATUS=${result.ok ? "PASS" : "BLOCKED"}`);
  if (result.operator) {
    console.log(`OPERATOR_ID=${result.operator.operator_id}`);
    console.log(`SIGNER_TYPE=${result.operator.signer_type}`);
  }
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
