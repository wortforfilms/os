;; Telemetry capsule: a WebAssembly program Maataa OS runs as task 7.
;;
;; Build and sign (see docs/wasm-capsules.md):
;;   maataa-capsule wasm capsules/telemetry.wat -o target/telemetry.wasm
;;   maataa-capsule sign --name telemetry --caps write,sleep,store_get,store_put \
;;     --payload target/telemetry.wasm --dev -o assets/capsules/telemetry.mcap
;;
;; Its signed manifest grants write, sleep, store_get and store_put, but not
;; led. Each import is a supervisor call made by task 7, so the kernel's
;; capability check applies to the capsule as to native code.
;;
;; Memory: the kernel gives the capsule a 4 KiB buffer. It holds the two
;; strings below and, at offset 64, the lifetime tick count, which is kept in
;; persistent key 32 and so keeps counting across reboots.
(module
  (import "maataa" "log" (func $log (param i32)))
  (import "maataa" "log_str" (func $log_str (param i32 i32)))
  (import "maataa" "sleep_ms" (func $sleep_ms (param i32) (result i32)))
  (import "maataa" "led" (func $led (param i32) (result i32)))
  (import "maataa" "store_get" (func $store_get (param i32 i32 i32) (result i32)))
  (import "maataa" "store_put" (func $store_put (param i32 i32 i32) (result i32)))

  (memory 1)
  (data (i32.const 0) "telemetry capsule up")
  (data (i32.const 32) "lifetime ticks")

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

  ;; Run once. Announces itself, loads the lifetime count from key 32 (0 if
  ;; it has none yet), then asks for the LED, which the manifest does not
  ;; grant, and returns the kernel's answer: ENOCAP (-16).
  (func (export "init") (result i32)
    i32.const 0 i32.const 20 call $log_str
    i32.const 32 i32.const 64 i32.const 4 call $store_get
    i32.const 4 i32.ne
    if
      i32.const 64 i32.const 0 i32.store
    end
    i32.const 1 call $led)

  ;; Run each period: count the tick, add it to the lifetime count and save
  ;; that to key 32, log it, and return fib(10 + tick).
  (func (export "tick") (result i32)
    global.get $ticks i32.const 1 i32.add global.set $ticks
    i32.const 64 i32.const 64 i32.load i32.const 1 i32.add i32.store
    i32.const 32 i32.const 64 i32.const 4 call $store_put drop
    i32.const 32 i32.const 14 call $log_str
    i32.const 64 i32.load call $log
    global.get $ticks i32.const 10 i32.add call $fib))
