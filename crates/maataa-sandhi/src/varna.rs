//! The phonemes (varna) the sandhi rules work on, their phonetic properties,
//! and pratyaharas computed from the fourteen Maheshvara sutras.
//!
//! Two layers, because the sutras do not list every phoneme:
//!
//! - [`Varna`]: every phoneme of the SLP1 alphabet the rules use (14 vowels,
//!   33 consonants, anusvara, visarga), one-to-one with its SLP1 byte. The
//!   long vowels, anusvara and visarga are not in the sutras.
//! - [`SHIVA_SUTRAS`]: the sutras as written, each a list of varnas and its
//!   it-marker. A pratyahara is a range of these from its first letter to an
//!   it-marker ([`pratyahara`]); 1.1.69 then lets a vowel in it stand for its
//!   savarnas ([`with_savarnas`]).
//!
//! Sets of varnas are `u64` masks, bit [`Varna::index`].
//!
//! Points the tests pin down:
//!
//! - ण् is the it-marker of two sutras (अइउण्, लण्); ण the varna occurs once
//!   (ञमङणनम्). A pratyahara ending in ण् must say which when both make
//!   sense: `aR1` is अ इ उ, `aR2` runs to लण्; `iR` likewise (इण् of 8.3.57 is
//!   `iR2`). When only one makes sense (`yaR`) it is taken.
//! - ह occurs twice (हयवरट्, हल्). A pratyahara starts at the first
//!   occurrence of its letter, so हल् is all 33 consonants; the second ह is
//!   only ever a member (झल्, शल्).

/// A phoneme, in SLP1 order: vowels, the five vargas, semivowels, sibilants
/// and h, then anusvara and visarga.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[repr(u8)]
pub enum Varna {
    A,
    AA,
    I,
    II,
    U,
    UU,
    R,
    RR,
    L,
    LL,
    E,
    AI,
    O,
    AU,
    K,
    Kh,
    G,
    Gh,
    Ng,
    C,
    Ch,
    J,
    Jh,
    Ny,
    Tt,
    Tth,
    Dd,
    Ddh,
    Nn,
    T,
    Th,
    D,
    Dh,
    N,
    P,
    Ph,
    B,
    Bh,
    M,
    Y,
    Ra,
    La,
    V,
    Sh,
    Ss,
    S,
    H,
    Anusvara,
    Visarga,
}

/// SLP1 byte of each varna, in [`Varna`] order.
const SLP1: &[u8; 49] = b"aAiIuUfFxXeEoOkKgGNcCjJYwWqQRtTdDnpPbBmyrlvSzshMH";

/// All varnas in order.
pub const ALL: [Varna; 49] = {
    use Varna::*;
    [
        A, AA, I, II, U, UU, R, RR, L, LL, E, AI, O, AU, K, Kh, G, Gh, Ng, C, Ch, J, Jh, Ny, Tt,
        Tth, Dd, Ddh, Nn, T, Th, D, Dh, N, P, Ph, B, Bh, M, Y, Ra, La, V, Sh, Ss, S, H, Anusvara,
        Visarga,
    ]
};

/// Places of articulation (sthana), as bits: a varna may have more than one.
pub mod sthana {
    pub const KANTHA: u8 = 1 << 0;
    pub const TALU: u8 = 1 << 1;
    pub const MURDHA: u8 = 1 << 2;
    pub const DANTA: u8 = 1 << 3;
    pub const OSHTHA: u8 = 1 << 4;
    /// The nose (1.1.8). Not part of the mouth (asya) that 1.1.9 compares.
    pub const NASIKA: u8 = 1 << 5;
}

/// Internal effort (abhyantara prayatna).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Prayatna {
    /// Stops and nasals.
    Sprishta,
    /// Semivowels y r l v.
    IshatSprishta,
    /// Sibilants and h.
    IshadVivrta,
    /// Vowels. (Short a is samvrta in use but vivrta in the grammar's
    /// operations, which is what this models.)
    Vivrta,
    /// Anusvara and visarga (ayogavaha): outside this scheme.
    Ayogavaha,
}

/// Length (matra) of a vowel.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Matra {
    Hrasva,
    Dirgha,
}

impl Varna {
    pub const fn index(self) -> usize {
        self as usize
    }

    pub const fn bit(self) -> u64 {
        1 << self as u64
    }

    pub const fn slp1(self) -> u8 {
        SLP1[self as usize]
    }

    pub fn from_slp1(byte: u8) -> Option<Self> {
        SLP1.iter().position(|&b| b == byte).map(|i| ALL[i])
    }

    /// A vowel (ac).
    pub const fn is_vowel(self) -> bool {
        (self as u8) <= Varna::AU as u8
    }

    /// A consonant (hal).
    pub const fn is_consonant(self) -> bool {
        (self as u8) >= Varna::K as u8 && (self as u8) <= Varna::H as u8
    }

    pub const fn sthana(self) -> u8 {
        use sthana::*;
        use Varna::*;
        match self {
            A | AA | K | Kh | G | Gh | H | Visarga => KANTHA,
            Ng => KANTHA | NASIKA,
            I | II | C | Ch | J | Jh | Y | Sh => TALU,
            Ny => TALU | NASIKA,
            R | RR | Tt | Tth | Dd | Ddh | Ra | Ss => MURDHA,
            Nn => MURDHA | NASIKA,
            L | LL | T | Th | D | Dh | La | S => DANTA,
            N => DANTA | NASIKA,
            U | UU | P | Ph | B | Bh => OSHTHA,
            M => OSHTHA | NASIKA,
            E | AI => KANTHA | TALU,
            O | AU => KANTHA | OSHTHA,
            V => DANTA | OSHTHA,
            Anusvara => NASIKA,
        }
    }

    pub const fn prayatna(self) -> Prayatna {
        use Varna::*;
        match self {
            Y | Ra | La | V => Prayatna::IshatSprishta,
            Sh | Ss | S | H => Prayatna::IshadVivrta,
            Anusvara | Visarga => Prayatna::Ayogavaha,
            _ if self.is_vowel() => Prayatna::Vivrta,
            _ => Prayatna::Sprishta,
        }
    }

    /// Voiced (ghosha, a bahya prayatna): vowels, the 3rd to 5th of each
    /// varga, y r l v and h. Anusvara counts as voiced; visarga does not.
    pub const fn is_ghosha(self) -> bool {
        use Varna::*;
        !matches!(
            self,
            K | Kh | C | Ch | Tt | Tth | T | Th | P | Ph | Sh | Ss | S | Visarga
        )
    }

    /// Aspirated (mahaprana): the 2nd and 4th of each varga, and the
    /// sibilants and h.
    pub const fn is_mahaprana(self) -> bool {
        use Varna::*;
        matches!(
            self,
            Kh | Gh | Ch | Jh | Tth | Ddh | Th | Dh | Ph | Bh | Sh | Ss | S | H
        )
    }

    /// Length of a vowel; e ai o au are always long. None for others.
    pub const fn matra(self) -> Option<Matra> {
        use Varna::*;
        match self {
            A | I | U | R | L => Some(Matra::Hrasva),
            _ if self.is_vowel() => Some(Matra::Dirgha),
            _ => None,
        }
    }
}

/// 1.1.9 tulyasyaprayatnam savarnam: same place in the mouth and same
/// internal effort; with 1.1.10 najjhalau (a vowel and a consonant never) and
/// the varttika that r and l vowels are savarna of each other.
///
/// Excluded and flagged for review: e/ai and o/au share place and effort, so
/// 1.1.9 as modelled would make them savarna; the grammar is not used that
/// way, so this keeps e ai o au savarna only of themselves.
pub fn savarna(a: Varna, b: Varna) -> bool {
    use Varna::*;
    if a == b {
        return true;
    }
    if a.is_vowel() != b.is_vowel() {
        return false;
    }
    if matches!(a, E | AI | O | AU) || matches!(b, E | AI | O | AU) {
        return false;
    }
    let rl = |v: Varna| matches!(v, R | RR | L | LL);
    if rl(a) && rl(b) {
        return true;
    }
    if matches!(a.prayatna(), Prayatna::Ayogavaha) || matches!(b.prayatna(), Prayatna::Ayogavaha) {
        return false;
    }
    let asya = |v: Varna| v.sthana() & !sthana::NASIKA;
    asya(a) == asya(b) && a.prayatna() == b.prayatna()
}

/// The fourteen Maheshvara sutras: varnas and it-marker (SLP1).
pub const SHIVA_SUTRAS: [(&[Varna], u8); 14] = {
    use Varna::*;
    [
        (&[A, I, U], b'R'),
        (&[R, L], b'k'),
        (&[E, O], b'N'),
        (&[AI, AU], b'c'),
        (&[H, Y, V, Ra], b'w'),
        (&[La], b'R'),
        (&[Ny, M, Ng, Nn, N], b'm'),
        (&[Jh, Bh], b'Y'),
        (&[Gh, Ddh, Dh], b'z'),
        (&[J, B, G, Dd, D], b'S'),
        (&[Kh, Ph, Ch, Tth, Th, C, Tt, T], b'v'),
        (&[K, P], b'y'),
        (&[Sh, Ss, S], b'r'),
        (&[H], b'l'),
    ]
};

/// Why a pratyahara name was refused.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PratyaharaError {
    /// Not of the form letter [a] it-marker [1|2].
    Malformed,
    /// The first letter is not in the sutras.
    NoSuchLetter,
    /// No sutra ends with this it-marker after the first letter.
    NoSuchIt,
    /// It ends in R and both R make sense: say R1 or R2.
    WhichR,
}

/// The varnas of a pratyahara named in SLP1 as written in the sutras: its
/// first letter, an `a` after a consonant (said only for pronunciation), its
/// it-marker, and for R a `1` or `2` when needed: `ac`, `hal`, `ik`, `yaR`,
/// `Jal`, `aR1`, `aR2`, `iR2`. Vowels stand only for themselves here; see
/// [`with_savarnas`].
pub fn pratyahara(name: &str) -> Result<u64, PratyaharaError> {
    let bytes = name.as_bytes();
    let first = Varna::from_slp1(*bytes.first().ok_or(PratyaharaError::Malformed)?)
        .ok_or(PratyaharaError::NoSuchLetter)?;
    let mut rest = &bytes[1..];
    if first.is_consonant() {
        rest = rest.strip_prefix(b"a").ok_or(PratyaharaError::Malformed)?;
    }
    let (&it, which) = match rest {
        [it] => (it, None),
        [it, b'1'] => (it, Some(1)),
        [it, b'2'] => (it, Some(2)),
        _ => return Err(PratyaharaError::Malformed),
    };
    if which.is_some() && it != b'R' {
        return Err(PratyaharaError::Malformed);
    }
    // Where the first letter first occurs.
    let start = SHIVA_SUTRAS
        .iter()
        .enumerate()
        .find_map(|(s, (letters, _))| letters.iter().position(|&v| v == first).map(|p| (s, p)))
        .ok_or(PratyaharaError::NoSuchLetter)?;
    // Sutras ending in this it-marker at or after the start.
    let mut ends = SHIVA_SUTRAS
        .iter()
        .enumerate()
        .filter(|(_, (_, marker))| *marker == it)
        .map(|(s, _)| s);
    let all: [Option<usize>; 2] = [ends.next(), ends.next()];
    let end = match (which, all) {
        (None, [Some(only), None]) => only,
        (None, [Some(a), Some(b)]) => match (a >= start.0, b >= start.0) {
            (true, true) => return Err(PratyaharaError::WhichR),
            (false, true) => b,
            _ => return Err(PratyaharaError::NoSuchIt),
        },
        (Some(n), _) => all[n - 1].ok_or(PratyaharaError::NoSuchIt)?,
        _ => return Err(PratyaharaError::NoSuchIt),
    };
    if end < start.0 {
        return Err(PratyaharaError::NoSuchIt);
    }
    let mut mask = 0;
    for (s, (letters, _)) in SHIVA_SUTRAS.iter().enumerate().take(end + 1).skip(start.0) {
        let from = if s == start.0 { start.1 } else { 0 };
        for v in &letters[from..] {
            mask |= v.bit();
        }
    }
    Ok(mask)
}

/// 1.1.69 anudit savarnasya capratyayah: a vowel in a pratyahara also
/// stands for its savarnas (long a for a, and so on).
pub fn with_savarnas(mask: u64) -> u64 {
    let mut out = mask;
    for v in ALL.iter().filter(|v| v.is_vowel() && mask & v.bit() != 0) {
        for w in ALL.iter().filter(|w| savarna(*v, **w)) {
            out |= w.bit();
        }
    }
    out
}

/// The varnas of a mask, in order (for tests and messages).
pub fn members(mask: u64) -> impl Iterator<Item = Varna> {
    ALL.into_iter().filter(move |v| mask & v.bit() != 0)
}

#[cfg(test)]
mod tests {
    extern crate std;
    use super::*;
    use std::string::String;
    use std::vec::Vec;

    fn slp1(mask: u64) -> String {
        members(mask).map(|v| v.slp1() as char).collect()
    }

    fn p(name: &str) -> String {
        slp1(pratyahara(name).unwrap_or_else(|e| panic!("{name}: {e:?}")))
    }

    #[test]
    fn slp1_and_varna_are_one_to_one() {
        for (i, v) in ALL.iter().enumerate() {
            assert_eq!(v.index(), i);
            assert_eq!(Varna::from_slp1(v.slp1()), Some(*v));
            assert!(crate::class(v.slp1()) != 0);
        }
        assert_eq!(Varna::from_slp1(b'+'), None);
        assert_eq!(ALL.iter().filter(|v| v.is_vowel()).count(), 14);
        assert_eq!(ALL.iter().filter(|v| v.is_consonant()).count(), 33);
    }

    #[test]
    fn pratyaharas_match_the_textbook_lists() {
        for (name, members) in [
            ("ac", "aiufxeoEO"),
            ("hal", "kKgGNcCjJYwWqQRtTdDnpPbBmyrlvSzsh"),
            ("ik", "iufx"),
            ("ak", "aiufx"),
            ("yaR", "yrlv"),
            ("eN", "eo"),
            ("ec", "eoEO"),
            ("Jal", "kKgGcCjJwWqQtTdDpPbBSzsh"),
            ("jaS", "gjqdb"),
            ("Kar", "kKcCwWtTpPSzs"),
            ("haS", "gGNjJYqQRdDnbBmyrlvh"),
            ("Sal", "Szsh"),
            ("yay", "kKgGNcCjJYwWqQRtTdDnpPbBmyrlv"),
            ("aR1", "aiu"),
            ("aR2", "aiufxeoEOyrlvh"),
            ("iR2", "iufxeoEOyrlvh"),
            ("am", "aiufxeoEOYNRnmyrlvh"),
        ] {
            let mut want: Vec<u8> = members.bytes().collect();
            want.sort_by_key(|b| Varna::from_slp1(*b).unwrap());
            assert_eq!(p(name), String::from_utf8(want).unwrap(), "{name}");
        }
        assert_eq!(pratyahara("hal").unwrap().count_ones(), 33);
        assert_eq!(pratyahara("Jal").unwrap().count_ones(), 24);
        assert_eq!(pratyahara("Kar").unwrap().count_ones(), 13);
        assert_eq!(pratyahara("haS").unwrap().count_ones(), 20);
    }

    #[test]
    fn ambiguous_and_malformed_names_are_refused() {
        assert_eq!(pratyahara("aR"), Err(PratyaharaError::WhichR));
        assert_eq!(pratyahara("iR"), Err(PratyaharaError::WhichR));
        assert_eq!(pratyahara("yaR1"), Err(PratyaharaError::NoSuchIt));
        assert_eq!(pratyahara("ax"), Err(PratyaharaError::NoSuchIt));
        assert_eq!(pratyahara("hl"), Err(PratyaharaError::Malformed));
        assert_eq!(pratyahara("ac2"), Err(PratyaharaError::Malformed));
        assert_eq!(pratyahara("Ac"), Err(PratyaharaError::NoSuchLetter));
        assert_eq!(pratyahara(""), Err(PratyaharaError::Malformed));
    }

    #[test]
    fn a_vowel_stands_for_its_savarnas_under_1_1_69() {
        assert_eq!(
            slp1(with_savarnas(pratyahara("ac").unwrap())),
            "aAiIuUfFxXeEoO"
        );
        assert_eq!(slp1(with_savarnas(pratyahara("ik").unwrap())), "iIuUfFxX");
        assert_eq!(slp1(with_savarnas(pratyahara("ak").unwrap())), "aAiIuUfFxX");
        // Consonants are not widened.
        assert_eq!(
            with_savarnas(pratyahara("Jal").unwrap()),
            pratyahara("Jal").unwrap()
        );
    }

    #[test]
    fn places_and_efforts() {
        use sthana::*;
        let v = |b: u8| Varna::from_slp1(b).unwrap();
        assert_eq!(v(b'k').sthana(), KANTHA);
        assert_eq!(v(b'c').sthana(), TALU);
        assert_eq!(v(b'w').sthana(), MURDHA);
        assert_eq!(v(b't').sthana(), DANTA);
        assert_eq!(v(b'p').sthana(), OSHTHA);
        assert_eq!(v(b'e').sthana(), KANTHA | TALU);
        assert_eq!(v(b'o').sthana(), KANTHA | OSHTHA);
        assert_eq!(v(b'v').sthana(), DANTA | OSHTHA);
        assert_eq!(v(b'N').sthana(), KANTHA | NASIKA);
        assert_eq!(v(b'S').prayatna(), Prayatna::IshadVivrta);
        assert_eq!(v(b'y').prayatna(), Prayatna::IshatSprishta);
        assert!(v(b'G').is_ghosha() && v(b'G').is_mahaprana());
        assert!(!v(b'k').is_ghosha() && !v(b'k').is_mahaprana());
        assert_eq!(v(b'a').matra(), Some(Matra::Hrasva));
        assert_eq!(v(b'e').matra(), Some(Matra::Dirgha));
        assert_eq!(v(b'k').matra(), None);
    }

    #[test]
    fn savarna_follows_1_1_9_with_1_1_10_and_the_r_l_varttika() {
        let s = |a: u8, b: u8| savarna(Varna::from_slp1(a).unwrap(), Varna::from_slp1(b).unwrap());
        assert!(s(b'a', b'A') && s(b'i', b'I') && s(b'u', b'U') && s(b'f', b'F'));
        assert!(s(b'f', b'x') && s(b'F', b'X'), "r and l vowels (varttika)");
        assert!(
            s(b'k', b'K') && s(b'k', b'g') && s(b'k', b'N'),
            "nasika is not in the mouth"
        );
        assert!(!s(b'k', b'c'));
        assert!(!s(b'a', b'h'), "1.1.10: a vowel and a consonant never");
        assert!(!s(b'i', b'S') && !s(b'i', b'y'));
        assert!(!s(b'a', b'i') && !s(b'i', b'e'));
        assert!(
            !s(b'e', b'E') && !s(b'o', b'O'),
            "ec: only themselves (flagged)"
        );
        assert!(!s(b'M', b'n') && !s(b'H', b'h'));
    }
}
