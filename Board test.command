#!/bin/bash
# Double-click: scripts/board-test.sh (build, flash, host-channel checks).
# Output also in target/board-test.txt.
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
./scripts/board-test.sh </dev/null
echo "exit status: $?"
read -r -t 900 -p "Press Return to close." _
