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
| `scripts/qemu-panini-test.sh` | Installs the capsule in QEMU and asks it over the host channel (smoke step 15) |

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

Each tick (once a second) reads key 40. With a request it writes the answer
to key 41 (`?` for a malformed one), logs it (`capsule panini: devendra`),
deletes key 40 and returns the rule number. With none it writes nothing, so
flash is written only when there is work. The kernel logs every tick, so the
capsule adds one log line a second.

## Later

When a hardware Panini engine (an FPGA) exists, the kernel will need a driver
for it and a capability to reach it; the store protocol above can stay as it
is for capsules. That interface is designed when the hardware's is known.
