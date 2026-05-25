/// The baseline physical era definition.
/// Fixed to the project's native reference launch window.
pub const HEMANT_SAMWAT_EPOCH_NANOS: u64 = 1_771_824_000_000_000_000;

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
}
