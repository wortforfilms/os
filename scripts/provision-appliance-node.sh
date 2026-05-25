#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEVICE="${1:-}"
MANIFEST_FILE="${ROOT_DIR}/deployment/golden-image.manifest"

if [ -f "${MANIFEST_FILE}" ]; then
  # shellcheck disable=SC1090
  source "${MANIFEST_FILE}"
fi

PACKAGE_DIR="${MAATAA_PACKAGE_DIR:-${ROOT_DIR}/dist-golden/${MAATAA_PACKAGE_NAME:-maataa-os-0.1.0-alpha.1}}"
AUDIT_DIR="${MAATAA_AUDIT_DIR:-${ROOT_DIR}/build/hardware-audits}"
RECEIPT_DIR="${MAATAA_RECEIPT_DIR:-${ROOT_DIR}/build/receipts}"
REGISTRY="${MAATAA_APPLIANCE_REGISTRY:-${ROOT_DIR}/apps/tlp/production-os/data/appliances.json}"
EXPECTED_BYTES="${MAATAA_EXPECTED_BYTES:-15756}"
EXPECTED_SHA256="${MAATAA_EXPECTED_SHA256:-}"
EXPECTED_ENTRY="${MAATAA_EXPECTED_MANIFEST_ENTRY:-gold-master-15756.bin}"
FALLBACK_ENTRY="${MAATAA_FALLBACK_MANIFEST_ENTRY:-kernel/maataa-os.bin}"
BLOCK_SIZE="${MAATAA_BLOCK_SIZE:-4096}"
HEARTBEAT_WORD="${MAATAA_HEARTBEAT_WORD:-0x001b004f}"
HEARTBEAT_FRAME="${MAATAA_HEARTBEAT_FRAME:-}"
DEVICE_SERIAL="${MAATAA_DEVICE_SERIAL:-}"

if [ -z "${DEVICE}" ]; then
  echo "usage: $0 <raw-block-device>" >&2
  echo "example: MAATAA_FLASH_APPLY=1 MAATAA_EXPECTED_SHA256=<sha256> $0 /dev/rdiskX" >&2
  exit 2
fi

case "${DEVICE}" in
  /dev/*|/private/tmp/*|/tmp/*) ;;
  *)
    echo "refusing suspicious device path: ${DEVICE}" >&2
    exit 2
    ;;
esac

case "${DEVICE}:${PACKAGE_DIR}:${AUDIT_DIR}:${RECEIPT_DIR}:${REGISTRY}" in
  *assets/html*)
    echo "refusing local-only assets/html boundary" >&2
    exit 2
    ;;
esac

if [ "${MAATAA_FLASH_APPLY:-0}" != "1" ]; then
  echo "refusing to provision without MAATAA_FLASH_APPLY=1" >&2
  exit 2
fi

mkdir -p "${AUDIT_DIR}" "${RECEIPT_DIR}" "$(dirname "${REGISTRY}")"

echo "phase 1/3: burn gold master image -> ${DEVICE}"
MAATAA_FLASH_APPLY=1 bash "${ROOT_DIR}/scripts/flash-golden-image.sh" "${PACKAGE_DIR}" "${DEVICE}"

AUDIT_REPORT="${AUDIT_DIR}/$(basename "${DEVICE}")-provision-$(date -u +%Y%m%dT%H%M%SZ).json"

echo "phase 2/3: post-flash sector audit -> ${AUDIT_REPORT}"
node "${ROOT_DIR}/core/node-bridge/ipc/flash-verifier-cli.js" \
  --device "${DEVICE}" \
  --script-manifest "${ROOT_DIR}/build/script-datasets/SHA256SUMS" \
  --package-manifest "${PACKAGE_DIR}/SHA256SUMS" \
  --expected-bytes "${EXPECTED_BYTES}" \
  --expected-sha256 "${EXPECTED_SHA256}" \
  --expected-entry "${EXPECTED_ENTRY}" \
  --fallback-entry "${FALLBACK_ENTRY}" \
  --block-size "${BLOCK_SIZE}" \
  --heartbeat-word "${HEARTBEAT_WORD}" \
  --heartbeat-frame "${HEARTBEAT_FRAME}" \
  --output "${AUDIT_REPORT}"

echo "phase 3/3: generate device identity and receipt"
node "${ROOT_DIR}/core/node-bridge/ipc/device-identity-generator.js" \
  --device "${DEVICE}" \
  --audit-report "${AUDIT_REPORT}" \
  --registry "${REGISTRY}" \
  --receipt-dir "${RECEIPT_DIR}" \
  --serial "${DEVICE_SERIAL}"

echo "hardware provisioning complete"
