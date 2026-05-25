#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEVICE="${1:-}"
PACKAGE_DIR="${MAATAA_PACKAGE_DIR:-${ROOT_DIR}/dist-golden/maataa-os-0.1.0-alpha.1}"
SCRIPT_MANIFEST="${MAATAA_SCRIPT_MANIFEST:-${ROOT_DIR}/build/script-datasets/SHA256SUMS}"
PACKAGE_MANIFEST="${MAATAA_PACKAGE_MANIFEST:-${PACKAGE_DIR}/SHA256SUMS}"
OUT_DIR="${MAATAA_AUDIT_DIR:-${ROOT_DIR}/build/hardware-audits}"
EXPECTED_BYTES="${MAATAA_EXPECTED_BYTES:-15756}"
EXPECTED_SHA256="${MAATAA_EXPECTED_SHA256:-}"
EXPECTED_ENTRY="${MAATAA_EXPECTED_MANIFEST_ENTRY:-gold-master-15756.bin}"
FALLBACK_ENTRY="${MAATAA_FALLBACK_MANIFEST_ENTRY:-kernel/maataa-os.bin}"
BLOCK_SIZE="${MAATAA_BLOCK_SIZE:-4096}"
HEARTBEAT_WORD="${MAATAA_HEARTBEAT_WORD:-0x001b004f}"
HEARTBEAT_FRAME="${MAATAA_HEARTBEAT_FRAME:-}"

if [ -z "${DEVICE}" ]; then
  echo "usage: $0 <raw-block-device>" >&2
  echo "example: MAATAA_EXPECTED_SHA256=<sha256> $0 /dev/rdiskX" >&2
  exit 2
fi

case "${DEVICE}" in
  /dev/*|/private/tmp/*|/tmp/*) ;;
  *)
    echo "refusing suspicious device path: ${DEVICE}" >&2
    exit 2
    ;;
esac

case "${DEVICE}" in
  *assets/html*)
    echo "refusing local-only assets/html boundary" >&2
    exit 2
    ;;
esac

mkdir -p "${OUT_DIR}"

REPORT="${OUT_DIR}/$(basename "${DEVICE}")-$(date -u +%Y%m%dT%H%M%SZ).json"

node "${ROOT_DIR}/core/node-bridge/ipc/flash-verifier-cli.js" \
  --device "${DEVICE}" \
  --script-manifest "${SCRIPT_MANIFEST}" \
  --package-manifest "${PACKAGE_MANIFEST}" \
  --expected-bytes "${EXPECTED_BYTES}" \
  --expected-sha256 "${EXPECTED_SHA256}" \
  --expected-entry "${EXPECTED_ENTRY}" \
  --fallback-entry "${FALLBACK_ENTRY}" \
  --block-size "${BLOCK_SIZE}" \
  --heartbeat-word "${HEARTBEAT_WORD}" \
  --heartbeat-frame "${HEARTBEAT_FRAME}" \
  --output "${REPORT}"

echo "post-flash audit report: ${REPORT}"
