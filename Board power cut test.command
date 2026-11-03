#!/bin/bash
# Double-click: scripts/board-power-cut-test.sh (3 rounds). In each round pull
# the Nucleo's USB cable while the write count climbs, then plug it back in.
# Output also in target/board-power-cut.txt.
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
# Keep the Mac awake until this script exits: when the Mac sleeps, the
# ST-LINK resets the board (docs/EVIDENCE_MATRIX.md).
command -v caffeinate >/dev/null && caffeinate -dimsu -w $$ &
./scripts/board-power-cut-test.sh 3
echo "exit status: $?"
read -r -t 900 -p "Press Return to close." _
