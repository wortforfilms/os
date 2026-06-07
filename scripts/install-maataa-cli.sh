#!/usr/bin/env bash

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." >/dev/null 2>&1 && pwd -P)"
INSTALL_DIR="${1:-${MAATAA_CLI_INSTALL_DIR:-$HOME/.local/bin}}"
CLI_SOURCE="$REPO_ROOT/bin/maataa"
TARGET="$INSTALL_DIR/maataa"

if [ ! -f "$CLI_SOURCE" ]; then
  echo "INSTALL_STATUS=BLOCKED"
  echo "REASON=bin/maataa is missing."
  exit 1
fi

mkdir -p "$INSTALL_DIR" || {
  echo "INSTALL_STATUS=BLOCKED"
  echo "REASON=Could not create install directory: $INSTALL_DIR"
  exit 1
}

ln -sf "$CLI_SOURCE" "$TARGET" || {
  echo "INSTALL_STATUS=BLOCKED"
  echo "REASON=Could not link $TARGET"
  exit 1
}

echo "INSTALL_STATUS=INSTALLED"
echo "TARGET=$TARGET"
echo "SOURCE=$CLI_SOURCE"
echo "NO_GLOBAL_NPM=true"
echo "FINAL_STATUS=CONTROLLED_NO_GO"
