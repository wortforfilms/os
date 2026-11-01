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
pub fn join(left: &[u8], right: &[u8], out: &mut [u8]) -> Result<(usize, Rule), Error> {
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
