//! Vowel sandhi (ac-sandhi) at a word boundary, after Panini's Ashtadhyayi,
//! over SLP1 text (ASCII: `a A i I u U f F x X e E o O`, consonants
//! `k K g G N c C j J Y w W q Q R t T d D n p P b B m y r l v S z s h`, `M`
//! anusvara, `H` visarga).
//!
//! This crate is the reference for the `panini` capsule
//! (capsules/panini.wat): the capsule implements the same rules in
//! hand-written WebAssembly, and `src/capsule_task.rs` checks the two agree on
//! every pair of boundary vowels.
//!
//! Rules, in the order they are tried when the last letter of the first word
//! and the first letter of the second are both vowels:
//!
//! | Rule | Sutra | Example (SLP1) |
//! | --- | --- | --- |
//! | savarna-dirgha: like vowels make one long vowel | 6.1.101 akah savarne dirghah | `vidyA+Alaya` -> `vidyAlaya` |
//! | guna: a/A before i u f x | 6.1.87 ad gunah | `deva+indra` -> `devendra`, `mahA+fzi` -> `maharzi` |
//! | vrddhi: a/A before e E o O | 6.1.88 vrddhir eci | `eka+eka` -> `ekEka` |
//! | yan: i u f x before an unlike vowel | 6.1.77 iko yan aci | `iti+Adi` -> `ityAdi` |
//! | purvarupa: final e/o before a | 6.1.109 enah padantad ati | `vane+atra` -> `vane'tra` |
//! | ayadi: e E o O before a vowel | 6.1.78 eco 'yavayavah | `hare+e` -> `haraye` |
//!
//! Anything else (a consonant on either side) is joined as written:
//! consonant sandhi (hal-sandhi) and visarga sandhi are not implemented yet.
//! The optional loss of a final y/v after ayadi (8.3.19) is not applied.
#![no_std]

#[cfg(feature = "alloc")]
extern crate alloc;

#[cfg(feature = "alloc")]
pub mod lipi;

pub mod varna;

/// The rule that joined the two words. The numbers are the capsule's tick
/// results.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Rule {
    /// No two vowels met: joined as written.
    Join = 1,
    SavarnaDirgha = 2,
    Guna = 3,
    Vrddhi = 4,
    Yan = 5,
    Ayadi = 6,
    Purvarupa = 7,
    // Visarga (and final s, r) before the next word (panini version 4).
    /// 6.1.114 haSi ca: a + ru before a voiced consonant -> o (with 6.1.87).
    HasiCa = 8,
    /// 6.1.113 ato ror aplutad aplute: a + ru + a -> o' (with 6.1.87, 6.1.109).
    AtoRoh = 9,
    /// 8.3.17 then 8.3.19 lopah sakalyasya: the y of a/A + ru before a vowel
    /// is dropped (optional; the common form), and as 8.3.19 is asiddha
    /// (8.2.1) no vowel sandhi follows: rAma iti.
    LopahSakalyasya = 10,
    /// 8.3.17 then 8.3.22 hali sarvesham: A + ru before a voiced consonant
    /// loses the y: devA gacCanti.
    HaliSarvesham = 11,
    /// 8.3.34 visarjaniyasya sah: visarga -> s before khar; then 8.4.40 / 8.4.41
    /// make it S before the c row, z before the w row.
    VisarjaniyasyaSah = 12,
    /// 8.3.35 Sarpare visarjaniyah: before khar followed by Sar, visarga stays.
    SarpareVisarjaniyah = 13,
    /// 8.3.36 va Sari: before Sar, s is optional; the visarga is kept.
    VaSari = 14,
    /// 8.3.37 kupvoh: before k K p P, visarga stays (or jihvamuliya /
    /// upadhmaniya, optional; not written).
    Kupvoh = 15,
    /// The r stays before a voiced sound: from ru (8.2.66 sasajuso ruh) after
    /// a vowel other than a/A, or a word that ends in r.
    Repha = 16,
    /// 6.1.132 etattadoh sulopo...hali: saH, ezaH drop the visarga before a
    /// consonant: sa gacCati.
    SuLopa = 17,
    // A word ending in a consonant (hal sandhi; panini version 5, 27 and 28
    // version 6). Several rules can apply in turn (in the sutras' order,
    // 8.2.1); the result names the last one, except 27, named for the first
    // sutra of its chain.
    /// 8.2.39 jhalam jaso 'nte: a final jhal becomes the jaS of its place.
    JhalamJasonte = 18,
    /// 8.4.40 stoh scuna scuh: s or the t row next to S or the c row.
    StohScuna = 19,
    /// 8.4.41 stuna stuh: the same with z or the w row.
    Stuna = 20,
    /// 8.4.45 yaro 'nunasike 'nunasiko va: before a nasal, the nasal of the
    /// same place (optional; the common form).
    YaroNunasike = 21,
    /// 8.4.55 khari ca: jhal before khar becomes car.
    KhariCa = 22,
    /// 8.4.60 tor li: the t row before l becomes l.
    TorLi = 23,
    /// 8.4.62 jhayo ho 'nyatarasyam: h after jhay becomes the aspirate of
    /// the jhay's place (optional; applied).
    JhayoHo = 24,
    /// 8.4.63 saS cho 'Ti: S after jhay, before a vowel or h y v r, becomes C
    /// (optional; applied).
    SasCho = 25,
    /// 8.3.23 mo 'nusvarah: a final m before a consonant becomes anusvara.
    MoNusvara = 26,
    /// 8.3.7 naS Cavy apraSAn: a final n before c C w W t T that are
    /// followed by am becomes ru; then anusvara (8.3.4), s (8.3.15 with
    /// 8.3.34) and 8.4.40 / 8.4.41: tAMSca. Named for 8.3.7, as rules 8 and
    /// 9 are named for the first sutra of their chain.
    NasChavi = 27,
    /// 8.3.32 Namo hrasvad aci NamuR nityam: a final N R n after a short
    /// vowel is doubled before a vowel: rAjannatra.
    NamoHrasvat = 28,
}

impl Rule {
    pub const fn name(self) -> &'static str {
        match self {
            Self::Join => "joined as written",
            Self::SavarnaDirgha => "savarna-dirgha",
            Self::Guna => "guna",
            Self::Vrddhi => "vrddhi",
            Self::Yan => "yan",
            Self::Ayadi => "ayadi",
            Self::Purvarupa => "purvarupa",
            Self::HasiCa => "ru to u, then guna",
            Self::AtoRoh => "ru to u, guna, purvarupa",
            Self::LopahSakalyasya => "ru to y, y dropped",
            Self::HaliSarvesham => "ru to y, y dropped",
            Self::VisarjaniyasyaSah => "visarga to s",
            Self::SarpareVisarjaniyah => "visarga kept",
            Self::VaSari => "visarga kept (s optional)",
            Self::Kupvoh => "visarga kept",
            Self::Repha => "r kept",
            Self::SuLopa => "visarga dropped",
            Self::JhalamJasonte => "jhal to jaS",
            Self::StohScuna => "to the c row",
            Self::Stuna => "to the w row",
            Self::YaroNunasike => "to the nasal",
            Self::KhariCa => "to car before khar",
            Self::TorLi => "to l",
            Self::JhayoHo => "h to the aspirate",
            Self::SasCho => "S to C",
            Self::MoNusvara => "m to anusvara",
            Self::NasChavi => "n to ru, anusvara, s",
            Self::NamoHrasvat => "nasal doubled",
        }
    }

    pub const fn sutra(self) -> &'static str {
        match self {
            Self::Join => "-",
            Self::SavarnaDirgha => "6.1.101",
            Self::Guna => "6.1.87",
            Self::Vrddhi => "6.1.88",
            Self::Yan => "6.1.77",
            Self::Ayadi => "6.1.78",
            Self::Purvarupa => "6.1.109",
            Self::HasiCa => "6.1.114",
            Self::AtoRoh => "6.1.113",
            Self::LopahSakalyasya => "8.3.19",
            Self::HaliSarvesham => "8.3.22",
            Self::VisarjaniyasyaSah => "8.3.34",
            Self::SarpareVisarjaniyah => "8.3.35",
            Self::VaSari => "8.3.36",
            Self::Kupvoh => "8.3.37",
            Self::Repha => "8.2.66",
            Self::SuLopa => "6.1.132",
            Self::JhalamJasonte => "8.2.39",
            Self::StohScuna => "8.4.40",
            Self::Stuna => "8.4.41",
            Self::YaroNunasike => "8.4.45",
            Self::KhariCa => "8.4.55",
            Self::TorLi => "8.4.60",
            Self::JhayoHo => "8.4.62",
            Self::SasCho => "8.4.63",
            Self::MoNusvara => "8.3.23",
            Self::NasChavi => "8.3.7",
            Self::NamoHrasvat => "8.3.32",
        }
    }
}

/// Why a request was refused. The numbers are the capsule's tick results.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    /// The request has no `+` between the two words.
    NoPlus,
    /// A word is empty.
    Empty,
    /// A byte that is not an SLP1 letter (a second `+` included).
    NotSlp1,
    /// The result does not fit the output buffer.
    TooLong,
    /// A case whose rule is not implemented yet (r before r, 8.3.14; a
    /// visarga after a consonant or at the start of a word; the consonant
    /// endings `hal` does not take).
    NotYet,
}

impl Error {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::NoPlus => "no + between the two words",
            Self::Empty => "a word is empty",
            Self::NotSlp1 => "not SLP1 letters (or a second +)",
            Self::TooLong => "too long",
            Self::NotYet => "a case whose rule is not implemented yet",
        }
    }

    pub const fn code(self) -> i32 {
        match self {
            Self::NoPlus => -101,
            Self::Empty => -102,
            Self::NotSlp1 => -103,
            Self::TooLong => -104,
            Self::NotYet => -105,
        }
    }
}

/// Longest request (and result) the capsule handles: one store value.
pub const MAX_TEXT: usize = 64;

/// SLP1 vowels in order; a vowel's index is its code minus 1.
const VOWELS: &[u8; 14] = b"aAiIuUfFxXeEoO";
const CONSONANTS: &[u8] = b"kKgGNcCjJYwWqQRtTdDnpPbBmyrlvSzshMH";

/// 1..=14 for a vowel (`a`=1, `A`=2, ... `O`=14), 20 for a consonant (or
/// anusvara or visarga), 0 for anything else.
pub fn class(byte: u8) -> u8 {
    if let Some(i) = VOWELS.iter().position(|&v| v == byte) {
        i as u8 + 1
    } else if CONSONANTS.contains(&byte) {
        20
    } else {
        0
    }
}

/// Joins "left+right" (one `+`, SLP1 letters only) into `out`.
pub fn join_request(request: &[u8], out: &mut [u8]) -> Result<(usize, Rule), Error> {
    let plus = request
        .iter()
        .position(|&b| b == b'+')
        .ok_or(Error::NoPlus)?;
    join(&request[..plus], &request[plus + 1..], out)
}

/// Joins two words with vowel sandhi at the boundary.
///
/// The rules are written on the varna model ([`varna`]): pratyaharas from
/// the Maheshvara sutras widened by 1.1.69, savarna by 1.1.9, and the
/// substitute chosen by 1.1.50 sthane 'ntaratamah (the one closest in
/// place). The tests check this against the first engine for every pair of
/// boundary letters.
pub fn join(left: &[u8], right: &[u8], out: &mut [u8]) -> Result<(usize, Rule), Error> {
    use varna::{pratyahara, savarna, with_savarnas, Varna};
    let (Some(&last), Some(&first)) = (left.last(), right.first()) else {
        return Err(Error::Empty);
    };
    if left
        .iter()
        .chain(right)
        .any(|&b| Varna::from_slp1(b).is_none())
    {
        return Err(Error::NotSlp1);
    }
    let mut w = Writer { out, len: 0 };
    let (Some(x), Some(y)) = (Varna::from_slp1(last), Varna::from_slp1(first)) else {
        return Err(Error::NotSlp1);
    };
    if matches!(x, Varna::Visarga | Varna::S | Varna::Ra) {
        return visarga(left, right, w);
    }
    if x.is_consonant() {
        return hal(left, right, w);
    }
    if !x.is_vowel() || !y.is_vowel() {
        w.put(left)?;
        w.put(right)?;
        return Ok((w.len, Rule::Join));
    }
    let set = |name: &str| pratyahara(name).unwrap_or(0);
    let has = |mask: u64, v: Varna| mask & v.bit() != 0;
    let (ak, ik, ac) = (
        with_savarnas(set("ak")),
        with_savarnas(set("ik")),
        with_savarnas(set("ac")),
    );
    let (en, ec) = (set("eN"), set("ec"));
    let a_varna = Varna::A.bit() | Varna::AA.bit();
    let stem = &left[..left.len() - 1];
    let rest = &right[1..];
    // Open exception (docs/panini.md): by the varttika r and l vowels are
    // savarna, which would bring f+x under 6.1.101; the first engine applies
    // 6.1.77 there, and so does this one until that is decided.
    let rl_cross = |a: Varna, b: Varna| {
        let r = |v: Varna| matches!(v, Varna::R | Varna::RR);
        let l = |v: Varna| matches!(v, Varna::L | Varna::LL);
        (r(a) && l(b)) || (l(a) && r(b))
    };

    // 6.1.101 akah savarne dirghah: ak and a savarna make the long one.
    if has(ak, x) && savarna(x, y) && !rl_cross(x, y) {
        w.put(stem)?;
        w.put(&[long_of(x).slp1()])?;
        w.put(rest)?;
        return Ok((w.len, Rule::SavarnaDirgha));
    }
    // 6.1.87 ad gunah: a/A and an ac become the guna (1.1.2 a e o) closest
    // in place; 1.1.51 uran raparah adds r (or l for the l vowel).
    if has(a_varna, x) && has(ik, y) {
        let guna = antaratama(&[Varna::A, Varna::E, Varna::O], y);
        w.put(stem)?;
        w.put(&[guna.slp1()])?;
        match y {
            Varna::R | Varna::RR => w.put(b"r")?,
            Varna::L | Varna::LL => w.put(b"l")?,
            _ => {}
        }
        w.put(rest)?;
        return Ok((w.len, Rule::Guna));
    }
    // 6.1.88 vrddhir eci: a/A and an ec become the vrddhi (1.1.1 A E O)
    // closest in place.
    if has(a_varna, x) && has(ec, y) {
        let vrddhi = antaratama(&[Varna::AA, Varna::AI, Varna::AU], y);
        w.put(stem)?;
        w.put(&[vrddhi.slp1()])?;
        w.put(rest)?;
        return Ok((w.len, Rule::Vrddhi));
    }
    // 6.1.77 iko yan aci: ik before an ac becomes the yaR closest in place.
    if has(ik, x) && has(ac, y) {
        let yan = antaratama(&[Varna::Y, Varna::V, Varna::Ra, Varna::La], x);
        w.put(stem)?;
        w.put(&[yan.slp1()])?;
        w.put(right)?;
        return Ok((w.len, Rule::Yan));
    }
    // 6.1.109 enah padantad ati: a final eN takes the place of a following
    // short a (taparakarana: a only), shown by the avagraha.
    if has(en, x) && y == Varna::A {
        w.put(left)?;
        w.put(b"'")?;
        w.put(rest)?;
        return Ok((w.len, Rule::Purvarupa));
    }
    // 6.1.78 eco 'yavayavah: e o E O before an ac become ay av Ay Av, in
    // that order (1.3.10 yathasankhyam).
    if has(ec, x) && has(ac, y) {
        // ec in the sutras' order (एओङ्, ऐऔच्) against ay av Ay Av.
        let order = [Varna::E, Varna::O, Varna::AI, Varna::AU];
        let index = order.iter().position(|&v| v == x).unwrap_or(0);
        w.put(stem)?;
        w.put([&b"ay"[..], b"av", b"Ay", b"Av"][index])?;
        w.put(right)?;
        return Ok((w.len, Rule::Ayadi));
    }
    w.put(left)?;
    w.put(right)?;
    Ok((w.len, Rule::Join))
}

/// A word ending in visarga, s or r before the next word. `H` and a final `s`
/// are taken as s (8.2.66 sasajuso ruh: ru); a final `r` as r. The two words
/// stay apart, with a space, except where avagraha joins them (so'tra).
///
/// Not yet (Error::NotYet): r or ru before r (8.3.14 ro ri with 6.3.111), a
/// visarga after a consonant, and anything at the start of the second word
/// that is not a letter of a word.
fn visarga(left: &[u8], right: &[u8], mut w: Writer<'_>) -> Result<(usize, Rule), Error> {
    use varna::{pratyahara, Varna};
    let set = |name: &str| pratyahara(name).unwrap_or(0);
    let has = |mask: u64, v: Varna| mask & v.bit() != 0;
    let at = |bytes: &[u8], i: usize| bytes.get(i).and_then(|&b| Varna::from_slp1(b));
    let (Some(last), Some(y)) = (at(left, left.len() - 1), at(right, 0)) else {
        return Err(Error::NotSlp1);
    };
    let ru = last != Varna::Ra;
    let stem = &left[..left.len() - 1];
    let Some(p) = stem.last().and_then(|&b| Varna::from_slp1(b)) else {
        return Err(Error::NotYet);
    };
    if !p.is_vowel() || !(y.is_vowel() || y.is_consonant()) {
        return Err(Error::NotYet);
    }
    let (khar, sar, hal, has_) = (set("Kar"), set("Sar"), set("hal"), set("haS"));
    let space_then = |w: &mut Writer<'_>, sound: &[u8]| -> Result<(), Error> {
        w.put(stem)?;
        w.put(sound)?;
        w.put(b" ")?;
        w.put(right)
    };

    // 6.1.132: sa(H), eza(H) before a consonant drop the visarga.
    if ru && matches!(stem, b"sa" | b"eza") && has(hal, y) {
        space_then(&mut w, b"")?;
        return Ok((w.len, Rule::SuLopa));
    }
    if has(khar, y) {
        // 8.3.15: r and ru become visarga before khar; then:
        let second = at(right, 1);
        if second.is_some_and(|v| has(sar, v)) {
            space_then(&mut w, b"H")?;
            return Ok((w.len, Rule::SarpareVisarjaniyah));
        }
        if has(sar, y) {
            space_then(&mut w, b"H")?;
            return Ok((w.len, Rule::VaSari));
        }
        if matches!(y, Varna::K | Varna::Kh | Varna::P | Varna::Ph) {
            space_then(&mut w, b"H")?;
            return Ok((w.len, Rule::Kupvoh));
        }
        // 8.3.34, then 8.4.40 (c row: S) or 8.4.41 (w row: z).
        let s = match y {
            Varna::C | Varna::Ch => b"S",
            Varna::Tt | Varna::Tth => b"z",
            _ => b"s",
        };
        space_then(&mut w, s)?;
        return Ok((w.len, Rule::VisarjaniyasyaSah));
    }
    // Before a vowel or a voiced consonant (aS).
    if ru && p == Varna::A {
        if y == Varna::A {
            w.put(&stem[..stem.len() - 1])?;
            w.put(b"o'")?;
            w.put(&right[1..])?;
            return Ok((w.len, Rule::AtoRoh));
        }
        if has(has_, y) {
            w.put(&stem[..stem.len() - 1])?;
            w.put(b"o ")?;
            w.put(right)?;
            return Ok((w.len, Rule::HasiCa));
        }
        space_then(&mut w, b"")?;
        return Ok((w.len, Rule::LopahSakalyasya));
    }
    if ru && p == Varna::AA {
        space_then(&mut w, b"")?;
        return Ok((
            w.len,
            if y.is_vowel() {
                Rule::LopahSakalyasya
            } else {
                Rule::HaliSarvesham
            },
        ));
    }
    if y == Varna::Ra {
        return Err(Error::NotYet);
    }
    space_then(&mut w, b"r")?;
    Ok((w.len, Rule::Repha))
}

/// The five rows of stops: unvoiced, aspirated, voiced, voiced aspirated,
/// nasal; velar, palatal, retroflex, dental, labial.
const ROWS: [[varna::Varna; 5]; 5] = {
    use varna::Varna::*;
    [
        [K, Kh, G, Gh, Ng],
        [C, Ch, J, Jh, Ny],
        [Tt, Tth, Dd, Ddh, Nn],
        [T, Th, D, Dh, N],
        [P, Ph, B, Bh, M],
    ]
};

/// (row, column) of a stop or nasal.
fn stop(v: varna::Varna) -> Option<(usize, usize)> {
    ROWS.iter()
        .enumerate()
        .find_map(|(r, row)| row.iter().position(|&s| s == v).map(|c| (r, c)))
}

/// A word ending in a consonant other than s and r (visarga) before the
/// next word, in the order of the sutras (each sees the result of the ones
/// before it, 8.2.1). The words are written joined (tacca, vAgISa), except
/// that an anusvara from 8.3.23 keeps the space (kiM karoti).
///
/// Taken: a final stop (a palatal through 8.2.30 coh kuh, or 8.2.36 for C),
/// final S z h (8.2.36, 8.2.31: the retroflex row), and final m. Where the right form depends on the word's derivation (the
/// roots of 8.2.36, kvin words of 8.2.62, 8.2.32 to 8.2.35) the caller gives
/// the pada form: rAw, dik, Duk. Final N R n: 8.3.32 before a vowel; for n,
/// 8.3.7, 8.4.40, 8.4.41, 8.4.60. Not yet (Error::NotYet): a final Y (give
/// the pada form, N), y l v.
fn hal(left: &[u8], right: &[u8], mut w: Writer<'_>) -> Result<(usize, Rule), Error> {
    use varna::{pratyahara, Varna};
    let set = |name: &str| pratyahara(name).unwrap_or(0);
    let has = |mask: u64, v: Varna| mask & v.bit() != 0;
    let at = |bytes: &[u8], i: usize| bytes.get(i).and_then(|&b| Varna::from_slp1(b));
    let (Some(x), Some(y)) = (at(left, left.len() - 1), at(right, 0)) else {
        return Err(Error::NotSlp1);
    };
    if !(y.is_vowel() || y.is_consonant()) {
        return Err(Error::NotYet);
    }
    let stem = &left[..left.len() - 1];
    // 8.3.23: m before a consonant; before a vowel, joined as written.
    if x == Varna::M {
        if y.is_consonant() {
            w.put(stem)?;
            w.put(b"M ")?;
            w.put(right)?;
            return Ok((w.len, Rule::MoNusvara));
        }
        w.put(left)?;
        w.put(right)?;
        return Ok((w.len, Rule::Join));
    }
    // A final S z h joins the retroflex row as q: 8.2.36 vraSca...Cazam
    // zah makes S z; 8.2.31 ho qhah makes h Q; 8.2.39 below makes either q.
    // Words of 8.2.32 to 8.2.35 (duh, nah...) and kvin words of 8.2.62
    // (diS) come as their pada form (Duk, dik).
    // A final N R n (Y is refused: its pada form is N).
    if matches!(x, Varna::Ng | Varna::Nn | Varna::N) {
        // 8.3.32 Namo hrasvad aci NamuR nityam: after a short vowel, before
        // a vowel, the nasal is doubled; after a long one, joined as written.
        if y.is_vowel() {
            let short = stem.last().is_some_and(|b| b"aiufx".contains(b));
            w.put(left)?;
            if short {
                w.put(&[x.slp1()])?;
            }
            w.put(right)?;
            return Ok((w.len, if short { Rule::NamoHrasvat } else { Rule::Join }));
        }
        if x == Varna::N {
            // 8.3.7 naS Cavy apraSAn: before chav followed by am, ru; 8.3.4
            // anusvara (8.3.2's anunasika is the other choice, not taken);
            // ru before khar is s (8.3.15, 8.3.34), S / z by 8.4.40 / 8.4.41.
            let am = varna::with_savarnas(set("am"));
            let chav = matches!(
                y,
                Varna::C | Varna::Ch | Varna::Tt | Varna::Tth | Varna::T | Varna::Th
            );
            if chav && at(right, 1).is_some_and(|v| has(am, v)) && left != b"praSAn" {
                let s = match y {
                    Varna::C | Varna::Ch => b'S',
                    Varna::Tt | Varna::Tth => b'z',
                    _ => b's',
                };
                w.put(stem)?;
                w.put(&[b'M', s])?;
                w.put(right)?;
                return Ok((w.len, Rule::NasChavi));
            }
            // 8.4.40 with S or the c row (Y; 8.4.63 needs a jhay, so no C),
            // 8.4.41 with the w row (R; 8.4.43 toh zi: not before z), 8.4.60
            // tor li (written l l, without the nasal mark).
            let row = stop(y).map(|(r, _)| r);
            let became = if y == Varna::Sh || row == Some(1) {
                Some((Varna::Ny, Rule::StohScuna))
            } else if row == Some(2) {
                Some((Varna::Nn, Rule::Stuna))
            } else if y == Varna::La {
                Some((Varna::La, Rule::TorLi))
            } else {
                None
            };
            if let Some((v, rule)) = became {
                w.put(stem)?;
                w.put(&[v.slp1()])?;
                w.put(right)?;
                return Ok((w.len, rule));
            }
        }
        w.put(left)?;
        w.put(right)?;
        return Ok((w.len, Rule::Join));
    }
    let shaped = match x {
        Varna::Sh | Varna::Ss | Varna::H => Some((2, 2)),
        _ => stop(x),
    };
    let Some((mut row, c)) = shaped.filter(|&(_, c)| c < 4) else {
        return Err(Error::NotYet);
    };
    // A final palatal stop. 8.2.36 vraSca...Cazam zah: C becomes z (and z
    // then takes the retroflex row). 8.2.30 coh kuh: c j J take the velar
    // row (k g G). The roots 8.2.36 names (rAj, yaj, sfj, mfj, BrAj, Brasj,
    // vraSc) and kvin words (8.2.62) cannot be told from the letters: the
    // caller gives their pada form (rAw, not rAj). 8.2.39 follows in both.
    if row == 1 {
        row = if c == 1 { 2 } else { 0 };
    }
    // 8.2.39: the final jhal becomes the jaS (column 2) of its row.
    let mut col = 2;
    let mut rule = Rule::JhalamJasonte;
    // The first letter of the second word, if a rule replaces it.
    let mut first = y;
    // 8.4.40 / 8.4.41: a dental next to S / the c row, or the w row. Not
    // before z: 8.4.43 toh zi (tat+zaw is tatzaw).
    if row == 3 {
        if y == Varna::Sh || stop(y).is_some_and(|(r, _)| r == 1) {
            row = 1;
            rule = Rule::StohScuna;
        } else if stop(y).is_some_and(|(r, _)| r == 2) {
            row = 2;
            rule = Rule::Stuna;
        }
    }
    // 8.4.45: before a nasal, the nasal of the row (optional; applied).
    if stop(y).is_some_and(|(_, c)| c == 4) {
        col = 4;
        rule = Rule::YaroNunasike;
    }
    // 8.4.55: before khar, car (the unvoiced, unaspirated stop).
    if has(set("Kar"), y) {
        col = 0;
        rule = Rule::KhariCa;
    }
    // 8.4.60: the t row before l becomes l.
    let mut replaced = None;
    if row == 3 && y == Varna::La {
        replaced = Some(Varna::La);
        rule = Rule::TorLi;
    }
    // 8.4.62: h after jhay becomes the aspirate of the jhay (col 3 voiced).
    if y == Varna::H && col == 2 {
        first = ROWS[row][3];
        rule = Rule::JhayoHo;
    }
    // 8.4.63: S after jhay, before aT (a vowel or h y v r), becomes C.
    if y == Varna::Sh {
        let at_set = varna::with_savarnas(set("aw"));
        if at(right, 1).is_some_and(|v| has(at_set, v)) {
            first = Varna::Ch;
            rule = Rule::SasCho;
        }
    }
    w.put(stem)?;
    w.put(&[replaced.unwrap_or(ROWS[row][col]).slp1()])?;
    w.put(&[first.slp1()])?;
    w.put(&right[1..])?;
    Ok((w.len, rule))
}

/// The long vowel savarna of a simple vowel (6.1.101's substitute).
fn long_of(v: varna::Varna) -> varna::Varna {
    use varna::Varna::*;
    match v {
        A | AA => AA,
        I | II => II,
        U | UU => UU,
        R | RR => RR,
        L | LL => LL,
        other => other,
    }
}

/// 1.1.50 sthane 'ntaratamah: of the candidates, the one closest in place to
/// `target`: each shared place counts two, each place the candidate has and
/// the target lacks counts minus one (so for the l vowel, dental l beats
/// dental-and-labial v). The first wins a tie.
fn antaratama(candidates: &[varna::Varna], target: varna::Varna) -> varna::Varna {
    let score = |c: &varna::Varna| {
        let shared = (c.sthana() & target.sthana()).count_ones() as i32;
        let extra = (c.sthana() & !target.sthana()).count_ones() as i32;
        2 * shared - extra
    };
    let mut best = candidates[0];
    for c in candidates {
        if score(c) > score(&best) {
            best = *c;
        }
    }
    best
}

/// The first engine (vowel grades instead of the varna model), kept to
/// check the current one against: they must agree on every request.
#[cfg(test)]
fn legacy_join(left: &[u8], right: &[u8], out: &mut [u8]) -> Result<(usize, Rule), Error> {
    let (Some(&last), Some(&first)) = (left.last(), right.first()) else {
        return Err(Error::Empty);
    };
    if left.iter().chain(right).any(|&b| class(b) == 0) {
        return Err(Error::NotSlp1);
    }
    let (a, b) = (class(last), class(first));
    let stem = &left[..left.len() - 1];
    let rest = &right[1..];
    let mut w = Writer { out, len: 0 };
    let rule = if a > 14 || b > 14 {
        w.put(left)?;
        w.put(right)?;
        return Ok((w.len, Rule::Join));
    } else {
        // Simple vowels have a grade (1 a, 2 i, 3 u, 4 f, 5 x); e E o O are 0.
        let grade = |c: u8| if c <= 10 { c.div_ceil(2) } else { 0 };
        let (ga, gb) = (grade(a), grade(b));
        if ga != 0 && ga == gb {
            w.put(stem)?;
            w.put(&[b"AIUFX"[ga as usize - 1]])?;
            w.put(rest)?;
            Rule::SavarnaDirgha
        } else if ga == 1 && gb >= 2 {
            w.put(stem)?;
            w.put(match gb {
                2 => b"e",
                3 => b"o",
                4 => b"ar",
                _ => b"al",
            })?;
            w.put(rest)?;
            Rule::Guna
        } else if ga == 1 {
            w.put(stem)?;
            w.put(if b <= 12 { b"E" } else { b"O" })?;
            w.put(rest)?;
            Rule::Vrddhi
        } else if ga >= 2 {
            w.put(stem)?;
            w.put(&[b"yvrl"[ga as usize - 2]])?;
            w.put(right)?;
            Rule::Yan
        } else if (a == 11 || a == 13) && b == 1 {
            w.put(left)?;
            w.put(b"'")?;
            w.put(rest)?;
            Rule::Purvarupa
        } else {
            w.put(stem)?;
            w.put(match a {
                11 => b"ay",
                12 => b"Ay",
                13 => b"av",
                _ => b"Av",
            })?;
            w.put(right)?;
            Rule::Ayadi
        }
    };
    Ok((w.len, rule))
}

struct Writer<'a> {
    out: &'a mut [u8],
    len: usize,
}

impl Writer<'_> {
    fn put(&mut self, bytes: &[u8]) -> Result<(), Error> {
        let end = self.len + bytes.len();
        if end > self.out.len() {
            return Err(Error::TooLong);
        }
        self.out[self.len..end].copy_from_slice(bytes);
        self.len = end;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    extern crate std;
    use super::*;
    use std::string::String;

    fn j(request: &str) -> (String, Rule) {
        let mut out = [0u8; MAX_TEXT];
        let (n, rule) = join_request(request.as_bytes(), &mut out).unwrap();
        (String::from_utf8(out[..n].to_vec()).unwrap(), rule)
    }

    #[test]
    fn classic_examples_follow_their_sutras() {
        for (request, joined, rule) in [
            ("vidyA+Alaya", "vidyAlaya", Rule::SavarnaDirgha),
            ("deva+Alaya", "devAlaya", Rule::SavarnaDirgha),
            ("kavi+indra", "kavIndra", Rule::SavarnaDirgha),
            ("BAnu+udaya", "BAnUdaya", Rule::SavarnaDirgha),
            ("pitf+fRa", "pitFRa", Rule::SavarnaDirgha),
            ("deva+indra", "devendra", Rule::Guna),
            ("rAma+ISa", "rAmeSa", Rule::Guna),
            ("sUrya+udaya", "sUryodaya", Rule::Guna),
            ("mahA+fzi", "maharzi", Rule::Guna),
            ("eka+eka", "ekEka", Rule::Vrddhi),
            ("mahA+OzaDi", "mahOzaDi", Rule::Vrddhi),
            ("iti+Adi", "ityAdi", Rule::Yan),
            ("su+Agata", "svAgata", Rule::Yan),
            ("pitf+AjYA", "pitrAjYA", Rule::Yan),
            ("vane+atra", "vane'tra", Rule::Purvarupa),
            ("hare+e", "haraye", Rule::Ayadi),
            ("vizRo+e", "vizRave", Rule::Ayadi),
            ("nE+aka", "nAyaka", Rule::Ayadi),
            ("pO+aka", "pAvaka", Rule::Ayadi),
            ("rAmaH+gacCati", "rAmo gacCati", Rule::HasiCa),
            ("vAk+ISa", "vAgISa", Rule::JhalamJasonte),
        ] {
            assert_eq!(j(request), (String::from(joined), rule), "{request}");
        }
    }

    #[test]
    fn the_varna_engine_agrees_with_the_first_engine_everywhere() {
        let letters = b"aAiIuUfFxXeEoOkKgGNcCjJYwWqQRtTdDnpPbBmyrlvSzshMH";
        let mut checked = 0;
        let mut skipped = 0;
        for &a in letters {
            for &b in letters {
                if a == b'H' || varna::Varna::from_slp1(a).is_some_and(|v| v.is_consonant()) {
                    // Visarga and consonant endings: only the new engine has
                    // these rules (the first joined them as written, which
                    // was wrong: vAk+ISa is vAgISa by 8.2.39). They are
                    // checked against the grammar below.
                    skipped += 3;
                    continue;
                }
                for (left, right) in [
                    (vec_of(&[a]), vec_of(&[b])),
                    (vec_of(&[b'k', a]), vec_of(&[b, b'k'])),
                    (
                        vec_of(&[b'd', b'e', b'v', a]),
                        vec_of(&[b, b'n', b'd', b'r', b'a']),
                    ),
                ] {
                    let (mut new, mut old) = ([0u8; MAX_TEXT], [0u8; MAX_TEXT]);
                    let got = join(&left, &right, &mut new).map(|(n, r)| (new[..n].to_vec(), r));
                    let want =
                        legacy_join(&left, &right, &mut old).map(|(n, r)| (old[..n].to_vec(), r));
                    assert_eq!(
                        got,
                        want,
                        "{:?}+{:?}",
                        core::str::from_utf8(&left),
                        core::str::from_utf8(&right)
                    );
                    checked += 1;
                }
            }
        }
        assert_eq!(checked + skipped, 49 * 49 * 3);
        assert_eq!(skipped, 34 * 49 * 3);
        // Errors and the output limit, the same way.
        for request in [
            &b"+indra"[..],
            b"deva+",
            b"deva+in+dra",
            b"deva+indra!",
            b"de va+a",
        ] {
            let (mut new, mut old) = ([0u8; MAX_TEXT], [0u8; MAX_TEXT]);
            let plus = request.iter().position(|&c| c == b'+').unwrap();
            assert_eq!(
                join(&request[..plus], &request[plus + 1..], &mut new),
                legacy_join(&request[..plus], &request[plus + 1..], &mut old)
            );
        }
        let (mut tiny_new, mut tiny_old) = ([0u8; 4], [0u8; 4]);
        assert_eq!(
            join(b"deva", b"indra", &mut tiny_new),
            legacy_join(b"deva", b"indra", &mut tiny_old)
        );
    }

    #[test]
    fn r_and_l_vowels_meeting_stay_with_6_1_77_for_now() {
        // Open exception: the varttika makes them savarna (6.1.101); the
        // engines keep 6.1.77 until that is decided (docs/panini.md).
        assert_eq!(j("pitf+xkAra"), (String::from("pitrxkAra"), Rule::Yan));
        assert!(varna::savarna(varna::Varna::R, varna::Varna::L));
    }

    #[test]
    fn visarga_s_and_r_follow_the_grammar() {
        for (request, joined, rule) in [
            ("rAmaH+gacCati", "rAmo gacCati", Rule::HasiCa),
            ("rAmaH+atra", "rAmo'tra", Rule::AtoRoh),
            ("rAmaH+iti", "rAma iti", Rule::LopahSakalyasya),
            ("devAH+gacCanti", "devA gacCanti", Rule::HaliSarvesham),
            ("devAH+atra", "devA atra", Rule::LopahSakalyasya),
            ("rAmaH+ca", "rAmaS ca", Rule::VisarjaniyasyaSah),
            ("rAmaH+tatra", "rAmas tatra", Rule::VisarjaniyasyaSah),
            ("rAmaH+wIkA", "rAmaz wIkA", Rule::VisarjaniyasyaSah),
            ("rAmaH+karoti", "rAmaH karoti", Rule::Kupvoh),
            ("rAmaH+Sete", "rAmaH Sete", Rule::VaSari),
            ("kaH+tsaruH", "kaH tsaruH", Rule::SarpareVisarjaniyah),
            ("hariH+gacCati", "harir gacCati", Rule::Repha),
            ("hariH+atra", "harir atra", Rule::Repha),
            ("hariH+ca", "hariS ca", Rule::VisarjaniyasyaSah),
            ("guruH+vadati", "gurur vadati", Rule::Repha),
            ("punar+gacCati", "punar gacCati", Rule::Repha),
            ("punar+ca", "punaS ca", Rule::VisarjaniyasyaSah),
            ("rAmas+gacCati", "rAmo gacCati", Rule::HasiCa),
            ("saH+gacCati", "sa gacCati", Rule::SuLopa),
            ("ezaH+ca", "eza ca", Rule::SuLopa),
            ("saH+atra", "so'tra", Rule::AtoRoh),
        ] {
            assert_eq!(j(request), (String::from(joined), rule), "{request}");
        }
        let mut out = [0u8; MAX_TEXT];
        for not_yet in [
            &b"punar+ramate"[..],
            b"hariH+ramate",
            b"vAkH+atra",
            b"H+atra",
            b"rAmaH+Mca",
        ] {
            assert_eq!(
                join_request(not_yet, &mut out),
                Err(Error::NotYet),
                "{:?}",
                core::str::from_utf8(not_yet)
            );
        }
        // ru after a/A before r is not 8.3.14: 6.1.114 and 8.3.17 apply.
        assert_eq!(
            j("rAmaH+ramate"),
            (String::from("rAmo ramate"), Rule::HasiCa)
        );
    }

    #[test]
    fn consonant_endings_follow_the_grammar() {
        for (request, joined, rule) in [
            ("vAk+ISa", "vAgISa", Rule::JhalamJasonte),
            ("jagat+ISa", "jagadISa", Rule::JhalamJasonte),
            ("tat+gacCati", "tadgacCati", Rule::JhalamJasonte),
            ("tat+ramate", "tadramate", Rule::JhalamJasonte),
            ("tat+ca", "tacca", Rule::KhariCa),
            ("sat+jana", "sajjana", Rule::StohScuna),
            ("tat+wIkA", "tawwIkA", Rule::KhariCa),
            // 8.4.43 toh zi: a dental before z stays dental.
            ("tat+zaw", "tatzaw", Rule::KhariCa),
            ("tad+zoqaSa", "tatzoqaSa", Rule::KhariCa),
            ("tat+na", "tanna", Rule::YaroNunasike),
            ("vAk+mAtra", "vANmAtra", Rule::YaroNunasike),
            ("tat+laya", "tallaya", Rule::TorLi),
            ("tat+Siva", "tacCiva", Rule::SasCho),
            ("vAk+Sata", "vAkCata", Rule::SasCho),
            ("vAk+hari", "vAgGari", Rule::JhayoHo),
            ("tat+hita", "tadDita", Rule::JhayoHo),
            ("kim+karoti", "kiM karoti", Rule::MoNusvara),
            ("kim+atra", "kimatra", Rule::Join),
            ("ap+su", "apsu", Rule::KhariCa),
            ("tat+pAda", "tatpAda", Rule::KhariCa),
            ("liw+ca", "liwca", Rule::KhariCa),
            // 8.2.30 coh kuh, then 8.2.39 and the rest.
            ("vAc+ISa", "vAgISa", Rule::JhalamJasonte),
            ("vAc+ca", "vAkca", Rule::KhariCa),
            ("vAc+mAtra", "vANmAtra", Rule::YaroNunasike),
            ("vAc+hari", "vAgGari", Rule::JhayoHo),
            ("vAc+Sata", "vAkCata", Rule::SasCho),
            ("vaRij+atra", "vaRigatra", Rule::JhalamJasonte),
            ("vaRij+karoti", "vaRikkaroti", Rule::KhariCa),
            // 8.2.36 for C: z, then 8.2.39 q.
            ("prAC+atra", "prAqatra", Rule::JhalamJasonte),
            ("prAC+ca", "prAwca", Rule::KhariCa),
            ("prAC+mAtra", "prARmAtra", Rule::YaroNunasike),
            // The roots of 8.2.36: the caller gives the pada form.
            ("rAw+atra", "rAqatra", Rule::JhalamJasonte),
            // 8.2.36 for S, then 8.2.39 q and the rest.
            ("viS+atra", "viqatra", Rule::JhalamJasonte),
            ("viS+ca", "viwca", Rule::KhariCa),
            ("viS+mAtra", "viRmAtra", Rule::YaroNunasike),
            ("viS+hari", "viqQari", Rule::JhayoHo),
            ("viS+Siva", "viwCiva", Rule::SasCho),
            // z: 8.2.39 directly.
            ("dviz+atra", "dviqatra", Rule::JhalamJasonte),
            ("dviz+ca", "dviwca", Rule::KhariCa),
            ("zaz+mAsa", "zaRmAsa", Rule::YaroNunasike),
            // 8.4.42 na padantat wor anAm: a dental after a final w stays.
            ("dviz+tat", "dviwtat", Rule::KhariCa),
            // 8.2.31 ho qhah, then 8.2.39.
            ("lih+atra", "liqatra", Rule::JhalamJasonte),
            ("lih+ca", "liwca", Rule::KhariCa),
            ("maDulih+gacCati", "maDuliqgacCati", Rule::JhalamJasonte),
            // kvin words (8.2.62) and 8.2.32: the caller gives the pada form.
            ("dik+ambara", "digambara", Rule::JhalamJasonte),
            ("Duk+atra", "Dugatra", Rule::JhalamJasonte),
            // 8.3.7 with 8.3.4, 8.3.34, 8.4.40 / 8.4.41.
            ("tAn+ca", "tAMSca", Rule::NasChavi),
            ("kasmin+cit", "kasmiMScit", Rule::NasChavi),
            ("tAn+tarati", "tAMstarati", Rule::NasChavi),
            ("tAn+wIkA", "tAMzwIkA", Rule::NasChavi),
            ("praSAn+tanoti", "praSAntanoti", Rule::Join),
            ("mahAn+tsaru", "mahAntsaru", Rule::Join),
            // 8.3.32: after a short vowel only.
            ("rAjan+atra", "rAjannatra", Rule::NamoHrasvat),
            ("tasmin+eva", "tasminneva", Rule::NamoHrasvat),
            ("pratyaN+AtmA", "pratyaNNAtmA", Rule::NamoHrasvat),
            ("sugaR+ISa", "sugaRRISa", Rule::NamoHrasvat),
            ("tAn+atra", "tAnatra", Rule::Join),
            // 8.4.40, 8.4.41, 8.4.60 with n.
            ("tAn+jayati", "tAYjayati", Rule::StohScuna),
            ("tAn+Siva", "tAYSiva", Rule::StohScuna),
            ("tAn+qamaru", "tARqamaru", Rule::Stuna),
            ("tAn+zaw", "tAnzaw", Rule::Join),
            ("vidvAn+likhati", "vidvAllikhati", Rule::TorLi),
            ("tAn+gacCati", "tAngacCati", Rule::Join),
            ("pratyaN+gacCati", "pratyaNgacCati", Rule::Join),
        ] {
            assert_eq!(j(request), (String::from(joined), rule), "{request}");
        }
        let mut out = [0u8; MAX_TEXT];
        for not_yet in [&b"prAY+atra"[..], b"tat+Mka", b"ziv+a"] {
            assert_eq!(
                join_request(not_yet, &mut out),
                Err(Error::NotYet),
                "{:?}",
                core::str::from_utf8(not_yet)
            );
        }
    }

    #[test]
    fn a_final_jhal_never_stays_aspirated_or_voiced_before_khar() {
        use varna::{pratyahara, Varna};
        let letters = b"aAiIuUfFxXeEoOkKgGNcCjJYwWqQRtTdDnpPbBmyrlvSzsh";
        let khar = pratyahara("Kar").unwrap();
        for &a in b"kKgGcCjJwWqQtTdDpPbBSzh" {
            for &b in letters.iter() {
                let mut out = [0u8; MAX_TEXT];
                let request = [b'k', b'a', a, b'+', b, b'a'];
                let (n, _) = join_request(&request, &mut out).unwrap();
                let last = Varna::from_slp1(out[2]).unwrap();
                let first = Varna::from_slp1(b).unwrap();
                assert!(
                    !last.is_mahaprana() || matches!(last, Varna::Ss),
                    "{:?}",
                    core::str::from_utf8(&out[..n])
                );
                if khar & first.bit() != 0 {
                    assert!(!last.is_ghosha(), "{:?}", core::str::from_utf8(&out[..n]));
                }
                assert!(out[..n]
                    .iter()
                    .all(|&c| Varna::from_slp1(c).is_some() || c == b' ' || c == b'\''));
            }
        }
    }

    fn vec_of(bytes: &[u8]) -> std::vec::Vec<u8> {
        bytes.to_vec()
    }

    #[test]
    fn malformed_requests_are_refused() {
        let mut out = [0u8; MAX_TEXT];
        assert_eq!(join_request(b"devaindra", &mut out), Err(Error::NoPlus));
        assert_eq!(join_request(b"+indra", &mut out), Err(Error::Empty));
        assert_eq!(join_request(b"deva+", &mut out), Err(Error::Empty));
        assert_eq!(join_request(b"deva+in+dra", &mut out), Err(Error::NotSlp1));
        assert_eq!(join_request(b"deva+indra!", &mut out), Err(Error::NotSlp1));
        assert_eq!(
            join_request("देव+इन्द्र".as_bytes(), &mut out),
            Err(Error::NotSlp1)
        );
        let mut tiny = [0u8; 4];
        assert_eq!(join_request(b"deva+indra", &mut tiny), Err(Error::TooLong));
    }

    #[test]
    fn a_result_is_never_longer_than_its_request() {
        // ayadi adds a letter but the `+` goes, so 64 bytes in fit 64 out.
        let mut out = [0u8; MAX_TEXT];
        for a in VOWELS.iter().chain(b"k") {
            for b in VOWELS.iter().chain(b"k") {
                let request = [b'k', *a, b'+', *b, b'k'];
                let (n, _) = join_request(&request, &mut out).unwrap();
                assert!(n <= request.len(), "{:?}", core::str::from_utf8(&request));
            }
        }
    }
}
