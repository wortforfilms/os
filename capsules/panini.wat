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
;; 7 purvarupa; 8 to 17 the visarga rules, 18 to 26 hal sandhi, numbered
;; as Rule in the crate)
;; or an error (-101 no +, -102 empty word, -103 not SLP1, -105 not yet).
;; With no request it returns 0 and writes nothing, so flash is written only
;; when there is work.
;;
;; Version 6: final palatals: 8.2.30 coh kuh for c j J, 8.2.36 for C, then
;; the version 5 rules (no new rule numbers).
;; Version 5: hal sandhi for final stops and m (rules 18 to 26), as
;; crates/maataa-sandhi.
;; Version 4: visarga, s and r before a word, as crates/maataa-sandhi
;; (rules 8 to 17, and -105 for what it does not do yet).
;; Version 3: the same rules with its constants in one data segment
;; (version 2 used 7 of the interpreter's 8).
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
  (@custom "maataa" "ticks=0 period_ms=1000 version=6 log=quiet")
  (import "maataa" "log_str" (func $log_str (param i32 i32)))
  (import "maataa" "store_get" (func $store_get (param i32 i32 i32) (result i32)))
  (import "maataa" "store_put" (func $store_put (param i32 i32 i32) (result i32)))

  ;; Memory map:
  ;;   0    "panini capsule up"
  ;;   32   "?" (the answer to a malformed request)
  ;;   128  class of each ASCII byte: 1..14 the vowels a A i I u U f F x X
  ;;        e E o O; consonants by what the visarga rules need: 20 haS
  ;;        (voiced), 21 t T, 22 c C, 23 w W, 24 k K p P, 25 Sar (S z s),
  ;;        26 M H; 0 not SLP1. Every class above 14 is "not a vowel".
  ;;   256  long vowel per grade (a i u f x): "AIUFX"
  ;;   264  semivowel per grade (i u f x): "yvrl"
  ;;   272  guna of a before grade 2..5, two bytes each (0: one letter)
  ;;   280  ayadi of e E o O, two bytes each
  ;;   288  stop row * 8 + column of each ASCII byte (255: not a stop)
  ;;   416  the stops by row and column, "kKgGN cCjJY wWqQR tTdDn pPbBm"
  ;;   512  the request (64 bytes)
  ;;   640  the answer (64 bytes)
  (memory 1)
  ;; One data segment (the interpreter takes at most 8; version 2 used 7).
  (data (i32.const 0)
    ;; 0: the init message; 32: the answer to a malformed request
    "panini capsule up" "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"
    "?" "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"
    ;; 128: class of each ASCII byte (see the map above)
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"
    "\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00"
    "\00\02\14\16\14\0c\08\14\1a\04\14\18\00\1a\14\0e"
    "\18\14\14\19\15\06\00\17\0a\14\00\00\00\00\00\00"
    "\00\01\14\16\14\0b\07\14\14\03\14\18\14\14\14\0d"
    "\18\14\14\19\15\05\14\17\09\14\19\00\00\00\00\00"
    ;; 256: long vowels; 264: semivowels; 272: guna; 280: ayadi
    "AIUFX" "\00\00\00"
    "yvrl" "\00\00\00\00"
    "e\00o\00aral"
    "ayAyavAv"
    ;; 288: stop row * 8 + column of each ASCII byte, 255 if not a stop
    "\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff"
    "\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff"
    "\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff"
    "\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff"
    "\ff\ff\23\09\1b\ff\ff\03\ff\ff\0b\01\ff\ff\04\ff"
    "\21\13\14\ff\19\ff\ff\11\ff\0c\ff\ff\ff\ff\ff\ff"
    "\ff\ff\22\08\1a\ff\ff\02\ff\ff\0a\00\ff\24\1c\ff"
    "\20\12\ff\ff\18\ff\ff\10\ff\ff\ff\ff\ff\ff\ff\ff"
    ;; 416: the stops by row and column (row * 5 + column)
    "kKgGNcCjJYwWqQRtTdDnpPbBm")

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

  ;; Appends a space and the second word (bytes p+1 .. n).
  (func $space_right (param $p i32) (param $n i32)
    i32.const 32 call $put1
    local.get $p i32.const 513 i32.add
    local.get $n local.get $p i32.sub i32.const 1 i32.sub
    call $put)

  ;; Whether the first word (p bytes at 512) is "sa" + ending or "eza" +
  ;; ending (6.1.132).
  (func $sa_eza (param $p i32) (result i32)
    local.get $p i32.const 3 i32.eq
    i32.const 512 i32.load8_u i32.const 115 i32.eq
    i32.and
    i32.const 513 i32.load8_u i32.const 97 i32.eq
    i32.and
    local.get $p i32.const 4 i32.eq
    i32.const 512 i32.load8_u i32.const 101 i32.eq
    i32.and
    i32.const 513 i32.load8_u i32.const 122 i32.eq
    i32.and
    i32.const 514 i32.load8_u i32.const 97 i32.eq
    i32.and
    i32.or)

  ;; Visarga, s or r ending the first word (the + is at p, the request is n
  ;; bytes), in the order of visarga() in crates/maataa-sandhi: H and s are
  ;; s (8.2.66: ru), r is r. Returns the rule or -105.
  (func $visarga (param $p i32) (param $n i32) (result i32)
    (local $ru i32) (local $before i32) (local $y i32) (local $yb i32)
    (local $second i32)
    ;; The letter before must be a vowel; the second word may not start
    ;; with M or H.
    local.get $p i32.const 2 i32.lt_s
    if i32.const -105 return end
    local.get $p i32.const 510 i32.add i32.load8_u local.set $before
    local.get $p i32.const 513 i32.add i32.load8_u local.tee $yb
    call $class local.set $y
    local.get $before call $class i32.const 14 i32.gt_u
    local.get $y i32.const 26 i32.eq
    i32.or
    if i32.const -105 return end
    local.get $p i32.const 511 i32.add i32.load8_u i32.const 114 i32.ne local.set $ru
    ;; 6.1.132: sa / eza with ru before a consonant lose it (rule 17).
    local.get $ru
    local.get $y i32.const 20 i32.ge_u
    i32.and
    if
      local.get $p call $sa_eza
      if
        i32.const 512 local.get $p i32.const 1 i32.sub call $put
        local.get $p local.get $n call $space_right
        i32.const 17 return
      end
    end
    ;; Before khar (classes 21 to 25): visarga kept, or s.
    local.get $y i32.const 21 i32.ge_u
    if
      i32.const 0 local.set $second
      local.get $n local.get $p i32.sub i32.const 2 i32.gt_s
      if
        local.get $p i32.const 514 i32.add i32.load8_u call $class local.set $second
      end
      i32.const 512 local.get $p i32.const 1 i32.sub call $put
      ;; 8.3.35: khar followed by Sar (13).
      local.get $second i32.const 25 i32.eq
      if
        i32.const 72 call $put1 local.get $p local.get $n call $space_right
        i32.const 13 return
      end
      ;; 8.3.36 va Sari (14).
      local.get $y i32.const 25 i32.eq
      if
        i32.const 72 call $put1 local.get $p local.get $n call $space_right
        i32.const 14 return
      end
      ;; 8.3.37 kupvoh (15).
      local.get $y i32.const 24 i32.eq
      if
        i32.const 72 call $put1 local.get $p local.get $n call $space_right
        i32.const 15 return
      end
      ;; 8.3.34 visarjaniyasya sah, with 8.4.40 (S) and 8.4.41 (z) (12).
      i32.const 83
      i32.const 122
      i32.const 115
      local.get $y i32.const 23 i32.eq
      select
      local.get $y i32.const 22 i32.eq
      select
      call $put1
      local.get $p local.get $n call $space_right
      i32.const 12 return
    end
    ;; a + ru (H or s after a).
    local.get $ru
    local.get $before i32.const 97 i32.eq
    i32.and
    if
      ;; 6.1.113 with 6.1.87 and 6.1.109: before a, o' (9).
      local.get $yb i32.const 97 i32.eq
      if
        i32.const 512 local.get $p i32.const 2 i32.sub call $put
        i32.const 111 call $put1
        i32.const 39 call $put1
        local.get $p i32.const 514 i32.add
        local.get $n local.get $p i32.sub i32.const 2 i32.sub
        call $put
        i32.const 9 return
      end
      ;; 6.1.114 haSi ca with 6.1.87: before haS, o (8).
      local.get $y i32.const 20 i32.eq
      if
        i32.const 512 local.get $p i32.const 2 i32.sub call $put
        i32.const 111 call $put1
        local.get $p local.get $n call $space_right
        i32.const 8 return
      end
      ;; 8.3.17 then 8.3.19: before another vowel the y is dropped and no
      ;; vowel sandhi follows (8.3.19 is asiddha, 8.2.1) (10).
      i32.const 512 local.get $p i32.const 1 i32.sub call $put
      local.get $p local.get $n call $space_right
      i32.const 10 return
    end
    ;; A + ru: 8.3.19 before a vowel (10), 8.3.22 before haS (11).
    local.get $ru
    local.get $before i32.const 65 i32.eq
    i32.and
    if
      i32.const 512 local.get $p i32.const 1 i32.sub call $put
      local.get $p local.get $n call $space_right
      i32.const 11 i32.const 10 local.get $y i32.const 14 i32.gt_u select
      return
    end
    ;; r before r: 8.3.14 with 6.3.111, not yet.
    local.get $yb i32.const 114 i32.eq
    if i32.const -105 return end
    ;; Otherwise the r stays (16).
    i32.const 512 local.get $p i32.const 1 i32.sub call $put
    i32.const 114 call $put1
    local.get $p local.get $n call $space_right
    i32.const 16)

  ;; Stop row and column of a byte: row * 8 + column (rows velar, palatal,
  ;; retroflex, dental, labial; columns unvoiced, aspirated, voiced, voiced
  ;; aspirated, nasal), or 255 for anything else.
  (func $stop (param $c i32) (result i32)
    local.get $c i32.const 128 i32.ge_u
    if (result i32)
      i32.const 255
    else
      local.get $c i32.const 288 i32.add i32.load8_u
    end)

  ;; A first word ending in a consonant other than s and r (hal sandhi), in
  ;; the order of hal() in crates/maataa-sandhi: each rule sees the result of
  ;; the ones before it (8.2.1); the words are written joined, except after
  ;; 8.3.23. Returns the last rule applied (18 to 26), 1, or -105.
  (func $hal (param $p i32) (param $n i32) (result i32)
    (local $x i32) (local $y i32) (local $yc i32) (local $st i32)
    (local $row i32) (local $col i32) (local $rule i32) (local $first i32)
    (local $out i32) (local $next i32)
    local.get $p i32.const 511 i32.add i32.load8_u local.set $x
    local.get $p i32.const 513 i32.add i32.load8_u local.tee $y
    call $class local.set $yc
    ;; The second word must start with a vowel or a consonant.
    local.get $yc i32.const 26 i32.eq
    if i32.const -105 return end
    ;; 8.3.23: m before a consonant becomes anusvara (26); before a vowel,
    ;; joined as written (1).
    local.get $x i32.const 109 i32.eq
    if
      local.get $yc i32.const 14 i32.gt_u
      if
        i32.const 512 local.get $p i32.const 1 i32.sub call $put
        i32.const 77 call $put1
        local.get $p local.get $n call $space_right
        i32.const 26 return
      end
      i32.const 512 local.get $p call $put
      local.get $p i32.const 513 i32.add
      local.get $n local.get $p i32.sub i32.const 1 i32.sub
      call $put
      i32.const 1 return
    end
    ;; Taken: stops, not nasals.
    local.get $x call $stop local.tee $st
    i32.const 255 i32.eq
    if i32.const -105 return end
    local.get $st i32.const 7 i32.and i32.const 4 i32.eq
    if i32.const -105 return end
    local.get $st i32.const 3 i32.shr_u local.set $row
    ;; A final palatal: 8.2.36 makes C z, of the retroflex row; 8.2.30 coh
    ;; kuh makes c j J velar. (The roots of 8.2.36 come as their pada form.)
    local.get $row i32.const 1 i32.eq
    if
      i32.const 2 i32.const 0
      local.get $st i32.const 7 i32.and i32.const 1 i32.eq
      select local.set $row
    end
    ;; 8.2.39: the jaS of the row (18).
    i32.const 2 local.set $col
    i32.const 18 local.set $rule
    local.get $y local.set $first
    ;; 8.4.40 / 8.4.41: a dental next to S or the c row (19), z or the w
    ;; row (20).
    local.get $row i32.const 3 i32.eq
    if
      local.get $y i32.const 83 i32.eq
      local.get $y call $stop i32.const 3 i32.shr_u i32.const 1 i32.eq
      i32.or
      if
        i32.const 1 local.set $row
        i32.const 19 local.set $rule
      else
        local.get $y i32.const 122 i32.eq
        local.get $y call $stop i32.const 3 i32.shr_u i32.const 2 i32.eq
        i32.or
        if
          i32.const 2 local.set $row
          i32.const 20 local.set $rule
        end
      end
    end
    ;; 8.4.45: before a nasal, the row's nasal (21).
    local.get $y call $stop local.tee $st
    i32.const 255 i32.ne
    local.get $st i32.const 7 i32.and i32.const 4 i32.eq
    i32.and
    if
      i32.const 4 local.set $col
      i32.const 21 local.set $rule
    end
    ;; 8.4.55: before khar (classes 21 to 25), car (22).
    local.get $yc i32.const 21 i32.ge_u
    local.get $yc i32.const 25 i32.le_u
    i32.and
    if
      i32.const 0 local.set $col
      i32.const 22 local.set $rule
    end
    ;; The letter the final becomes.
    local.get $row i32.const 5 i32.mul local.get $col i32.add
    i32.const 416 i32.add i32.load8_u local.set $out
    ;; 8.4.60: the dental row before l becomes l (23).
    local.get $row i32.const 3 i32.eq
    local.get $y i32.const 108 i32.eq
    i32.and
    if
      i32.const 108 local.set $out
      i32.const 23 local.set $rule
    end
    ;; 8.4.62: h after a voiced stop becomes its aspirate (24).
    local.get $y i32.const 104 i32.eq
    local.get $col i32.const 2 i32.eq
    i32.and
    if
      local.get $row i32.const 5 i32.mul i32.const 419 i32.add i32.load8_u local.set $first
      i32.const 24 local.set $rule
    end
    ;; 8.4.63: S before aT (a vowel or h y v r) becomes C (25).
    local.get $y i32.const 83 i32.eq
    if
      local.get $n local.get $p i32.sub i32.const 2 i32.gt_s
      if
        local.get $p i32.const 514 i32.add i32.load8_u local.tee $next
        call $class i32.const 14 i32.le_u
        local.get $next i32.const 104 i32.eq
        i32.or
        local.get $next i32.const 121 i32.eq
        i32.or
        local.get $next i32.const 118 i32.eq
        i32.or
        local.get $next i32.const 114 i32.eq
        i32.or
        if
          i32.const 67 local.set $first
          i32.const 25 local.set $rule
        end
      end
    end
    i32.const 512 local.get $p i32.const 1 i32.sub call $put
    local.get $out call $put1
    local.get $first call $put1
    local.get $p i32.const 514 i32.add
    local.get $n local.get $p i32.sub i32.const 2 i32.sub
    call $put
    local.get $rule)

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
    ;; A first word ending in visarga, s or r: the visarga rules.
    local.get $p i32.const 511 i32.add i32.load8_u local.set $e
    local.get $e i32.const 72 i32.eq
    local.get $e i32.const 115 i32.eq
    i32.or
    local.get $e i32.const 114 i32.eq
    i32.or
    if
      local.get $p local.get $n call $visarga return
    end
    local.get $p i32.const 511 i32.add i32.load8_u call $class local.set $a
    local.get $p i32.const 513 i32.add i32.load8_u call $class local.set $b
    ;; A first word ending in a consonant (not M, H): hal sandhi.
    local.get $a i32.const 20 i32.ge_u
    local.get $a i32.const 25 i32.le_u
    i32.and
    if
      local.get $p local.get $n call $hal return
    end
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
