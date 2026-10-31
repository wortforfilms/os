;; Telemetry capsule: the first WebAssembly program Maataa OS runs.
;;
;; Build and sign (see docs/capsules.md):
;;   maataa-capsule wasm capsules/telemetry.wat -o target/telemetry.wasm
;;   maataa-capsule sign --name telemetry --caps write,sleep \
;;     --payload target/telemetry.wasm --dev -o assets/capsules/telemetry.mcap
;;
;; Its signed manifest grants `write` and `sleep` only. The kernel runs it as
;; task 7 and maps each import to a supervisor call made by that task, so the
;; capability check applies to the capsule exactly as to native code.
(module
  (import "maataa" "log" (func $log (param i32)))
  (import "maataa" "sleep_ms" (func $sleep_ms (param i32) (result i32)))
  (import "maataa" "led" (func $led (param i32) (result i32)))

  (global $ticks (mut i32) (i32.const 0))

  ;; Fibonacci number n, iteratively.
  (func $fib (param $n i32) (result i32) (local $a i32) (local $b i32) (local $t i32)
    i32.const 1 local.set $b
    block $done
      loop $next
        local.get $n i32.eqz br_if $done
        local.get $a local.get $b i32.add local.set $t
        local.get $b local.set $a
        local.get $t local.set $b
        local.get $n i32.const 1 i32.sub local.set $n
        br $next
      end
    end
    local.get $a)

  ;; Run once. Asks for the LED, which the manifest does not grant, and
  ;; returns the kernel's answer: ENOCAP (-16).
  (func (export "init") (result i32)
    i32.const 1 call $led)

  ;; Run each period: count the tick, log fib(10 + tick) and return it.
  (func (export "tick") (result i32) (local $value i32)
    global.get $ticks i32.const 1 i32.add global.set $ticks
    global.get $ticks i32.const 10 i32.add call $fib
    local.tee $value call $log
    local.get $value))
