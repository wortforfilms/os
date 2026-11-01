;; Panini capsule: vowel sandhi (ac-sandhi) after Panini's Ashtadhyayi,
;; over SLP1 text, in hand-written WebAssembly. Installed at run time; it runs
;; as task 9 (docs/panini.md).
;;
;; The rules and their order are those of crates/maataa-sandhi, the
;; reference; src/capsule_task.rs checks this capsule against it for every
;; pair of boundary letters. Maataa's interpreter runs only an i32 subset
;; (no i64, floats, tables or call_indirect) in 4 KiB of memory, which is why
;; this is written by hand rather than compiled from the crate.
;;
;; Requests go through the store, the only input a capsule has:
;;   maataa-link ... put 41            # clear an old answer
;;   maataa-link ... put 40 deva+indra # the request: two words, one +
;;   maataa-link ... get 41            # "devendra" once a tick has run
;; Each tick reads key 40. If there is a request it writes the answer to key
;; 41 ("?" if the request is malformed), logs it, deletes key 40 and returns
;; the rule (1 join, 2 savarna-dirgha, 3 guna, 4 vrddhi, 5 yan, 6 ayadi,
;; 7 purvarupa) or an error (-101 no +, -102 empty word, -103 not SLP1).
;; With no request it returns 0 and writes nothing, so flash is written only
;; when there is work.
;;
;; Version 2: `log=quiet` in the manifest, so the kernel logs a tick only
;; when it returns an error (negative). An answer is still logged, by the
;; capsule itself; an idle tick is not logged at all.
;;
;; Build, sign and install:
;;   maataa-capsule wasm capsules/panini.wat -o target/panini.wasm
;;   maataa-capsule sign --name panini --caps write,sleep,store_get,store_put \
;;     --payload target/panini.wasm --dev -o assets/capsules/panini.mcap
;;   maataa-link --serial PORT capsule-install assets/capsules/panini.mcap
(module
  (@custom "maataa" "ticks=0 period_ms=1000 version=2 log=quiet")
  (import "maataa" "log_str" (func $log_str (param i32 i32)))
  (import "maataa" "store_get" (func $store_get (param i32 i32 i32) (result i32)))
  (import "maataa" "store_put" (func $store_put (param i32 i32 i32) (result i32)))

  ;; Memory map:
  ;;   0    "panini capsule up"
  ;;   32   "?" (the answer to a malformed request)
  ;;   128  class of each ASCII byte: 1..14 the vowels a A i I u U f F x X
  ;;        e E o O, 20 a consonant (M, H included), 0 not SLP1
  ;;   256  long vowel per grade (a i u f x): "AIUFX"
  ;;   264  semivowel per grade (i u f x): "yvrl"
  ;;   272  guna of a before grade 2..5, two bytes each (0: one letter)
  ;;   280  ayadi of e E o O, two bytes each
  ;;   512  the request (64 bytes)
  ;;   640  the answer (64 bytes)
  (memory 1)
  (data (i32.const 0) "panini capsule up")
  (data (i32.const 32) "?")
  (data (i32.const 128)
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"
    "\00\02\14\14\14\0c\08\14\14\04\14\14\00\14\14\0e"
    "\14\14\14\14\14\06\00\14\0a\14\00\00\00\00\00\00"
    "\00\01\14\14\14\0b\07\14\14\03\14\14\14\14\14\0d"
    "\14\14\14\14\14\05\14\14\09\14\14\00\00\00\00\00")
  (data (i32.const 256) "AIUFX")
  (data (i32.const 264) "yvrl")
  (data (i32.const 272) "e\00o\00aral")
  (data (i32.const 280) "ayAyavAv")

  (global $olen (mut i32) (i32.const 0))

  (func $class (param $c i32) (result i32)
    local.get $c i32.const 128 i32.ge_u
    if (result i32)
      i32.const 0
    else
      local.get $c i32.const 128 i32.add i32.load8_u
    end)

  ;; Simple vowels have a grade (1 a, 2 i, 3 u, 4 f, 5 x); others 0.
  (func $grade (param $k i32) (result i32)
    local.get $k i32.const 10 i32.gt_u
    if (result i32)
      i32.const 0
    else
      local.get $k i32.const 1 i32.add i32.const 1 i32.shr_u
    end)

  ;; Appends one byte to the answer.
  (func $put1 (param $b i32)
    global.get $olen i32.const 640 i32.add local.get $b i32.store8
    global.get $olen i32.const 1 i32.add global.set $olen)

  ;; Appends `len` bytes from `src` to the answer.
  (func $put (param $src i32) (param $len i32) (local $i i32)
    block $done
      loop $next
        local.get $i local.get $len i32.ge_s br_if $done
        local.get $src local.get $i i32.add i32.load8_u call $put1
        local.get $i i32.const 1 i32.add local.set $i
        br $next
      end
    end)

  ;; Joins the request of `n` bytes at 512 into the answer; returns the rule
  ;; or an error, as crates/maataa-sandhi does.
  (func $join (param $n i32) (result i32)
    (local $p i32) (local $i i32) (local $a i32) (local $b i32)
    (local $ga i32) (local $gb i32) (local $e i32)
    i32.const 0 global.set $olen
    ;; The first + splits the words.
    i32.const -1 local.set $p
    block $found
      loop $scan
        local.get $i local.get $n i32.ge_s br_if $found
        local.get $i i32.const 512 i32.add i32.load8_u i32.const 43 i32.eq
        if
          local.get $i local.set $p
          br $found
        end
        local.get $i i32.const 1 i32.add local.set $i
        br $scan
      end
    end
    local.get $p i32.const 0 i32.lt_s
    if i32.const -101 return end
    local.get $p i32.eqz
    local.get $p local.get $n i32.const 1 i32.sub i32.eq
    i32.or
    if i32.const -102 return end
    ;; Every other byte must be an SLP1 letter (a second + is not).
    i32.const 0 local.set $i
    block $checked
      loop $check
        local.get $i local.get $n i32.ge_s br_if $checked
        local.get $i local.get $p i32.ne
        if
          local.get $i i32.const 512 i32.add i32.load8_u call $class i32.eqz
          if i32.const -103 return end
        end
        local.get $i i32.const 1 i32.add local.set $i
        br $check
      end
    end
    local.get $p i32.const 511 i32.add i32.load8_u call $class local.set $a
    local.get $p i32.const 513 i32.add i32.load8_u call $class local.set $b
    ;; A consonant on either side: joined as written.
    local.get $a i32.const 14 i32.gt_u
    local.get $b i32.const 14 i32.gt_u
    i32.or
    if
      i32.const 512 local.get $p call $put
      local.get $p i32.const 513 i32.add local.get $n local.get $p i32.sub i32.const 1 i32.sub call $put
      i32.const 1 return
    end
    local.get $a call $grade local.set $ga
    local.get $b call $grade local.set $gb
    ;; Everything but the meeting vowels: stem = left minus its last letter.
    i32.const 512 local.get $p i32.const 1 i32.sub call $put
    ;; 6.1.101 savarna-dirgha: like simple vowels make the long one.
    local.get $ga i32.const 0 i32.ne
    local.get $ga local.get $gb i32.eq
    i32.and
    if
      local.get $ga i32.const 255 i32.add i32.load8_u call $put1
      local.get $p i32.const 514 i32.add local.get $n local.get $p i32.sub i32.const 2 i32.sub call $put
      i32.const 2 return
    end
    ;; 6.1.87 guna: a/A before i u f x.
    local.get $ga i32.const 1 i32.eq
    local.get $gb i32.const 2 i32.ge_u
    i32.and
    if
      local.get $gb i32.const 2 i32.sub i32.const 1 i32.shl i32.const 272 i32.add local.set $e
      local.get $e i32.load8_u call $put1
      local.get $e i32.load8_u offset=1
      if local.get $e i32.load8_u offset=1 call $put1 end
      local.get $p i32.const 514 i32.add local.get $n local.get $p i32.sub i32.const 2 i32.sub call $put
      i32.const 3 return
    end
    ;; 6.1.88 vrddhi: a/A before e E (E) or o O (O).
    local.get $ga i32.const 1 i32.eq
    if
      i32.const 69 i32.const 79 local.get $b i32.const 12 i32.le_u select call $put1
      local.get $p i32.const 514 i32.add local.get $n local.get $p i32.sub i32.const 2 i32.sub call $put
      i32.const 4 return
    end
    ;; 6.1.77 yan: i u f x before an unlike vowel become y v r l.
    local.get $ga i32.const 2 i32.ge_u
    if
      local.get $ga i32.const 262 i32.add i32.load8_u call $put1
      local.get $p i32.const 513 i32.add local.get $n local.get $p i32.sub i32.const 1 i32.sub call $put
      i32.const 5 return
    end
    ;; 6.1.109 purvarupa: final e/o swallows a following a (avagraha ').
    local.get $a i32.const 11 i32.eq
    local.get $a i32.const 13 i32.eq
    i32.or
    local.get $b i32.const 1 i32.eq
    i32.and
    if
      local.get $p i32.const 511 i32.add i32.load8_u call $put1
      i32.const 39 call $put1
      local.get $p i32.const 514 i32.add local.get $n local.get $p i32.sub i32.const 2 i32.sub call $put
      i32.const 7 return
    end
    ;; 6.1.78 ayadi: e E o O before a vowel become ay Ay av Av.
    local.get $a i32.const 11 i32.sub i32.const 1 i32.shl i32.const 280 i32.add local.set $e
    local.get $e i32.load8_u call $put1
    local.get $e i32.load8_u offset=1 call $put1
    local.get $p i32.const 513 i32.add local.get $n local.get $p i32.sub i32.const 1 i32.sub call $put
    i32.const 6)

  (func (export "init")
    i32.const 0 i32.const 17 call $log_str)

  (func (export "tick") (result i32) (local $n i32) (local $r i32)
    i32.const 40 i32.const 512 i32.const 64 call $store_get local.set $n
    ;; No request (ENOENT), or the store is unavailable: nothing to do.
    local.get $n i32.const 0 i32.le_s
    if i32.const 0 return end
    local.get $n call $join local.set $r
    local.get $r i32.const 0 i32.lt_s
    if
      i32.const 41 i32.const 32 i32.const 1 call $store_put drop
    else
      i32.const 41 i32.const 640 global.get $olen call $store_put drop
      i32.const 640 global.get $olen call $log_str
    end
    ;; The request is done: an empty value deletes key 40.
    i32.const 40 i32.const 0 i32.const 0 call $store_put drop
    local.get $r))
