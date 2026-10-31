;; Greeter capsule: not built into the kernel. It is installed at run time,
;; over the host channel, and then runs as task 9 (docs/capsules.md).
;;
;; Build, sign and install:
;;   maataa-capsule wasm capsules/greeter.wat -o target/greeter.wasm
;;   maataa-capsule sign --name greeter --caps write,sleep \
;;     --payload target/greeter.wasm --dev -o assets/capsules/greeter.mcap
;;   maataa-link --serial PORT capsule-install assets/capsules/greeter.mcap
;;
;; Schedule and version (the signed `maataa` section): 2 ticks, 100 ms apart,
;; version 2. Installing an older version of "greeter" afterwards is refused.
(module
  (@custom "maataa" "ticks=2 period_ms=100 version=2")
  (import "maataa" "log_str" (func $log_str (param i32 i32)))

  (memory 1)
  (data (i32.const 0) "greeter capsule up")

  (global $n (mut i32) (i32.const 0))

  (func (export "init")
    i32.const 0 i32.const 18 call $log_str)

  ;; Returns 100 + the tick number.
  (func (export "tick") (result i32)
    global.get $n i32.const 1 i32.add global.set $n
    global.get $n i32.const 100 i32.add))
