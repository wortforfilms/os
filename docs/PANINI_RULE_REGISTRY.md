# Panini rule registry

Every rule id that `crates/maataa-sandhi` can report (`enum Rule`), at
`7b99bdb`. The id is the wire value; the capsule (`capsules/panini.wat`,
version 9) uses the same numbers. Sutras are listed separately from the
evidence. "Board" means seen on the NUCLEO-F411RE, in the capsule version
named; it is a record of a run, not a CI check.

## Columns

- **Host**: unit tests in `crates/maataa-sandhi/src/lib.rs`, run by CI
  (`scripts/smoke-alpha.sh`, `cargo test -p maataa-sandhi`).
- **WASM**: implemented in the capsule, and checked by
  `the_panini_capsule_agrees_with_its_reference` (`src/capsule_task.rs`),
  which compares the capsule's output with the host crate over generated
  requests, run by CI; and by `scripts/qemu-panini-test.sh` on QEMU.
- **Board**: capsule version in which the rule was last seen on the board.

## Rules

| Id | Name | Sutra(s) | Host | WASM | Board |
| --- | --- | --- | --- | --- | --- |
| 1 | Join | — (no rule: joined as written) | yes | yes | v6 |
| 2 | SavarnaDirgha | 6.1.101 | yes | yes | v9 |
| 3 | Guna | 6.1.87 | yes | yes | v9 |
| 4 | Vrddhi | 6.1.88 | yes | yes | v9 (2026-11-03) |
| 5 | Yan | 6.1.77 | yes | yes | v9 |
| 6 | Ayadi | 6.1.78 | yes | yes | v9 |
| 7 | Purvarupa | 6.1.109 | yes | yes | v9 |
| 8 | HasiCa | 6.1.114 (with 6.1.87) | yes | yes | v9 |
| 9 | AtoRoh | 6.1.113 (with 6.1.87, 6.1.109) | yes | yes | v4 |
| 10 | LopahSakalyasya | 8.3.17, 8.3.19 | yes | yes | v4 |
| 11 | HaliSarvesham | 8.3.17, 8.3.22 | yes | yes | v4 |
| 12 | VisarjaniyasyaSah | 8.3.34, 8.4.40, 8.4.41 | yes | yes | v9 |
| 13 | SarpareVisarjaniyah | 8.3.35 | yes | yes | v9 (2026-11-03) |
| 14 | VaSari | 8.3.36 | yes | yes | v9 (2026-11-03) |
| 15 | Kupvoh | 8.3.37 | yes | yes | v9 (2026-11-03) |
| 16 | Repha | 8.2.66 (r kept before a voiced sound) | yes | yes | v8, v4 |
| 17 | SuLopa | 6.1.132 | yes | yes | v4 |
| 18 | JhalamJasonte | 8.2.39 | yes | yes | v9 |
| 19 | StohScuna | 8.4.40 | yes | yes | v6, v5 |
| 20 | Stuna | 8.4.41 | yes | yes | v9 (2026-11-03) |
| 21 | YaroNunasike | 8.4.45 | yes | yes | v9 (2026-11-03) |
| 22 | KhariCa | 8.4.55 | yes | yes | v9 |
| 23 | TorLi | 8.4.60 | yes | yes | v7 |
| 24 | JhayoHo | 8.4.62 | yes | yes | v5 |
| 25 | SasCho | 8.4.63 | yes | yes | v5 |
| 26 | MoNusvara | 8.3.23 | yes | yes | v5 |
| 27 | NasChavi | 8.3.7 (then 8.3.4, 8.3.15, 8.3.34, 8.4.40/41) | yes | yes | v9 |
| 28 | NamoHrasvat | 8.3.32 | yes | yes | v9 |
| 29 | RoRi | 8.3.14, 6.3.111 | yes | yes | v9 |
| 30 | SamyogantaLopa | 8.2.23, 8.2.24 | yes | yes | v9 |
| 31 | Pragrhya | 6.1.125; words by 1.1.12, 1.1.14, 1.1.15 | yes | yes | v9 |
| 32 | Pararupa | 6.1.94 | yes (with `Hints`) | no | — |
| 33 | EtyEdhati | 6.1.89 | yes (with `Hints`) | no | — |
| 34 | UpasargadRti | 6.1.91 | yes (with `Hints`) | no | — |

`Rule::sutra()` returns one sutra per id: the first one listed above,
except ids 10 and 11, which return 8.3.19 and 8.3.22.

Board run of 2026-11-03 (kernel at `24ce21e`, panini 9 already installed,
nothing re-flashed), all MATCH: `eka+eka`, `haraH+tsaru`, `rAmaH+kzetre`,
`haraH+kzetre`, `rAmaH+kza` (13), `rAmaH+Sete` (14), `rAmaH+karoti`,
`hariH+pAti` (15), `tat+qayate` (20), `jagat+nATa`, `vAk+mayam` (21),
`deva+indra`. The first `rAmaH+kzetre` of each run got no answer because
the board reset during the request (`reset pin or debugger`, no crash
record); asked again after the reset it matched. The reset is tracked as its
own issue, not a capsule fault.

Coverage gap: the differential test in `src/capsule_task.rs` tries a
visarga before khar followed by `S` only, so 8.3.35 with `z` or `s` (as in
`kz`) is not in CI. Extended by hand with `z` and `s`, the capsule still
equals the host (2026-11-03, not committed).

Rules 32–34 need to know that the second word is a verb after an upasarga.
That comes only from `join_with(Hints)`; plain `join`, the capsule and the
wire format never produce them. The dual case of pragrhya (1.1.11) is also
`Hints`-only.

## Errors

| Code | Meaning | Board |
| --- | --- | --- |
| -101 | no `+` in the request | — |
| -102 | empty word | — |
| -103 | a letter that is not SLP1 | alpha.3 run |
| -104 | request too long | — |
| -105 | `NotYet`: a case with no rule yet (a final Y; a single s or r with no vowel before it) | v9 |
| -106 | `BadStart`: a word starts with anusvara (M) or visarga (H) | v9 |

## What "yes" does not mean

A "yes" says the rule is implemented and tested for the forms the tests
use. It does not say every word the sutra covers is handled: the crate takes
the pada form from the caller and does no morphology beyond `Hints`
(`docs/panini.md`).
