#!/usr/bin/env bash

set -u

INSTALL_DIR="${1:-${MAATAA_CLI_INSTALL_DIR:-$HOME/.local/bin}}"
TARGET="$INSTALL_DIR/maataa"

if [ ! -e "$TARGET" ]; then
  echo "UNINSTALL_STATUS=UNKNOWN"
  echo "REASON=No maataa CLI found at $TARGET"
  exit 0
fi

if [ ! -L "$TARGET" ]; then
  echo "UNINSTALL_STATUS=BLOCKED"
  echo "REASON=$TARGET exists but is not a symlink created by this installer."
  exit 1
fi

rm -f "$TARGET" || {
  echo "UNINSTALL_STATUS=BLOCKED"
  echo "REASON=Could not remove $TARGET"
  exit 1
}

echo "UNINSTALL_STATUS=REMOVED"
echo "TARGET=$TARGET"
