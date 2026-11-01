# Panini capsule

The first step towards MAATAA's Panini engine: vowel sandhi (ac-sandhi) from
Panini's Ashtadhyayi, run on the board as an ordinary capsule. It needs no
kernel change and no new syscall; it uses the store calls every capsule may
be granted.

## Pieces

| Piece | What it is |
| --- | --- |
| `crates/maataa-sandhi` | The reference: the rules in plain `no_std` Rust, host-tested with classic examples |
| `capsules/panini.wat` | The same rules in hand-written WebAssembly (1.3 KB), signed as `assets/capsules/panini.mcap` |
| `src/capsule_task.rs` test | Runs the capsule in Maataa's interpreter against the reference for every pair of boundary letters (all 14 vowels and a consonant, on each side), malformed requests and a 64-byte request |
| `scripts/qemu-panini-test.sh` | Installs the capsule in QEMU and asks it over the host channel, also with `maataa-link sandhi` in Devanagari (smoke step 15) |
| `maataa_sandhi::lipi` | Devanagari <-> SLP1 for the host tool (feature `alloc`; never in the kernel) |

The capsule is hand-written because Maataa's interpreter runs an i32 subset
(no i64, floats, tables or `call_indirect`) in 4 KiB of memory, and ordinary
Rust compiled to WebAssembly uses all of those.

## Rules

Text is SLP1 (ASCII), so a request fits one 64-byte store value: Devanagari
takes three bytes a letter in UTF-8. When the last letter of the first word
and the first of the second are both vowels, the first rule that applies is
used:

| Result | Rule | Sutra | Example |
| --- | --- | --- | --- |
| 2 | savarna-dirgha | 6.1.101 akah savarne dirghah | `vidyA+Alaya` -> `vidyAlaya` |
| 3 | guna | 6.1.87 ad gunah | `deva+indra` -> `devendra`, `mahA+fzi` -> `maharzi` |
| 4 | vrddhi | 6.1.88 vrddhir eci | `eka+eka` -> `ekEka` |
| 5 | yan | 6.1.77 iko yan aci | `iti+Adi` -> `ityAdi` |
| 7 | purvarupa | 6.1.109 enah padantad ati | `vane+atra` -> `vane'tra` |
| 6 | ayadi | 6.1.78 eco 'yavayavah | `hare+e` -> `haraye` |
| 1 | joined as written | (a consonant at the boundary) | `vAk+ISa` -> `vAkISa` |

Not yet: consonant (hal) and visarga sandhi, the optional loss of y/v after
ayadi (8.3.19), and the exceptions (pragrhya and the rest). Errors: -101 no
`+`, -102 an empty word, -103 a byte that is not an SLP1 letter.

## Using it

```bash
maataa-capsule wasm capsules/panini.wat -o target/panini.wasm   # if you change it
maataa-capsule sign --name panini --caps write,sleep,store_get,store_put \
  --payload target/panini.wasm --dev -o assets/capsules/panini.mcap
maataa-link --serial PORT capsule-install assets/capsules/panini.mcap
# reset the board: panini runs as task 9 (it replaces any other run-time capsule)
maataa-link --serial PORT put 41                 # clear an old answer
maataa-link --serial PORT put 40 deva+indra      # the request
maataa-link --serial PORT get 41                 # key 41: "devendra" (within a second)
```

Or let the host tool do it, in Devanagari or SLP1:

```bash
maataa-link --serial PORT sandhi देव+इन्द्र
MATCH: देवेन्द्र (devendra) [guna, 6.1.87]
```

`sandhi` converts Devanagari to SLP1 (`maataa_sandhi::lipi`), clears key 41,
writes the request to key 40, waits up to 5 s for key 41, and checks the
board's answer against its own from `maataa-sandhi`. A different answer is
reported as `MISMATCH: board=..., host=...` with exit status 1, so every
query is also a test of the capsule. The conversion supports the letters the
rules know: the vowels and their signs, the 33 consonants क..ह, virama,
anusvara, visarga and avagraha (ऽ = `'`). Anything else (ळ, nukta forms such
as क़, ZWJ/ZWNJ, chandrabindu, Vedic accents, digits, ।) is refused with the
character named, never dropped. A consonant carries `a` unless a vowel sign
or virama follows it: `इन्द्र` is `indra`.

Each tick (once a second) reads key 40. With a request it writes the answer
to key 41 (`?` for a malformed one), logs it (`capsule panini: devendra`),
deletes key 40 and returns the rule number. With none it writes nothing, so
flash is written only when there is work. Version 2 has `log=quiet` in its
manifest: the kernel logs a tick only when it returns an error (a malformed
request, `tick N -> -103`), so an idle board's log stays quiet. Version 1
added a log line every second.

## On the board

NUCLEO-F411RE, kernel v0.1.0-alpha.3, 2026-11-01: installed over the host
channel and run as task 9 after a reset. Eight requests, each answered
within 2.5 s: `deva+indra` -> `devendra`, `mahA+fzi` -> `maharzi`,
`eka+eka` -> `ekEka`, `iti+Adi` -> `ityAdi`, `vane+atra` -> `vane'tra`,
`hare+e` -> `haraye`, `vAk+ISa` -> `vAkISa`, and `deva+in+dra` -> `?`.

With `maataa-link sandhi` on the same board: देव+इन्द्र -> देवेन्द्र,
महा+ऋषि -> महर्षि, एक+एक -> एकैक, इति+आदि -> इत्यादि, वने+अत्र -> वनेऽत्र,
हरे+ए -> हरये, सु+आगत -> स्वागत, वाक्+ईश -> वाकीश and `rAma+ISa` -> रामेश, all
`MATCH`; देव+ळ was refused before sending (ळ unsupported) and देव+इन्+द्र by
both the board and the host.

## The varna model (`maataa_sandhi::varna`)

The foundation for writing rules the way the sutras state them. Host
library only; the wire format (SLP1) and the capsule are unchanged, and the
current rules do not use it yet.

- `Varna`: all 49 phonemes of the SLP1 alphabet (14 vowels, 33 consonants,
  anusvara, visarga), one-to-one with their SLP1 bytes. The long vowels,
  anusvara and visarga are not in the Maheshvara sutras, so the enum is not
  the sutras' order.
- Properties: place (sthana) as a set, because e/ai are throat+palate, o/au
  throat+lips, v teeth+lips and the nasals add the nose (1.1.8); internal
  effort (sprishta, ishat-sprishta, ishad-vivrta, vivrta); voicing,
  aspiration and length.
- `SHIVA_SUTRAS`: the fourteen sutras as written, with their it-markers.
  `pratyahara("ac")` computes a set from them. ण् ends two sutras, so a name
  ending in it must say which when both make sense: `aR1` = अ इ उ, `aR2`
  runs to लण्, `iR2` is the इण् of 8.3.57; `yaR` has only one. A pratyahara
  starts at the first occurrence of its letter, so `hal` is all 33
  consonants (ह occurs twice).
- `with_savarnas`: 1.1.69, a vowel in a pratyahara also stands for its
  savarnas (`ik` covers इ ई उ ऊ ऋ ॠ ऌ ॡ).
- `savarna(a, b)`: 1.1.9 (same place in the mouth, the nose aside, and same
  internal effort), with 1.1.10 (a vowel and a consonant never) and the
  varttika making the r and l vowels savarna.

Tests check the pratyaharas against the textbook lists (ac, hal, ik, ak,
yaR, eN, ec, Jal (24), jaS, Kar (13), haS (20), Sal, yay, am, aR1, aR2,
iR2), refusals (`aR` without 1 or 2, unknown it-markers), places and
efforts, and savarna pairs.

Open point, flagged in the code: e/ai and o/au share place and effort, so
1.1.9 as modelled would make them savarna; the grammar is not used that
way, so the model keeps e ai o au savarna only of themselves. This should
be checked against the commentaries. It does not affect the current rules.

`join` is written on this model: 6.1.101 is `ak` + a savarna, 6.1.87 is
a/A + `ik` with the guna (1.1.2) closest in place (1.1.50) and r or l after
it (1.1.51), 6.1.88 is a/A + `ec` with the closest vrddhi (1.1.1), 6.1.77
is `ik` + `ac` with the closest `yaR`, 6.1.109 is `eN` + short a, and 6.1.78
maps `ec` to ay av Ay Av in order (1.3.10). "Closest in place" scores two
for each shared place and minus one for each extra one, so the l vowel
takes l, not v. A test checks the model engine against the first one (kept
in the tests) for every pair of the 49 letters in three contexts, errors
and the output limit: they agree everywhere, and the capsule, checked
against `join`, is unchanged.

Open exception, kept on purpose: by the r/l varttika, f+x (ऋ+ऌ) would meet
6.1.101; both engines, and the capsule, apply 6.1.77 (`pitf+xkAra` ->
`pitrxkAra`) until the commentaries are checked. A test pins it.

## Visarga, s and r (host library only)

A word ending in visarga (`H`), `s` or `r` before the next word. `H` and a
final `s` are taken as s (8.2.66 sasajuso ruh); write a final `r` (punar)
when the word has r, because the visarga alone does not say which. The two
words stay apart with a space, except where avagraha joins them.

| Request | Result | Sutras |
| --- | --- | --- |
| `rAmaH+gacCati` | `rAmo gacCati` | 6.1.114 haSi ca, 6.1.87 |
| `rAmaH+atra` | `rAmo'tra` | 6.1.113, 6.1.87, 6.1.109 |
| `rAmaH+iti` | `rAma iti` | 8.3.17, 8.3.19 (no guna: 8.3.19 is asiddha, 8.2.1) |
| `devAH+gacCanti` | `devA gacCanti` | 8.3.17, 8.3.22 |
| `devAH+atra` | `devA atra` | 8.3.17, 8.3.19 |
| `rAmaH+ca` | `rAmaS ca` | 8.3.34, 8.4.40 |
| `rAmaH+tatra` | `rAmas tatra` | 8.3.34 |
| `rAmaH+wIkA` | `rAmaz wIkA` | 8.3.34, 8.4.41 |
| `rAmaH+karoti` | `rAmaH karoti` | 8.3.37 (jihvamuliya optional, not written) |
| `rAmaH+Sete` | `rAmaH Sete` | 8.3.36 va Sari (s optional) |
| `kaH+tsaruH` | `kaH tsaruH` | 8.3.35 |
| `hariH+gacCati` | `harir gacCati` | ru stays r |
| `punar+ca` | `punaS ca` | 8.3.15, 8.3.34, 8.4.40 |
| `saH+gacCati` | `sa gacCati` | 6.1.132 |

Optional forms take the common choice: 8.3.19 drops the y, 8.3.36 and
8.3.37 keep the visarga. Not yet (refused as -105): r or ru before r
(8.3.14 ro ri with 6.3.111 lengthening, punaH+ramate -> punA ramate), a
visarga after a consonant, pluta. The capsule still has vowel sandhi only,
so `maataa-link sandhi` reports a MISMATCH on these and names the rule the
host applied.

## Later

When a hardware Panini engine (an FPGA) exists, the kernel will need a driver
for it and a capability to reach it; the store protocol above can stay as it
is for capsules. That interface is designed when the hardware's is known.
