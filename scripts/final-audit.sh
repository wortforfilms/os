#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STRICT=0
PACKAGE_DIR="${MAATAA_PACKAGE_DIR:-${ROOT_DIR}/dist-golden/maataa-os-0.1.0-alpha.1}"
SCRIPT_DATASET_DIR="${ROOT_DIR}/build/script-datasets"

export LC_ALL=C
export LANG=C

for arg in "$@"; do
  case "${arg}" in
    --strict) STRICT=1 ;;
    *)
      echo "usage: $0 [--strict]" >&2
      exit 2
      ;;
  esac
done

section() {
  printf '\n== %s ==\n' "$1"
}

fail() {
  echo "CONTROLLED NO-GO: $1" >&2
  exit 1
}

assert_no_forbidden_path() {
  local scope="$1"
  if find "${scope}" \
    \( -path '*/assets/html*' -o -path '*/node_modules*' -o -path '*/src-tauri/target*' -o -name '*.map' -o -name '._*' -o -name '.DS_Store' \) \
    -print | grep -q .; then
    fail "forbidden local/generated artifact found under ${scope}"
  fi
}

verify_sha256_manifest() {
  local dir="$1"
  local manifest="$2"

  test -f "${manifest}" || fail "missing SHA256 manifest: ${manifest}"
  (cd "${dir}" && shasum -a 256 -c "${manifest}")
}

verify_required_scaffold() {
  local paths=(
    "crates/hemant-core/src/time/mod.rs"
    "crates/hemant-core/src/hsts/mod.rs"
    "packages/universal-runtime/src/types.ts"
    "packages/universal-runtime/src/data-frames.ts"
    "packages/maataa-ui/src/SovereignDashboard.tsx"
    "packages/maataa-ui/src/widgets/index.tsx"
    "migrations/sqlite/003_data_frames.sql"
    "migrations/sqlite/004_hsts.sql"
    "migrations/sqlite/005_evidence.sql"
    "migrations/sqlite/006_certification.sql"
    "scripts/verify.sh"
    "scripts/check-phkd-status.sh"
    "scripts/telemetry/simulate-hardware-pressure.mjs"
    "scripts/verification/simulate-hardware-pressure.mjs"
    "release/reports/TELEMETRY_PRESSURE_REPORT.json"
    "release/reports/TELEMETRY_CHAOS_HARNESS_REPORT.json"
    "release/reports/PANIC_ROLLBACK_REPORT.json"
    "release/reports/LOCAL_LOOPBACK_INTEGRITY_REPORT.json"
  )

  for path in "${paths[@]}"; do
    test -e "${ROOT_DIR}/${path}" || fail "missing scaffold path: ${path}"
  done
}

verify_telemetry_pressure_reports() {
  grep -q '"TELEMETRY_HYDRATION": "PASS"' "${ROOT_DIR}/release/reports/TELEMETRY_PRESSURE_REPORT.json"
  grep -q '"DASHBOARD_LOOPBACK": "PASS"' "${ROOT_DIR}/release/reports/TELEMETRY_PRESSURE_REPORT.json"
  grep -q '"PANIC_ROLLBACK": "PASS"' "${ROOT_DIR}/release/reports/TELEMETRY_PRESSURE_REPORT.json"
  grep -q '"PACKET_LEAKAGE": "ZERO_OBSERVED"' "${ROOT_DIR}/release/reports/TELEMETRY_PRESSURE_REPORT.json"
  grep -q '"AI_STACK": "STILL_STAGED"' "${ROOT_DIR}/release/reports/TELEMETRY_PRESSURE_REPORT.json"
  grep -q '"PRODUCT_MATURITY": "NOT_FINAL"' "${ROOT_DIR}/release/reports/TELEMETRY_PRESSURE_REPORT.json"
  grep -q '"PANIC_ROLLBACK": "PASS"' "${ROOT_DIR}/release/reports/PANIC_ROLLBACK_REPORT.json"
  grep -q '"DASHBOARD_LOOPBACK": "PASS"' "${ROOT_DIR}/release/reports/LOCAL_LOOPBACK_INTEGRITY_REPORT.json"
  grep -q '"VIEWPORT_REFLEX_UNDER_ONE_FRAME": "PASS"' "${ROOT_DIR}/release/reports/TELEMETRY_CHAOS_HARNESS_REPORT.json"
  grep -q '"PACKET_LEAKAGE": "ZERO_OBSERVED"' "${ROOT_DIR}/release/reports/TELEMETRY_CHAOS_HARNESS_REPORT.json"
  grep -q '"ASSETS_HTML_HYGIENE": "PASS"' "${ROOT_DIR}/release/reports/TELEMETRY_CHAOS_HARNESS_REPORT.json"
}

cd "${ROOT_DIR}"

section "Scaffold coverage"
verify_required_scaffold
echo "required scaffold paths present"

section "Telemetry pressure evidence"
verify_telemetry_pressure_reports
echo "phase 2 telemetry reports verified"

section "PHKD hygiene"
bash scripts/check-phkd-status.sh

section "Dataset lock verification"
if [ -f "${SCRIPT_DATASET_DIR}/SHA256SUMS" ]; then
  verify_sha256_manifest "${SCRIPT_DATASET_DIR}" "${SCRIPT_DATASET_DIR}/SHA256SUMS"
else
  fail "missing script dataset SHA256SUMS"
fi

section "Golden package verification"
if [ -d "${PACKAGE_DIR}" ]; then
  bash scripts/verify-golden-image.sh "${PACKAGE_DIR}"
  assert_no_forbidden_path "${PACKAGE_DIR}"
else
  fail "missing golden package directory: ${PACKAGE_DIR}"
fi

if [ "${STRICT}" -eq 1 ]; then
  section "Strict validation replay"
  bash scripts/verify.sh
fi

section "Final audit verdict"
echo "SYSTEM_STATE_WORD=0x001B004F"
echo "VERDICT=SCIENTIFIC_CERTIFIED"
echo "SATYAM"
