#!/bin/bash
# Power-cut test for the store on a NUCLEO-F411RE that already runs this
# kernel (Board test.command). It needs a person: in each round the script
# writes numbered 64-byte values to key 63 as fast as the board takes them,
# and you pull the USB cable (which cuts the board's power) while it writes,
# then plug it back in. After the reboot key 63 must hold the last value the
# board acknowledged, or the one that was in flight; never a torn or mixed
# value, and the store must mount. Compaction runs every ~1,500 writes, so
# some cuts land in it.
#
#   ./scripts/board-power-cut-test.sh [ROUNDS]     (default 3)
#
# A round counts only if the boot count went up (the board really lost
# power); otherwise it is repeated, up to 3 x ROUNDS tries.
# Log: target/board-power-cut.txt. Exit status 0 only if every round passed.
set -u
cd "$(dirname "$0")/.."
export PATH="$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
# Keep the Mac awake: when it sleeps the ST-LINK resets the board.
command -v caffeinate >/dev/null && caffeinate -dimsu -w $$ &
ROUNDS="${1:-3}"
LOG=target/board-power-cut.txt
WRITES=target/board-power-cut-writes.txt
mkdir -p target
: >"$LOG"
say() { echo "$@" | tee -a "$LOG"; }
port() { ls /dev/cu.usbmodem* 2>/dev/null | head -n 1; }
# One boot-info reply, retried: right after a reboot the first request can
# time out. BOOT_LINE is the reply (or the last error), BOOT the boot number
# parsed from that same reply (empty if none came).
read_boot() {
    BOOT_LINE=""; BOOT=""
    for _ in 1 2 3 4 5; do
        BOOT_LINE="$("${L[@]}" boot-info 2>&1)"
        BOOT="$(printf '%s\n' "$BOOT_LINE" | sed -n 's/^boot \([0-9]*\);.*/\1/p')"
        [ -n "$BOOT" ] && return 0
        sleep 1
    done
    return 1
}

cargo build -q --release -p maataa-link --features cli || exit 1
PORT="${MAATAA_SERIAL:-$(port)}"
[ -n "$PORT" ] || { say "FAIL: no /dev/cu.usbmodem* port: is the Nucleo plugged in?"; exit 1; }
L=(target/release/maataa-link --serial "$PORT" --timeout-ms 3000)
say "$(date); port $PORT; $ROUNDS rounds"
"${L[@]}" info | tee -a "$LOG" || { say "FAIL: the board does not answer"; exit 1; }

passed=0
round=0
tries=0
while [ "$round" -lt "$ROUNDS" ] && [ "$tries" -lt $((ROUNDS * 3)) ]; do
    round=$((round + 1))
    tries=$((tries + 1))
    say ""
    say "== round $round of $ROUNDS"
    read_boot
    before="$BOOT"
    echo "Writes start now. Pull the USB cable while the count climbs,"
    echo "wait about 3 seconds, then plug it back in."
    "${L[@]}" power-cut-write 1000000 >"$WRITES" 2>&1 &
    writer=$!
    while kill -0 "$writer" 2>/dev/null; do
        printf '\r  acknowledged writes: %s   ' "$(grep -c '^acked' "$WRITES")"
        sleep 0.5
    done
    wait "$writer"
    acked="$(grep -c '^acked' "$WRITES")"
    echo
    say "writes stopped: $acked acknowledged ($(tail -n 1 "$WRITES"))"
    if [ "$acked" -eq 0 ]; then
        say "FAIL: no write was acknowledged; is the board running the kernel?"
        continue
    fi
    echo "Waiting for the board to come back (plug the cable in) ..."
    back=0
    for _ in $(seq 1 120); do
        if [ -n "$(port)" ] && "${L[@]}" ping back >/dev/null 2>&1; then back=1; break; fi
        sleep 1
    done
    if [ "$back" -ne 1 ]; then
        say "FAIL: the board did not answer within 2 minutes"
        continue
    fi
    read_boot
    say "$BOOT_LINE"
    after="$BOOT"
    # Without a new boot the power was never cut (a short pull, or only the
    # serial link dropped): check the store anyway, but repeat the round.
    if [ -z "$before" ] || [ -z "$after" ] || [ "$after" -le "$before" ]; then
        "${L[@]}" power-cut-check "$acked" 2>&1 | tee -a "$LOG"
        say "NO POWER CUT: boot count ${before:-?} -> ${after:-?}; the board did not restart. Repeating the round (pull the cable fully, keep it out 3 s)."
        round=$((round - 1))
        continue
    fi
    check="$("${L[@]}" power-cut-check "$acked" 2>&1)"
    say "$check"
    if printf '%s\n' "$check" | grep -q '^PASS'; then
        passed=$((passed + 1))
    fi
done
say ""
if [ "$passed" -eq "$ROUNDS" ]; then
    say "PASS: board power-cut test ($passed/$ROUNDS rounds)"
    exit 0
fi
say "FAIL: board power-cut test ($passed/$ROUNDS rounds passed)"
exit 1
