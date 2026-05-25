#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST_FILE="${ROOT_DIR}/deployment/golden-image.manifest"

export LC_ALL=C
export LANG=C

if [ ! -f "${MANIFEST_FILE}" ]; then
  echo "missing deployment manifest: ${MANIFEST_FILE}" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "${MANIFEST_FILE}"

PACKAGE_DIR="${ROOT_DIR}/dist-golden/${MAATAA_PACKAGE_NAME}"
KERNEL_ELF="${ROOT_DIR}/target/thumbv7em-none-eabihf/release/maataa-os"
KERNEL_BIN="${PACKAGE_DIR}/kernel/maataa-os.bin"
KERNEL_STRIPPED_ELF="${PACKAGE_DIR}/kernel/maataa-os-stripped.elf"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "required command not found: $1" >&2
    exit 1
  }
}

assert_no_forbidden_path() {
  local path="$1"
  case "${path}" in
    *assets/html*|*node_modules*|*src-tauri/target*|*src-tauri/gen*|*target/thumbv7em-none-eabihf*|*dist-golden*|*/._*|._*)
      echo "refusing to package forbidden local/generated path: ${path}" >&2
      exit 1
      ;;
  esac
}

clean_metadata_files() {
  find "$1" \( -name '._*' -o -name '.DS_Store' \) -delete
}

verify_boot_contract() {
  local runtime_init="${ROOT_DIR}/assets/runtime/init"
  local system_entry="${ROOT_DIR}/apps/system/index.tsx"

  grep -q "load virtual driver registry" "${runtime_init}"
  grep -q "mount virtual flash manifest" "${runtime_init}"
  grep -q "load static capsules" "${runtime_init}"
  grep -q "run deterministic scheduler demo" "${runtime_init}"
  grep -q "emit runtime health" "${runtime_init}"

  grep -q "driver-registry" "${system_entry}"
  grep -q "flash-manifest" "${system_entry}"
  grep -q "static-capsules" "${system_entry}"
  grep -q "scheduler-demo" "${system_entry}"
  grep -q "health-console" "${system_entry}"
  grep -q "RecoveryConsole" "${system_entry}"
}

write_sha256sums() {
  local sums_tmp
  sums_tmp="$(mktemp -t maataa-sha256sums.XXXXXX)"

  (
    cd "${PACKAGE_DIR}"
    find . -type f \
      ! -name SHA256SUMS \
      ! -name '._*' \
      ! -path './reports/*' \
      -print | sort | while IFS= read -r file; do
        assert_no_forbidden_path "${file}"
        shasum -a 256 "${file#./}"
      done > "${sums_tmp}"
  )

  cp "${sums_tmp}" "${PACKAGE_DIR}/SHA256SUMS"
  rm -f "${sums_tmp}"
  clean_metadata_files "${PACKAGE_DIR}"
}

require_cmd cargo
require_cmd npm
require_cmd shasum
require_cmd arm-none-eabi-objcopy
require_cmd stat

STRIP_TOOL="arm-none-eabi-strip"
if ! command -v "${STRIP_TOOL}" >/dev/null 2>&1; then
  STRIP_TOOL="true"
  echo "warning: arm-none-eabi-strip unavailable; stripped ELF will be copied without extra stripping" >&2
fi

cd "${ROOT_DIR}"

echo "== Phase A: local validation =="
bash scripts/scaffold-check.sh
bash scripts/smoke-alpha.sh
verify_boot_contract

echo "== Building minimized frontend =="
npm run build:web
if find dist -type f \( -name '*.map' -o -name '*.tsbuildinfo' \) -print | grep -q .; then
  echo "frontend build produced forbidden source map/debug artifacts" >&2
  exit 1
fi

echo "== Building and stripping kernel =="
cargo build --release --target thumbv7em-none-eabihf
rm -rf "${PACKAGE_DIR}"
mkdir -p "${PACKAGE_DIR}/kernel" "${PACKAGE_DIR}/ui" "${PACKAGE_DIR}/runtime" "${PACKAGE_DIR}/manifests" "${PACKAGE_DIR}/reports"
cp "${KERNEL_ELF}" "${KERNEL_STRIPPED_ELF}"
if [ "${STRIP_TOOL}" != "true" ]; then
  "${STRIP_TOOL}" --strip-all "${KERNEL_STRIPPED_ELF}"
fi
arm-none-eabi-objcopy -O binary "${KERNEL_STRIPPED_ELF}" "${KERNEL_BIN}"

KERNEL_BYTES="$(stat -f%z "${KERNEL_BIN}" 2>/dev/null || stat -c%s "${KERNEL_BIN}")"
if [ "${KERNEL_BYTES}" -gt "${MAATAA_FLASH_BYTES}" ]; then
  echo "kernel image exceeds flash geometry: ${KERNEL_BYTES}/${MAATAA_FLASH_BYTES}" >&2
  exit 1
fi

echo "== Assembling immutable package =="
cp -R dist/. "${PACKAGE_DIR}/ui/"
cp assets/runtime/init "${PACKAGE_DIR}/runtime/init"
cp assets/manifest.json "${PACKAGE_DIR}/manifests/assets-manifest.json"
cp resources/resource-manifest.json "${PACKAGE_DIR}/manifests/resource-manifest.json"
cp offline-models/model-manifest.json "${PACKAGE_DIR}/manifests/model-manifest.json"
cp deployment/golden-image.manifest "${PACKAGE_DIR}/golden-image.manifest"

cat > "${PACKAGE_DIR}/PREBOOT.md" <<PREBOOT
# Maataa OS Pre-Boot Contract

Version: ${MAATAA_GOLDEN_VERSION}
Stage: ${MAATAA_STAGE}
Boot contract: ${MAATAA_BOOT_CONTRACT}
Recovery fallback: ${MAATAA_RECOVERY_CONSOLE}

Pre-boot verification must run \`shasum -a 256 -c SHA256SUMS\`.
Any mismatch drops the device into RecoveryConsole and must not continue boot.
PREBOOT

find "${PACKAGE_DIR}" -path '*assets/html*' -print | grep -q . && {
  echo "forbidden assets/html escaped into package" >&2
  exit 1
}

clean_metadata_files "${PACKAGE_DIR}"
write_sha256sums
bash scripts/verify-golden-image.sh "${PACKAGE_DIR}"

echo "golden image ready: ${PACKAGE_DIR}"
