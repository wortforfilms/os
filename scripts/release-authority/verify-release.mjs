#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RELEASE_AUTHORITY_VERIFIED,
  verifySignedReleaseManifest,
} from "./contract.mjs";

export function verifyReleaseAuthority({ root = process.cwd() } = {}) {
  const manifestPath = join(root, "release/release-authority/signed-release-manifest.json");
  const authorityPath = join(root, "release/release-authority/release-authority.json");
  const failures = [];

  if (!existsSync(manifestPath)) {
    failures.push("signed release manifest is missing");
  }
  if (!existsSync(authorityPath)) {
    failures.push("release authority registry is missing");
  }

  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
  const authority = existsSync(authorityPath) ? JSON.parse(readFileSync(authorityPath, "utf8")) : null;
  const manifestValidation = verifySignedReleaseManifest(manifest);
  if (!manifestValidation.ok) {
    failures.push(...manifestValidation.failures);
  }
  if (!authority || authority.status !== RELEASE_AUTHORITY_VERIFIED) {
    failures.push("release authority status is not VERIFIED");
  }
  if (!authority || authority.no_fake_signatures !== true) {
    failures.push("release authority no_fake_signatures must be true");
  }

  return {
    schema: "maataa.release.verify.v1",
    status: failures.length === 0 ? RELEASE_AUTHORITY_VERIFIED : "BLOCKED",
    release_candidate: failures.length === 0 ? "GOVERNED_RELEASE_CANDIDATE" : "BLOCKED",
    failures,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = verifyReleaseAuthority();
  console.log(`RELEASE_VERIFY_STATUS=${result.status}`);
  console.log(`RELEASE_CANDIDATE=${result.release_candidate}`);
  console.log(`FAILURES=${result.failures.length}`);
  for (const failure of result.failures) {
    console.log(`- ${failure}`);
  }
  if (result.status !== RELEASE_AUTHORITY_VERIFIED) {
    process.exitCode = 1;
  }
}
