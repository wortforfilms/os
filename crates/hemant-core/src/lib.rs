#![no_std]

pub mod hsts;
pub mod time;

#[cfg(test)]
mod tests {
    use super::hsts::{HstsStateWord, HSTS_ASTRO_TIME_VERIFIED, HSTS_NETWORK_SSL_ENFORCED};
    use super::time::{MonotonicTick, HEMANT_SAMWAT_EPOCH_NANOS};

    #[test]
    fn monotonic_progression_limits() {
        let mut tick = MonotonicTick::genesis();
        assert_eq!(tick.elapsed_nanos(), 0);
        assert_eq!(tick.state_sequence(), 0);

        tick.advance(1_000_000);
        assert_eq!(tick.elapsed_nanos(), 1_000_000);
        assert_eq!(tick.state_sequence(), 1);
        assert_eq!(
            tick.compute_absolute_epoch_nanos(),
            HEMANT_SAMWAT_EPOCH_NANOS + 1_000_000
        );
    }

    #[test]
    fn monotonic_progression_saturates_without_wrapping() {
        let mut tick = MonotonicTick::new(u64::MAX - 5, u64::MAX - 1);
        tick.advance(10);

        assert_eq!(tick.elapsed_nanos(), u64::MAX);
        assert_eq!(tick.state_sequence(), u64::MAX);
        assert_eq!(tick.compute_absolute_epoch_nanos(), u64::MAX);
    }

    #[test]
    fn hsts_verification_gate() {
        let mut tick = MonotonicTick::genesis();
        tick.advance(5_000_000);

        let state = HstsStateWord::compile_gold_master(tick);
        assert!(state.is_scientific_certified());
        assert!(state.is_network_ssl_enforced());
        assert_eq!(
            state.operational_mask(),
            HSTS_NETWORK_SSL_ENFORCED | HSTS_ASTRO_TIME_VERIFIED
        );
        assert!(state.verify_integrity_hash());
    }

    #[test]
    fn hsts_rejects_mask_drift() {
        let tick = MonotonicTick::new(5_000_000, 7);
        let mut state = HstsStateWord::compile_gold_master(tick);
        state.set_operational_mask(HSTS_NETWORK_SSL_ENFORCED);

        assert!(!state.is_scientific_certified());
        assert!(!state.verify_integrity_hash());
    }
}
