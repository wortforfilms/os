//! Devanagari <-> SLP1 for the letters the sandhi rules know (feature
//! `alloc`; host tools only, never the kernel).
//!
//! Supported: the vowels अ आ इ ई उ ऊ ऋ ॠ ऌ ॡ ए ऐ ओ औ and their signs, the 33
//! consonants क..ह, virama ्, anusvara ं, visarga ः, avagraha ऽ (`'`), and `+`
//! and space, which pass through. Anything else (ळ, nukta forms such as क़,
//! ZWJ/ZWNJ, chandrabindu, Vedic accents, digits, ।) is refused with the
//! character, never dropped, so a conversion is either exact or an error.
//!
//! A consonant carries the vowel `a` unless a vowel sign or a virama follows
//! it: `इन्द्र` is `i n ् d ् r` + the `a` of र, so `indra`.

use alloc::string::String;

/// Why a text could not be converted.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LipiError {
    /// A character outside the supported set.
    Unsupported(char),
    /// A vowel sign or virama with no consonant before it.
    Misplaced(char),
}

impl core::fmt::Display for LipiError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Self::Unsupported(c) => write!(f, "unsupported character {c:?} (U+{:04X})", *c as u32),
            Self::Misplaced(c) => {
                write!(f, "{c:?} (U+{:04X}) has no consonant before it", *c as u32)
            }
        }
    }
}

/// SLP1 vowel, its independent letter, its sign (None for `a`).
const VOWELS: [(u8, char, Option<char>); 14] = [
    (b'a', 'अ', None),
    (b'A', 'आ', Some('ा')),
    (b'i', 'इ', Some('ि')),
    (b'I', 'ई', Some('ी')),
    (b'u', 'उ', Some('ु')),
    (b'U', 'ऊ', Some('ू')),
    (b'f', 'ऋ', Some('ृ')),
    (b'F', 'ॠ', Some('ॄ')),
    (b'x', 'ऌ', Some('ॢ')),
    (b'X', 'ॡ', Some('ॣ')),
    (b'e', 'ए', Some('े')),
    (b'E', 'ऐ', Some('ै')),
    (b'o', 'ओ', Some('ो')),
    (b'O', 'औ', Some('ौ')),
];

const CONSONANTS: [(u8, char); 33] = [
    (b'k', 'क'),
    (b'K', 'ख'),
    (b'g', 'ग'),
    (b'G', 'घ'),
    (b'N', 'ङ'),
    (b'c', 'च'),
    (b'C', 'छ'),
    (b'j', 'ज'),
    (b'J', 'झ'),
    (b'Y', 'ञ'),
    (b'w', 'ट'),
    (b'W', 'ठ'),
    (b'q', 'ड'),
    (b'Q', 'ढ'),
    (b'R', 'ण'),
    (b't', 'त'),
    (b'T', 'थ'),
    (b'd', 'द'),
    (b'D', 'ध'),
    (b'n', 'न'),
    (b'p', 'प'),
    (b'P', 'फ'),
    (b'b', 'ब'),
    (b'B', 'भ'),
    (b'm', 'म'),
    (b'y', 'य'),
    (b'r', 'र'),
    (b'l', 'ल'),
    (b'v', 'व'),
    (b'S', 'श'),
    (b'z', 'ष'),
    (b's', 'स'),
    (b'h', 'ह'),
];

/// Signs and pass-through characters other than vowels and consonants.
const OTHERS: [(u8, char); 5] = [
    (b'M', 'ं'),
    (b'H', 'ः'),
    (b'\'', 'ऽ'),
    (b'+', '+'),
    (b' ', ' '),
];

const VIRAMA: char = '्';

/// Whether `text` has any character in the Devanagari block.
pub fn is_devanagari(text: &str) -> bool {
    text.chars().any(|c| ('\u{0900}'..='\u{097F}').contains(&c))
}

/// SLP1 to Devanagari.
pub fn slp1_to_deva(text: &str) -> Result<String, LipiError> {
    let bytes = text.as_bytes();
    let mut out = String::new();
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        if let Some(&(_, letter)) = CONSONANTS.iter().find(|(s, _)| *s == b) {
            out.push(letter);
            match bytes
                .get(i + 1)
                .and_then(|n| VOWELS.iter().find(|(s, _, _)| s == n))
            {
                // The consonant's own `a`: nothing to write.
                Some((_, _, None)) => i += 1,
                Some((_, _, Some(sign))) => {
                    out.push(*sign);
                    i += 1;
                }
                None => out.push(VIRAMA),
            }
        } else if let Some(&(_, letter, _)) = VOWELS.iter().find(|(s, _, _)| *s == b) {
            out.push(letter);
        } else if let Some(&(_, c)) = OTHERS.iter().find(|(s, _)| *s == b) {
            out.push(c);
        } else {
            // Not ASCII-safe to index: report the whole character.
            let c = text[i..].chars().next().unwrap_or('?');
            return Err(LipiError::Unsupported(c));
        }
        i += 1;
    }
    Ok(out)
}

/// Devanagari to SLP1.
pub fn deva_to_slp1(text: &str) -> Result<String, LipiError> {
    let mut out = String::new();
    // A consonant was written and still carries its `a`.
    let mut open = false;
    for c in text.chars() {
        if c == VIRAMA {
            if !open {
                return Err(LipiError::Misplaced(c));
            }
            open = false;
            continue;
        }
        if let Some(&(slp, _, _)) = VOWELS.iter().find(|(_, _, sign)| *sign == Some(c)) {
            if !open {
                return Err(LipiError::Misplaced(c));
            }
            out.push(slp as char);
            open = false;
            continue;
        }
        if open {
            out.push('a');
            open = false;
        }
        if let Some(&(slp, _)) = CONSONANTS.iter().find(|(_, l)| *l == c) {
            out.push(slp as char);
            open = true;
        } else if let Some(&(slp, _, _)) = VOWELS.iter().find(|(_, l, _)| *l == c) {
            out.push(slp as char);
        } else if let Some(&(slp, _)) = OTHERS.iter().find(|(_, l)| *l == c) {
            out.push(slp as char);
        } else {
            return Err(LipiError::Unsupported(c));
        }
    }
    if open {
        out.push('a');
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec::Vec;

    #[test]
    fn words_convert_both_ways() {
        for (deva, slp1) in [
            ("देव+इन्द्र", "deva+indra"),
            ("देवेन्द्र", "devendra"),
            ("महर्षि", "maharzi"),
            ("इत्यादि", "ityAdi"),
            ("वनेऽत्र", "vane'tra"),
            ("हरये", "haraye"),
            ("वाक्+ईश", "vAk+ISa"),
            ("रामः गच्छति", "rAmaH gacCati"),
            ("संस्कृतम्", "saMskftam"),
            ("कअ", "kaa"),
            ("ॠ ऌ ॡ", "F x X"),
            ("पितॄ", "pitF"),
        ] {
            assert_eq!(deva_to_slp1(deva).as_deref(), Ok(slp1), "{deva}");
            assert_eq!(slp1_to_deva(slp1).as_deref(), Ok(deva), "{slp1}");
        }
    }

    #[test]
    fn a_bare_consonant_carries_a_and_a_virama_removes_it() {
        assert_eq!(deva_to_slp1("क").as_deref(), Ok("ka"));
        assert_eq!(deva_to_slp1("क्").as_deref(), Ok("k"));
        assert_eq!(deva_to_slp1("कि").as_deref(), Ok("ki"));
        assert_eq!(deva_to_slp1("कं").as_deref(), Ok("kaM"));
        assert_eq!(deva_to_slp1("क्ष").as_deref(), Ok("kza"));
    }

    #[test]
    fn unsupported_and_misplaced_characters_are_refused() {
        for c in [
            'ळ', '\u{0958}', '\u{093C}', '\u{200D}', '\u{200C}', 'ँ', '१', '।', 'x',
        ] {
            let text: String = ['क', c].iter().collect();
            assert!(
                matches!(deva_to_slp1(&text), Err(LipiError::Unsupported(found)) if found == c),
                "{c:?}"
            );
        }
        assert_eq!(deva_to_slp1("ि"), Err(LipiError::Misplaced('ि')));
        assert_eq!(deva_to_slp1("अ्"), Err(LipiError::Misplaced('्')));
        assert_eq!(deva_to_slp1("क््"), Err(LipiError::Misplaced('्')));
        assert_eq!(slp1_to_deva("deva+L"), Err(LipiError::Unsupported('L')));
        assert_eq!(slp1_to_deva("dévа"), Err(LipiError::Unsupported('é')));
    }

    #[test]
    fn every_slp1_text_over_the_alphabet_round_trips() {
        let alphabet: Vec<u8> = VOWELS
            .iter()
            .map(|v| v.0)
            .chain(CONSONANTS.iter().map(|c| c.0))
            .chain(OTHERS.iter().map(|o| o.0))
            .collect();
        // Every string of up to three letters.
        let mut texts: Vec<Vec<u8>> = alloc::vec![Vec::new()];
        for _ in 0..3 {
            let mut next = Vec::new();
            for t in &texts {
                for &b in &alphabet {
                    let mut t = t.clone();
                    t.push(b);
                    next.push(t);
                }
            }
            for t in &next {
                let slp1 = core::str::from_utf8(t).unwrap();
                let deva = slp1_to_deva(slp1).unwrap();
                assert_eq!(deva_to_slp1(&deva).as_deref(), Ok(slp1), "{slp1} -> {deva}");
            }
            texts = next;
        }
    }

    #[test]
    fn detection_looks_for_devanagari() {
        assert!(is_devanagari("देव+indra"));
        assert!(!is_devanagari("deva+indra"));
    }
}
