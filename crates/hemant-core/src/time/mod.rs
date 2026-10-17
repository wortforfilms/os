/// Hemant Samwat reference epoch, chosen as Makara Sankranti 1979 using the
/// published Kashi calculation: 1979-01-14 13:29 IST (07:59 UTC).
/// The source time is published to minute precision; this does not certify a
/// live clock or a broader calendar-conversion algorithm.
pub const HEMANT_SAMWAT_EPOCH_NANOS: u64 = 285_148_740_000_000_000;

/// Fixed convention used here: one civil-length ahoratra is 30 muhurta,
/// each muhurta is 30 kala, each kala is 30 kastha, and each kastha is
/// 15 nimesha. Textual traditions can define other day lengths or ratios.
pub const NIMESHA_PER_KASTHA: u64 = 15;
pub const KASTHA_PER_KALA: u64 = 30;
pub const KALA_PER_MUHURTA: u64 = 30;
pub const MUHURTA_PER_AHORATRA: u64 = 30;
pub const NIMESHA_PER_AHORATRA: u64 =
    NIMESHA_PER_KASTHA * KASTHA_PER_KALA * KALA_PER_MUHURTA * MUHURTA_PER_AHORATRA;
pub const AHORATRA_NANOS: u64 = 86_400_000_000_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VedanticTimeUnit {
    Nimesha,
    Kastha,
    Kala,
    Muhurta,
    Ahoratra,
}

impl VedanticTimeUnit {
    /// Convert a count to nanoseconds using the fixed 24-hour ahoratra
    /// convention above. Nimesha is fractional in nanoseconds, so that
    /// conversion floors to the nearest whole nanosecond.
    pub fn to_nanoseconds(self, count: u64) -> Option<u64> {
        let numerator_per_unit: u64 = match self {
            // 24h / 405,000 nimesha = 640,000,000 / 3 ns.
            Self::Nimesha => 640_000_000,
            Self::Kastha => 3_200_000_000,
            Self::Kala => 96_000_000_000,
            Self::Muhurta => 2_880_000_000_000,
            Self::Ahoratra => AHORATRA_NANOS,
        };
        let product = u128::from(count).checked_mul(u128::from(numerator_per_unit))?;
        let nanos = if self == Self::Nimesha {
            product / 3
        } else {
            product
        };
        u64::try_from(nanos).ok()
    }
}

/// Position in the chosen day-based Vedantic time convention, relative to
/// the Hemant epoch. `sub_nimesha_nanos` retains elapsed time below one
/// whole nimesha so decomposition does not discard monotonic precision.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VedanticTimePosition {
    pub ahoratra: u64,
    pub muhurta: u8,
    pub kala: u8,
    pub kastha: u8,
    pub nimesha: u8,
    pub sub_nimesha_nanos: u64,
}

impl VedanticTimePosition {
    pub fn from_elapsed_nanos(elapsed_nanos: u64) -> Self {
        let total_nimesha = (u128::from(elapsed_nanos) * u128::from(NIMESHA_PER_AHORATRA))
            / u128::from(AHORATRA_NANOS);
        let elapsed_nimesha = total_nimesha as u64;
        let ahoratra = elapsed_nimesha / NIMESHA_PER_AHORATRA;
        let mut within_day = elapsed_nimesha % NIMESHA_PER_AHORATRA;
        let nimesha = (within_day % NIMESHA_PER_KASTHA) as u8;
        within_day /= NIMESHA_PER_KASTHA;
        let kastha = (within_day % KASTHA_PER_KALA) as u8;
        within_day /= KASTHA_PER_KALA;
        let kala = (within_day % KALA_PER_MUHURTA) as u8;
        within_day /= KALA_PER_MUHURTA;
        let muhurta = (within_day % MUHURTA_PER_AHORATRA) as u8;
        let represented_nanos =
            (total_nimesha * u128::from(AHORATRA_NANOS) / u128::from(NIMESHA_PER_AHORATRA)) as u64;

        Self {
            ahoratra,
            muhurta,
            kala,
            kastha,
            nimesha,
            sub_nimesha_nanos: elapsed_nanos - represented_nanos,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[repr(C, packed)]
pub struct MonotonicTick {
    /// Absolute elapsed nanoseconds since the hardware engine baseline initialization.
    pub elapsed_nanos: u64,
    /// Atomic index counter tracking the total number of system state updates executed.
    pub state_sequence: u64,
}

impl MonotonicTick {
    /// Instantiates a new tick boundary starting straight from zero layout baseline state.
    pub const fn genesis() -> Self {
        Self {
            elapsed_nanos: 0,
            state_sequence: 0,
        }
    }

    /// Instantiates a tick from already validated local counters.
    pub const fn new(elapsed_nanos: u64, state_sequence: u64) -> Self {
        Self {
            elapsed_nanos,
            state_sequence,
        }
    }

    /// Advances the monotonic time tracking word by a fixed duration interval.
    #[inline]
    pub fn advance(&mut self, delta_nanos: u64) {
        self.elapsed_nanos = self.elapsed_nanos.saturating_add(delta_nanos);
        self.state_sequence = self.state_sequence.saturating_add(1);
    }

    /// Computes the exact absolute timestamp equivalent used within file manifests.
    #[inline]
    pub const fn compute_absolute_epoch_nanos(&self) -> u64 {
        HEMANT_SAMWAT_EPOCH_NANOS.saturating_add(self.elapsed_nanos)
    }

    /// Returns elapsed nanoseconds without creating an unaligned reference to the packed field.
    #[inline]
    pub const fn elapsed_nanos(&self) -> u64 {
        self.elapsed_nanos
    }

    /// Returns the state sequence without creating an unaligned reference to the packed field.
    #[inline]
    pub const fn state_sequence(&self) -> u64 {
        self.state_sequence
    }

    /// Expresses elapsed monotonic time from the selected epoch in the
    /// crate's documented Vedantic-unit convention. This is not Panchanga
    /// date calculation and does not read a hardware clock.
    pub fn vedantic_position(&self) -> VedanticTimePosition {
        VedanticTimePosition::from_elapsed_nanos(self.elapsed_nanos)
    }
}
