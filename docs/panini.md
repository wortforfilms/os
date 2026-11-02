# Panini capsule

The first step towards MAATAA's Panini engine: vowel sandhi (ac-sandhi) from
Panini's Ashtadhyayi, run on the board as an ordinary capsule. It needs no
kernel change and no new syscall; it uses the store calls every capsule may
be granted.

## Pieces

| Piece | What it is |
| --- | --- |
| `crates/maataa-sandhi` | The reference: the rules in plain `no_std` Rust, host-tested with classic examples |
| `capsules/panini.wat` | The same rules in hand-written WebAssembly (1.4 KB), signed as `assets/capsules/panini.mcap`; version 3 keeps its constants in one data segment (version 2 used 7 of the interpreter's 8), with the same memory contents |
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
| 2 | savarna-dirgha | 6.1.101 akah savarne dirghah | `vidyA+Alaya` -> `vidyAlaya`, `hotf+xkAra` -> `hotFkAra` |
| 3 | guna | 6.1.87 ad gunah | `deva+indra` -> `devendra`, `mahA+fzi` -> `maharzi` |
| 4 | vrddhi | 6.1.88 vrddhir eci | `eka+eka` -> `ekEka` |
| 5 | yan | 6.1.77 iko yan aci | `iti+Adi` -> `ityAdi` |
| 7 | purvarupa | 6.1.109 enah padantad ati | `vane+atra` -> `vane'tra` |
| 6 | ayadi | 6.1.78 eco 'yavayavah | `hare+e` -> `haraye` |
| 1 | joined as written | (a consonant starts the second word) | `rAma+gacCati` -> `rAmagacCati` |

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
(Correction, 2026-11-02: `vAkISa` is wrong. A final jhal becomes jaS at
the end of a word, 8.2.39, so vAk+ISa is vAgISa; the crate now says so,
the capsule still joins it as written.)

With `maataa-link sandhi` on the same board: देव+इन्द्र -> देवेन्द्र,
महा+ऋषि -> महर्षि, एक+एक -> एकैक, इति+आदि -> इत्यादि, वने+अत्र -> वनेऽत्र,
हरे+ए -> हरये, सु+आगत -> स्वागत, वाक्+ईश -> वाकीश and `rAma+ISa` -> रामेश, all
`MATCH`; देव+ळ was refused before sending (ळ unsupported) and देव+इन्+द्र by
both the board and the host.

Panini version 6 on the same board (dev-key kernel), 2026-11-02:
installed over the host channel (version 5 before, 3,562 bytes), and after
a probe reset `maataa-link sandhi` gave MATCH for वाच्+च and vAc+ca ->
vAkca, prAC+atra -> prAqatra, viS+ca -> viwca, lih+atra -> liqatra,
tAn+ca -> tAMSca, rAjan+atra -> rAjannatra, vidvAn+likhati (mistyped:
SLP1 kh is k+h; the rule, 8.4.60, applied as on the host), tAn+jayati ->
tAYjayati, tat+zaw -> tatzaw, ziv+atra -> zivatra, punar+ramate -> punA
ramate, hariH+ramate -> harI ramate, hareH+ramate -> hare ramate,
rAmaH+gacCati -> rAmo gacCati and deva+indra -> devendra; prAY+atra was
refused by both the board and the host (-105, a final Y).

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

ऋ+ऌ (decided 2026-11-02, panini version 7): by the varttika
rlvarnayor mithah savarnyam (on 1.1.9) the r and l vowels are savarna, so
f, F and x meeting take 6.1.101, and as the l vowel has no long one the
long vowel is F: `hotf+xkAra` -> `hotFkAra`, `kx+fta` -> `kFta` (rule 2).
The optional short forms (Rti Rvarne R va, xti xvarne x va: hotxkAra) are
not applied. Versions 1 to 6 gave 6.1.77 (`pitrxkAra`). The first engine
in the tests makes the same choice, so the golden test still compares
every pair.

## Visarga, s and r

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
| `punar+ramate` | `punA ramate` | 8.3.14 ro ri, 6.3.111 (rule 29) |
| `hariH+ramate` | `harI ramate` | 8.3.14, 6.3.111 |
| `hareH+ramate` | `hare ramate` | 8.3.14 (e is not aR: no lengthening) |
| `pitfH+ramate` | `pitf ramate` | 8.3.14 (f is not aR either) |
| `rAmaH+ramate` | `rAmo ramate` | 6.1.114 (a + ru: not 8.3.14) |

Optional forms take the common choice: 8.3.19 drops the y, 8.3.36 and
8.3.37 keep the visarga. r, or ru after a vowel other than a/A, before r
is dropped by 8.3.14 ro ri (obligatory), and 6.3.111 Dhralope purvasya
dirgho 'naH lengthens a short a i u before it (rule 29, panini version
6). Not yet (refused as -105): a visarga after a consonant, pluta. Panini version 4 has the same rules, in
the same order, with the class table split by what they need (20 haS, 21
t T, 22 c C, 23 w W, 24 k K p P, 25 Sar, 26 M H). The host test runs the
capsule against the crate for every ending (H, s, r) after every letter,
bare and after k, before every first letter alone or followed by a, S or k,
plus sa / eza and the cases above: about 58,800 requests, answer and rule
number equal. Image 2,164 bytes of 4,096; worst fuel 4,758 of 20,000.

## Consonant endings (hal sandhi)

A first word ending in a consonant other than s and r (those are visarga).
The rules apply in the sutras' order, each seeing the result of the ones
before it (8.2.1), and the words are written joined; an anusvara from
8.3.23 keeps the space. The result names the last rule applied (27
excepted, below).

| Request | Result | Sutras |
| --- | --- | --- |
| `vAk+ISa` | `vAgISa` | 8.2.39 jhalam jaso 'nte |
| `jagat+ISa` | `jagadISa` | 8.2.39 |
| `tat+gacCati` | `tadgacCati` | 8.2.39 |
| `tat+ca` | `tacca` | 8.2.39, 8.4.40, 8.4.55 |
| `sat+jana` | `sajjana` | 8.2.39, 8.4.40 |
| `tat+wIkA` | `tawwIkA` | 8.2.39, 8.4.41, 8.4.55 |
| `tat+zaw` | `tatzaw` | 8.2.39, 8.4.55 (8.4.43 toh zi: no 8.4.41) |
| `tat+na` | `tanna` | 8.2.39, 8.4.45 (optional; applied) |
| `vAk+mAtra` | `vANmAtra` | 8.2.39, 8.4.45 |
| `tat+laya` | `tallaya` | 8.2.39, 8.4.60 |
| `tat+Siva` | `tacCiva` | 8.2.39, 8.4.40, 8.4.55, 8.4.63 (optional; applied) |
| `vAk+Sata` | `vAkCata` | 8.4.55, 8.4.63 |
| `vAk+hari` | `vAgGari` | 8.2.39, 8.4.62 (optional; applied) |
| `tat+hita` | `tadDita` | 8.2.39, 8.4.62 |
| `kim+karoti` | `kiM karoti` | 8.3.23 |
| `kim+atra` | `kimatra` | (m before a vowel: as written) |
| `vAc+ISa` | `vAgISa` | 8.2.30, 8.2.39 |
| `vAc+ca` | `vAkca` | 8.2.30, 8.2.39, 8.4.55 |
| `vAc+mAtra` | `vANmAtra` | 8.2.30, 8.2.39, 8.4.45 |
| `vaRij+atra` | `vaRigatra` | 8.2.30, 8.2.39 |
| `prAC+atra` | `prAqatra` | 8.2.36, 8.2.39 |
| `prAC+ca` | `prAwca` | 8.2.36, 8.2.39, 8.4.55 |
| `rAw+atra` | `rAqatra` | 8.2.39 (rAj given as its pada form) |
| `viS+atra` | `viqatra` | 8.2.36, 8.2.39 |
| `viS+ca` | `viwca` | 8.2.36, 8.2.39, 8.4.55 |
| `viS+hari` | `viqQari` | 8.2.36, 8.2.39, 8.4.62 |
| `dviz+atra` | `dviqatra` | 8.2.39 |
| `zaz+mAsa` | `zaRmAsa` | 8.2.39, 8.4.45 |
| `dviz+tat` | `dviwtat` | 8.2.39, 8.4.55 (8.4.42: the t stays) |
| `lih+atra` | `liqatra` | 8.2.31, 8.2.39 |
| `lih+ca` | `liwca` | 8.2.31, 8.2.39, 8.4.55 |
| `dik+ambara` | `digambara` | 8.2.39 (diS given as its pada form) |
| `tAn+ca` | `tAMSca` | 8.3.7, 8.3.4, 8.3.34, 8.4.40 (rule 27) |
| `tAn+tarati` | `tAMstarati` | 8.3.7, 8.3.4, 8.3.34 (27) |
| `praSAn+tanoti` | `praSAntanoti` | (8.3.7 excepts praSAn: as written) |
| `mahAn+tsaru` | `mahAntsaru` | (t not followed by am: as written) |
| `rAjan+atra` | `rAjannatra` | 8.3.32 (rule 28) |
| `pratyaN+AtmA` | `pratyaNNAtmA` | 8.3.32 (28) |
| `tAn+atra` | `tAnatra` | (after a long vowel: as written) |
| `tAn+jayati` | `tAYjayati` | 8.4.40 |
| `tAn+Siva` | `tAYSiva` | 8.4.40 (no C: Y is not jhay, 8.4.63) |
| `tAn+qamaru` | `tARqamaru` | 8.4.41 |
| `tAn+zaw` | `tAnzaw` | (8.4.43 toh zi: as written) |
| `vidvAn+liKati` | `vidvAlliKati` | 8.4.60 (written ll, without the nasal mark) |

Taken: final stops of every row, and final m. A final palatal takes
8.2.30 coh kuh (c j J become k g G) or, for C, 8.2.36 (z, of the retroflex
row); final S z h take the retroflex row too, S by 8.2.36, z as it is,
h by 8.2.31 ho qhah (Q). 8.2.39 and the rules after it then apply as
above. The result names the last rule applied, so no new rule number comes
with them (vAc+ISa is 18, 8.2.39).

Pada form. Some finals depend on how the word was formed, which the letters
alone do not show: the roots 8.2.36 names (rAj, yaj, sfj, mfj, BrAj, Brasj,
vraSc: rAj gives rAw, not rAk), kvin words (8.2.62: diS gives dik), and
8.2.32 to 8.2.35 (duh gives Duk). The engine applies the general rule
(8.2.30 for c j J, 8.2.36 for S, 8.2.31 for h); for these words the caller
gives the pada form (rAw, dik, Duk), and the engine joins that.

Final N R n: before a vowel, 8.3.32 doubles them after a short vowel
(rule 28). A final n also takes 8.3.7 before c C w W t T followed by am
(rule 27, named for 8.3.7 as rules 8 and 9 are for the first sutra of
their chain; anusvara by 8.3.4, not 8.3.2's anunasika; written joined),
8.4.40, 8.4.41 and 8.4.60. The optional 8.3.28, 8.3.30 and 8.3.31 are not
applied. 8.4.60 makes the l nasal by 1.1.50; the result writes plain ll,
a simplification that keeps the output to SLP1 letters without `~`. A
final Y is refused: its pada form is N.

Final y l v: no pada-final rule here changes them, so the words are
joined as written (ziv+atra -> zivatra, rule 1). 6.1.66 lopo vyor vali
(y and v dropped before val) is deliberately not applied: padas rarely
end in y or v.

Not yet (refused as -105): a final Y. A property test checks every final stop (and S z h)
before every letter: the result is never aspirated, and never voiced
before khar. The first engine joined consonant endings as written, so the golden test leaves them
out. Panini version 5 has the same rules in the same order, with a stop
table (row and column of each stop, at 288, and the stops by row at 416).
The host test runs the capsule against the crate for every consonant
ending after a, i or k, bare and after k, before every first letter alone
or followed by a, S, k or y, and the named cases (about 50,000 more
requests, about 109,000 in all): answers and rule numbers equal. Image
2,909 bytes of 4,096; worst fuel 4,883 of 20,000; one data segment.
Panini version 6 adds the final palatals, S z h and N R n (rules 27 and
28 new), and keeps a dental before z dental (8.4.43 toh zi; version 5
gave tawzaw for tat+zaw), and joins final y l v as written: image 3,512
bytes of 4,096, one data segment; worst fuel over
the host test's requests 4,246, the same as version 5 measured the same
way. Version 6 also has r before r (8.3.14 with 6.3.111, rule 29):
image 3,562 bytes of 4,096.

## Later

When a hardware Panini engine (an FPGA) exists, the kernel will need a driver
for it and a capability to reach it; the store protocol above can stay as it
is for capsules. That interface is designed when the hardware's is known.
