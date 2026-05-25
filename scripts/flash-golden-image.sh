#!/bin/bash
set -euo pipefail

PACKAGE_DIR="${1:-}"
shift || true

if [ -z "${PACKAGE_DIR}" ] || [ "$#" -lt 1 ]; then
  echo "usage: $0 <dist-golden/package-dir> <block-device> [block-device...]" >&2
  echo "set MAATAA_FLASH_APPLY=1 to actually write devices; default is dry-run" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERIFY_SCRIPT="${ROOT_DIR}/scripts/verify-golden-image.sh"
IMAGE="${PACKAGE_DIR}/kernel/maataa-os.bin"
BLOCK_SIZE="${MAATAA_BLOCK_SIZE:-4096}"
APPLY="${MAATAA_FLASH_APPLY:-0}"

bash "${VERIFY_SCRIPT}" "${PACKAGE_DIR}"

if [ ! -f "${IMAGE}" ]; then
  echo "kernel image not found: ${IMAGE}" >&2
  exit 1
fi

flash_one() {
  local device="$1"
  local readback
  readback="$(mktemp -t maataa-readback.XXXXXX)"

  case "${device}" in
    /dev/*|/private/tmp/*|/tmp/*) ;;
    *)
      echo "refusing suspicious device path: ${device}" >&2
      return 1
      ;;
  esac

  if [ "${APPLY}" != "1" ]; then
    echo "dry-run: dd if=${IMAGE} of=${device} bs=${BLOCK_SIZE} conv=fsync"
    echo "dry-run: read back and compare ${device}"
    return 0
  fi

  test -e "${device}" || {
    echo "device missing: ${device}" >&2
    return 1
  }

  dd if="${IMAGE}" of="${device}" bs="${BLOCK_SIZE}" conv=fsync status=none
  dd if="${device}" of="${readback}" bs="${BLOCK_SIZE}" count="$(( ($(wc -c < "${IMAGE}") + BLOCK_SIZE - 1) / BLOCK_SIZE ))" status=none
  cmp -n "$(wc -c < "${IMAGE}")" "${IMAGE}" "${readback}"
  rm -f "${readback}"
  echo "flash verified: ${device}"
}

pids=()
for device in "$@"; do
  flash_one "${device}" &
  pids+=("$!")
done

failed=0
for pid in "${pids[@]}"; do
  wait "${pid}" || failed=1
done

if [ "${failed}" -ne 0 ]; then
  echo "one or more flash targets failed verification" >&2
  exit 1
fi

echo "parallel flash routine complete"
