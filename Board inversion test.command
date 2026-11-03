#!/bin/bash
# Double-click: scripts/board-inversion-test.sh. Flashes two test kernels
# (priority inheritance on, and off for comparison), records the serial port
# for 15 s each, then puts the normal kernel back. About 2 minutes; nothing
# to do by hand. Output also in target/board-inversion.txt.
cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
# Keep the Mac awake until this script exits: when the Mac sleeps, the
# ST-LINK resets the board (docs/EVIDENCE_MATRIX.md).
command -v caffeinate >/dev/null && caffeinate -dimsu -w $$ &
./scripts/board-inversion-test.sh
echo "exit status: $?"
read -r -t 900 -p "Press Return to close." _
