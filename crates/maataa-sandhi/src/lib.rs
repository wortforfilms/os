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
}

impl Error {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::NoPlus => "no + between the two words",
            Self::Empty => "a word is empty",
            Self::NotSlp1 => "not SLP1 letters (or a second +)",
            Self::TooLong => "too long",
        }
    }

    pub const fn code(self) -> i32 {
        match self {
            Self::NoPlus => -101,
            Self::Empty => -102,
            Self::NotSlp1 => -103,
            Self::TooLong => -104,
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
            ("rAmaH+gacCati", "rAmaHgacCati", Rule::Join),
            ("vAk+ISa", "vAkISa", Rule::Join),
        ] {
            assert_eq!(j(request), (String::from(joined), rule), "{request}");
        }
    }

    #[test]
    fn the_varna_engine_agrees_with_the_first_engine_everywhere() {
        let letters = b"aAiIuUfFxXeEoOkKgGNcCjJYwWqQRtTdDnpPbBmyrlvSzshMH";
        let mut checked = 0;
        for &a in letters {
            for &b in letters {
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
        assert_eq!(checked, 49 * 49 * 3);
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
