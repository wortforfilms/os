#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export LC_ALL=C
export LANG=C

if git -C "${ROOT_DIR}" ls-files -- 'assets/html/**' | grep -q .; then
  echo "PHKD=BLOCKED assets/html tracked" >&2
  exit 1
fi

if find "${ROOT_DIR}" \
  \( -path "${ROOT_DIR}/.git" -o -path "${ROOT_DIR}/target" -o -path "${ROOT_DIR}/node_modules" -o -path "${ROOT_DIR}/dist" -o -path "${ROOT_DIR}/dist-golden" \) -prune \
  -o \( -name '._*' -o -name '.DS_Store' \) -print | grep -q .; then
  echo "PHKD=BLOCKED platform metadata artifacts present" >&2
  exit 1
fi

echo "PHKD=NOMINAL"
echo "ASSETS_HTML=LOCAL_ONLY_UNTRACKED"
echo "SYSTEM_STATE_WORD=0x001B004F"
