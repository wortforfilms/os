#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";

const root = process.cwd();
const electronSource = join(root, "node_modules", "electron", "dist", "Electron.app");
const outputRoot = join(root, "release", "electron");
const appName = "Maataa OS.app";
const appPath = join(outputRoot, appName);
const resourcesPath = join(appPath, "Contents", "Resources");
const appResourcesPath = join(resourcesPath, "app");
const evidencePath = join(root, "release", "evidence", "electron-pack.json");
const zipPath = join(outputRoot, "Maataa-OS-electron-preview.zip");

if (process.platform !== "darwin") {
  fail("Electron full app packing currently requires macOS Electron.app resources.");
}

if (!existsSync(electronSource)) {
  fail("Electron.app is missing. Run npm install before packing Electron.");
}

execFileSync("npm", ["run", "build:web"], { cwd: root, stdio: "inherit", env: { ...process.env, COPYFILE_DISABLE: "1" } });

rmSync(appPath, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });
cpSync(electronSource, appPath, { recursive: true });
removeSidecars(appPath);

rmSync(appResourcesPath, { recursive: true, force: true });
mkdirSync(appResourcesPath, { recursive: true });

copyIntoApp("apps/electron");
copyIntoApp("dist");
copyIntoApp("data");
copyIntoApp("docs");
copyReleaseArtifacts();
copyFileIfExists("COMPLETION_STATUS_MATRIX.json");
copyFileIfExists("COMPLETION_STATUS_MATRIX.md");

writeFileSync(
  join(appResourcesPath, "package.json"),
  `${JSON.stringify({
    name: "maataa-os-electron-preview",
    version: readRootVersion(),
    private: true,
    main: "apps/electron/main.cjs",
    type: "commonjs",
    maataa: {
      productionReady: false,
      finalStatus: "GOVERNED_PRODUCTION_NO_GO",
      phkdVerdict: "BLOCKED"
    }
  }, null, 2)}\n`,
  "utf8"
);

patchInfoPlist(join(appPath, "Contents", "Info.plist"));
removeSidecars(appPath);

rmSync(zipPath, { force: true });
const zipResult = spawnSync("/usr/bin/ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appName, basename(zipPath)], {
  cwd: outputRoot,
  stdio: "inherit",
  env: { ...process.env, COPYFILE_DISABLE: "1" }
});

const zipCreated = zipResult.status === 0 && existsSync(zipPath);
const evidence = {
  schema: "maataa.electron-pack.v1",
  artifact: relative(root, appPath),
  archive: zipCreated ? relative(root, zipPath) : null,
  status: "PACKED_LOCAL_PREVIEW",
  productionReady: false,
  phkdVerdict: "BLOCKED",
  finalStatus: "GOVERNED_PRODUCTION_NO_GO",
  signed: false,
  notarized: false,
  fullPack: true,
  includedSurfaces: [
    "Vite production dist",
    "Electron shell",
    "Local auth/session bridge",
    "Support docs manifest",
    "Governed release HTML",
    "Runtime HTML previews",
    "KBS full demo",
    "Completion status matrix"
  ],
  activeBlockers: [
    "macos_codesign_not_applied",
    "notarization_not_applied",
    "hardware_attestation_missing",
    "operator_quorum_unverified",
    "rollback_drill_not_verified"
  ],
  appHash: hashTree(appPath),
  archiveHash: zipCreated ? hashFile(zipPath) : null,
  packedAt: new Date().toISOString(),
  noFakeClaims: true
};

mkdirSync(dirname(evidencePath), { recursive: true });
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

console.log("ELECTRON_PACK=PACKED_LOCAL_PREVIEW");
console.log(`APP=${relative(root, appPath)}`);
if (zipCreated) console.log(`ARCHIVE=${relative(root, zipPath)}`);
console.log("PRODUCTION_READY=false");
console.log("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO");

function copyIntoApp(path) {
  const source = join(root, path);
  if (!existsSync(source)) return;
  const target = join(appResourcesPath, path);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, {
    recursive: true,
    filter: (sourcePath) => {
      const name = basename(sourcePath);
      if (name === ".DS_Store" || name.startsWith("._")) return false;
      const rel = relative(root, sourcePath);
      if (rel.startsWith("assets/html")) return false;
      if (rel.startsWith("release/electron")) return false;
      return true;
    }
  });
}

function copyReleaseArtifacts() {
  const releaseSource = join(root, "release");
  if (!existsSync(releaseSource)) return;
  const releaseTarget = join(appResourcesPath, "release");
  mkdirSync(releaseTarget, { recursive: true });
  for (const entry of readdirSync(releaseSource)) {
    if (entry === "electron") continue;
    const source = join(releaseSource, entry);
    const target = join(releaseTarget, entry);
    cpSync(source, target, {
      recursive: true,
      filter: (sourcePath) => {
        const name = basename(sourcePath);
        return name !== ".DS_Store" && !name.startsWith("._");
      }
    });
  }
}

function copyFileIfExists(path) {
  const source = join(root, path);
  if (!existsSync(source)) return;
  const target = join(appResourcesPath, path);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target);
}

function patchInfoPlist(path) {
  let plist = readFileSync(path, "utf8");
  plist = plist
    .replace("<string>Electron</string>", "<string>Maataa OS</string>")
    .replace("<string>com.github.Electron</string>", "<string>in.tlps.maataa-os.preview</string>")
    .replace("<string>Electron</string>", "<string>Maataa OS</string>");
  writeFileSync(path, plist, "utf8");
}

function removeSidecars(path) {
  if (!existsSync(path)) return;
  const stat = statSync(path);
  if (!stat.isDirectory()) return;
  for (const entry of readdirSync(path)) {
    const current = join(path, entry);
    if (entry === ".DS_Store" || entry.startsWith("._")) {
      rmSync(current, { recursive: true, force: true });
      continue;
    }
    if (statSync(current).isDirectory()) removeSidecars(current);
  }
}

function hashTree(path) {
  const hash = createHash("sha256");
  for (const file of listFiles(path).sort()) {
    hash.update(relative(path, file));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listFiles(path) {
  const stat = statSync(path);
  if (stat.isFile()) return [path];
  return readdirSync(path).flatMap((entry) => {
    if (entry === ".DS_Store" || entry.startsWith("._")) return [];
    return listFiles(join(path, entry));
  });
}

function readRootVersion() {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version ?? "0.0.0";
}

function fail(message) {
  console.error(`ELECTRON_PACK=BLOCKED: ${message}`);
  process.exit(1);
}
