;; Heartbeat capsule: the second WebAssembly program, in its own task.
;;
;; Build and sign (see docs/wasm-capsules.md):
;;   maataa-capsule wasm capsules/heartbeat.wat -o target/heartbeat.wasm
;;   maataa-capsule sign --name heartbeat --caps write,sleep \
;;     --payload target/heartbeat.wasm --dev -o assets/capsules/heartbeat.mcap
;;
;; Its signed manifest grants only write and sleep. It asks once to write the
;; persistent store and must be refused (ENOCAP, -16): two capsules running
;; side by side each get exactly their own capabilities.
;;
;; Schedule (the signed `maataa` section): 4 beats, 300 ms apart.
(module
  (@custom "maataa" "ticks=4 period_ms=300")
  (import "maataa" "log_str" (func $log_str (param i32 i32)))
  (import "maataa" "store_put" (func $store_put (param i32 i32 i32) (result i32)))

  (memory 1)
  (data (i32.const 0) "heartbeat capsule up")

  (global $beats (mut i32) (i32.const 0))

  ;; Run once: announce, then try to write key 33, which this capsule may not.
  (func (export "init") (result i32)
    i32.const 0 i32.const 20 call $log_str
    i32.const 33 i32.const 0 i32.const 4 call $store_put)

  ;; Run each period: return the beat number.
  (func (export "tick") (result i32)
    global.get $beats i32.const 1 i32.add global.set $beats
    global.get $beats))
