#!/bin/bash
set -euo pipefail

PACKAGE_DIR="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
HARDENING_MATRIX_JSON="${ROOT_DIR}/release/reports/PRODUCTION_HARDENING_MATRIX.json"

export LC_ALL=C
export LANG=C

if [ -z "${PACKAGE_DIR}" ]; then
  echo "usage: $0 <dist-golden/package-dir>" >&2
  exit 1
fi

if [ ! -d "${PACKAGE_DIR}" ]; then
  echo "package directory not found: ${PACKAGE_DIR}" >&2
  exit 1
fi

if [ ! -f "${HARDENING_MATRIX_JSON}" ]; then
  echo "hardening matrix report not found: ${HARDENING_MATRIX_JSON}" >&2
  exit 1
fi

if [ -d "${ROOT_DIR}/assets/html" ] && git -C "${ROOT_DIR}" ls-files --error-unmatch assets/html >/dev/null 2>&1; then
  echo "assets/html is tracked; local-only sandbox boundary violated" >&2
  exit 1
fi

MATRIX_STATE="$(node -e '
const fs = require("node:fs");
const matrix = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const entries = Object.values(matrix.domains || {}).flat();
const blocked = entries.filter((entry) => entry.state === "BLOCKED").map((entry) => entry.gate);
const unresolved = entries.filter((entry) => entry.state !== "PASS").map((entry) => `${entry.gate}:${entry.state}`);
if (matrix.productionReady === true && unresolved.length > 0) {
  console.error(`productionReady=true but unresolved gates remain: ${unresolved.join(", ")}`);
  process.exit(2);
}
console.log(JSON.stringify({
  productionReady: matrix.productionReady === true,
  phkdVerdict: matrix.phkdVerdict || "UNKNOWN",
  blocked,
  unresolved
}));
' "${HARDENING_MATRIX_JSON}")"

cd "${PACKAGE_DIR}"

required=(
  "SHA256SUMS"
  "PREBOOT.md"
  "golden-image.manifest"
  "kernel/maataa-os.bin"
  "kernel/maataa-os-stripped.elf"
  "runtime/init"
  "manifests/assets-manifest.json"
  "manifests/model-manifest.json"
  "manifests/resource-manifest.json"
  "ui/index.html"
)

for path in "${required[@]}"; do
  test -e "${path}" || {
    echo "missing package artifact: ${path}" >&2
    exit 1
  }
done

if find . \( -path '*assets/html*' -o -path '*node_modules*' -o -path '*src-tauri/target*' -o -name '*.map' -o -name '._*' -o -name '.DS_Store' -o -name 'SHA256SUMS.tmp' \) | grep -q .; then
  echo "package contains forbidden local/generated artifacts" >&2
  exit 1
fi

grep -q "Driver Registry>Flash Manifest>Static Capsules>Scheduler Demo>Health Console" golden-image.manifest
grep -q "RecoveryConsole" PREBOOT.md
grep -q "load virtual driver registry" runtime/init
grep -q "mount virtual flash manifest" runtime/init
grep -q "load static capsules" runtime/init
grep -q "run deterministic scheduler demo" runtime/init
grep -q "emit runtime health" runtime/init

shasum -a 256 -c SHA256SUMS

PACKAGE_KERNEL_HASH="$(shasum -a 256 kernel/maataa-os.bin | awk '{print $1}')"
RECORDED_KERNEL_HASH="$(awk '$2 == "kernel/maataa-os.bin" {print $1}' SHA256SUMS)"
if [ "${PACKAGE_KERNEL_HASH}" != "${RECORDED_KERNEL_HASH}" ]; then
  echo "kernel hash mismatch against package SHA256SUMS" >&2
  exit 1
fi

echo "production hardening matrix: ${MATRIX_STATE}"
echo "golden image verification passed: ${PACKAGE_DIR}"
