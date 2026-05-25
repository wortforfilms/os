#!/bin/bash
set -euo pipefail

PACKAGE_DIR="${1:-}"

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

echo "golden image verification passed: ${PACKAGE_DIR}"
