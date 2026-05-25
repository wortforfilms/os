use crate::time::MonotonicTick;

/// Bitmask identifiers mapping directly to the 40-byte binary MOSF frame status word.
pub const HSTS_NETWORK_SSL_ENFORCED: u32 = 0x0001_0000;
pub const HSTS_ASTRO_TIME_VERIFIED: u32 = 0x0000_004f;

const FNV1A_OFFSET_BASIS: u32 = 2_166_136_261;
const FNV1A_PRIME: u32 = 16_777_619;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(C, packed)]
pub struct HstsStateWord {
    /// The current calibrated physical time vector.
    pub physical_time: MonotonicTick,
    /// Dual-channel status bitfield matching the Gold Master allocation parameters.
    pub operational_mask: u32,
    /// Cryptographic checksum tracking code generated over the time block parameters.
    pub integrity_hash: u32,
}

impl HstsStateWord {
    /// Generates an armed, certified initial state tracking record.
    pub fn compile_gold_master(current_tick: MonotonicTick) -> Self {
        let mask = HSTS_NETWORK_SSL_ENFORCED | HSTS_ASTRO_TIME_VERIFIED;
        let integrity_hash = compile_integrity_hash(current_tick, mask);

        Self {
            physical_time: current_tick,
            operational_mask: mask,
            integrity_hash,
        }
    }

    /// Evaluates if the current state satisfies the certified temporal channel gate.
    #[inline]
    pub const fn is_scientific_certified(&self) -> bool {
        (self.operational_mask & HSTS_ASTRO_TIME_VERIFIED) == HSTS_ASTRO_TIME_VERIFIED
    }

    /// Evaluates if the secure transport channel bit is present.
    #[inline]
    pub const fn is_network_ssl_enforced(&self) -> bool {
        (self.operational_mask & HSTS_NETWORK_SSL_ENFORCED) == HSTS_NETWORK_SSL_ENFORCED
    }

    /// Confirms the packed state word still matches its zero-allocation integrity hash.
    #[inline]
    pub fn verify_integrity_hash(&self) -> bool {
        self.integrity_hash == compile_integrity_hash(self.physical_time, self.operational_mask)
    }

    /// Returns the calibrated physical time vector without exposing packed-field references.
    #[inline]
    pub const fn physical_time(&self) -> MonotonicTick {
        self.physical_time
    }

    /// Returns the operational mask without creating an unaligned reference.
    #[inline]
    pub const fn operational_mask(&self) -> u32 {
        self.operational_mask
    }

    /// Returns the integrity hash without creating an unaligned reference.
    #[inline]
    pub const fn integrity_hash(&self) -> u32 {
        self.integrity_hash
    }

    /// Updates the mask for local validation drills; callers must rebuild the state to re-sign.
    #[inline]
    pub fn set_operational_mask(&mut self, operational_mask: u32) {
        self.operational_mask = operational_mask;
    }
}

#[inline]
pub fn compile_integrity_hash(current_tick: MonotonicTick, operational_mask: u32) -> u32 {
    let mut hash = FNV1A_OFFSET_BASIS;

    for byte in current_tick.elapsed_nanos().to_le_bytes() {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(FNV1A_PRIME);
    }
    for byte in current_tick.state_sequence().to_le_bytes() {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(FNV1A_PRIME);
    }
    for byte in operational_mask.to_le_bytes() {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(FNV1A_PRIME);
    }

    hash
}
