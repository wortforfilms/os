//! Kernel monotonic clock: SysTick at 1 kHz, read with sub-tick precision.
//!
//! # What this clock is, and is not
//!
//! It is **monotonic since boot**. It starts at zero at every reset, never runs
//! backwards, and is precise to one core cycle. It is **not trusted**: it is
//! derived from the core oscillator, which nothing here calibrates, so its rate
//! may drift, and it knows nothing about wall time. A wall-clock or Hemant
//! reading needs an anchor (see [`HostAnchor`]) and stays labelled unverified
//! until a drift reference exists.
//!
//! # Why this shape
//!
//! * **Core clock, 1 kHz.** `SYST_RVR` is 24 bits, so at 168 MHz the longest
//!   period is about 99.9 ms. A 1 ms period gives the scheduler a usable tick
//!   and leaves 99x headroom below the register limit.
//! * **u64 in a critical section, not `AtomicU64`.** ARMv7-M and ARMv7E-M have
//!   no 64-bit atomic load or store, so `core::sync::atomic::AtomicU64` does
//!   not exist on `thumbv7m-none-eabi` or `thumbv7em-none-eabihf`. The ISR is
//!   the only writer; readers mask interrupts for a few cycles to read the
//!   count and the current-value register as one consistent pair.
//! * **Missed wrap.** If a reader runs after the counter wrapped but before the
//!   ISR ran (interrupts masked by the caller, or a higher-priority handler),
//!   `PENDSTSET` is set. The reader then counts that pending tick itself. One
//!   pending wrap is recovered; a second wrap while still masked is lost, so
//!   critical sections must stay well under one tick (1 ms).
//! * **Never backwards.** Readings are clamped to the last value returned. A
//!   clamp should not happen; [`regressions`] counts them so a test can prove it.
//!
//! # Frequency assumption
//!
//! [`CORE_CLOCK_HZ`] is the STM32F405 system clock that QEMU's `netduinoplus2`
//! machine models (168 MHz). On real hardware it is whatever the clock tree is
//! configured to; change it there and nowhere else. QEMU does not model cycles
//! exactly: compare rates by range, never by exact count.

/// Core clock that drives SysTick (`SystClkSource::Core`). Board assumption.
pub const CORE_CLOCK_HZ: u32 = 168_000_000;
/// Kernel tick rate.
pub const TICK_HZ: u32 = 1_000;
/// Core cycles per tick.
pub const CYCLES_PER_TICK: u32 = CORE_CLOCK_HZ / TICK_HZ;
/// SysTick reload value: the counter runs RELOAD..=0, which is RELOAD + 1 cycles.
pub const RELOAD: u32 = CYCLES_PER_TICK - 1;
/// Nanoseconds per tick.
pub const NANOS_PER_TICK: u64 = 1_000_000_000 / TICK_HZ as u64;
/// Label for every reading of this clock.
pub const TIME_BASIS: &str = "kernel-monotonic-since-boot";

const _: () = assert!(RELOAD <= 0x00FF_FFFF, "SysTick reload is a 24-bit register");
const _: () = assert!(
    CORE_CLOCK_HZ / TICK_HZ * TICK_HZ == CORE_CLOCK_HZ,
    "tick must be a whole number of cycles"
);

/// Elapsed nanoseconds for `ticks` whole ticks plus the current-value register.
/// The counter counts down from `RELOAD`, so `RELOAD - current` cycles of the
/// running tick have passed. Pure arithmetic, tested on the host.
pub const fn elapsed_nanos(ticks: u64, current: u32) -> u64 {
    let current = if current > RELOAD { RELOAD } else { current };
    let cycles_into_tick = (RELOAD - current) as u64;
    ticks
        .saturating_mul(NANOS_PER_TICK)
        .saturating_add(cycles_into_tick * 1_000_000_000 / CORE_CLOCK_HZ as u64)
}

/// Host time read once at boot, used to place the monotonic clock on the
/// Hemant time line. The host clock is unverified, so every value derived from
/// it carries [`HostAnchor::BASIS`].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct HostAnchor {
    /// Host Unix time at the anchor, in seconds.
    pub unix_seconds: u64,
    /// Kernel monotonic nanoseconds at the moment the anchor was read.
    pub uptime_nanos: u64,
}

impl HostAnchor {
    pub const BASIS: &'static str = "host-unix-clock-unverified";

    /// Nanoseconds since the Hemant epoch at kernel uptime `uptime_nanos`:
    /// `anchor - epoch + (uptime - uptime_at_anchor)`. `None` if the host
    /// clock reads before the epoch or the reading predates the anchor.
    pub fn hemant_elapsed_nanos(&self, uptime_nanos: u64) -> Option<u64> {
        let anchor = self.unix_seconds.checked_mul(1_000_000_000)?;
        let since_epoch = anchor.checked_sub(hemant_core::time::HEMANT_SAMWAT_EPOCH_NANOS)?;
        let since_anchor = uptime_nanos.checked_sub(self.uptime_nanos)?;
        since_epoch.checked_add(since_anchor)
    }
}

/// Hardware side: SysTick setup, ISR and reads. Target only.
#[cfg(target_arch = "arm")]
mod hw {
    use super::*;
    use core::cell::Cell;
    use cortex_m::interrupt::{self, Mutex};
    use cortex_m::peripheral::{syst::SystClkSource, SCB, SYST};

    static TICKS: Mutex<Cell<u64>> = Mutex::new(Cell::new(0));
    static LAST: Mutex<Cell<u64>> = Mutex::new(Cell::new(0));
    static REGRESSIONS: Mutex<Cell<u32>> = Mutex::new(Cell::new(0));
    static STARTED: Mutex<Cell<bool>> = Mutex::new(Cell::new(false));

    /// Configures and starts SysTick. Call once, before interrupts matter.
    pub fn start(syst: &mut SYST) {
        syst.disable_interrupt();
        syst.disable_counter();
        syst.set_clock_source(SystClkSource::Core);
        syst.set_reload(RELOAD);
        syst.clear_current();
        interrupt::free(|cs| {
            TICKS.borrow(cs).set(0);
            LAST.borrow(cs).set(0);
            STARTED.borrow(cs).set(true);
        });
        syst.enable_counter();
        syst.enable_interrupt();
    }

    /// The SysTick exception body. The binary's `#[exception] fn SysTick`
    /// calls this; keeping the attribute in the binary guarantees the vector
    /// table links this handler rather than the default one.
    #[inline]
    pub fn on_systick() {
        interrupt::free(|cs| {
            let ticks = TICKS.borrow(cs);
            ticks.set(ticks.get().wrapping_add(1));
        });
    }

    /// Whole ticks the ISR has counted (no sub-tick part, no pending wrap).
    pub fn ticks() -> u64 {
        interrupt::free(|cs| TICKS.borrow(cs).get())
    }

    /// Nanoseconds since [`start`], cycle-precise, never decreasing.
    pub fn now_nanos() -> u64 {
        interrupt::free(|cs| {
            if !STARTED.borrow(cs).get() {
                return 0;
            }
            let mut ticks = TICKS.borrow(cs).get();
            let mut current = SYST::get_current();
            // A wrap the ISR has not handled yet: count it here, and re-read
            // the counter so it belongs to the new tick.
            if SCB::is_pendst_pending() {
                ticks = ticks.wrapping_add(1);
                current = SYST::get_current();
            }
            let reading = elapsed_nanos(ticks, current);
            let last = LAST.borrow(cs);
            if reading < last.get() {
                let regressions = REGRESSIONS.borrow(cs);
                regressions.set(regressions.get().saturating_add(1));
                return last.get();
            }
            last.set(reading);
            reading
        })
    }

    /// Times a reading had to be clamped to stay monotonic. Expected: 0.
    pub fn regressions() -> u32 {
        interrupt::free(|cs| REGRESSIONS.borrow(cs).get())
    }

    /// The kernel time as a `hemant_core::time::MonotonicTick`: elapsed
    /// nanoseconds since boot, and the tick count as the state sequence.
    pub fn monotonic_tick() -> hemant_core::time::MonotonicTick {
        let nanos = now_nanos();
        hemant_core::time::MonotonicTick::new(nanos, ticks())
    }

    /// Sleeps at least `millis` milliseconds, waking on interrupts.
    pub fn sleep_ms(millis: u64) {
        let until = now_nanos().saturating_add(millis.saturating_mul(1_000_000));
        while now_nanos() < until {
            cortex_m::asm::wfi();
        }
    }
}

// Each binary compiles its own copy of this module and uses a subset.
#[cfg(target_arch = "arm")]
#[allow(unused_imports)]
pub use hw::{monotonic_tick, now_nanos, on_systick, regressions, sleep_ms, start, ticks};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reload_math_for_168_mhz_at_1_khz() {
        assert_eq!(CYCLES_PER_TICK, 168_000);
        assert_eq!(RELOAD, 167_999);
        assert_eq!(NANOS_PER_TICK, 1_000_000);
    }

    #[test]
    fn elapsed_counts_down_within_a_tick() {
        assert_eq!(elapsed_nanos(0, RELOAD), 0);
        // Half a tick: 84,000 cycles at 168 MHz = 500 us.
        assert_eq!(elapsed_nanos(0, RELOAD - 84_000), 500_000);
        assert_eq!(elapsed_nanos(3, RELOAD), 3_000_000);
        // Last cycle of a tick stays below the next tick boundary.
        assert!(elapsed_nanos(0, 0) < elapsed_nanos(1, RELOAD));
    }

    #[test]
    fn elapsed_is_monotonic_across_every_tick_boundary_sample() {
        let mut last = 0;
        for ticks in 0..4 {
            for current in (0..=RELOAD).rev().step_by(997) {
                let value = elapsed_nanos(ticks, current);
                assert!(value >= last, "{ticks}/{current}");
                last = value;
            }
        }
    }

    #[test]
    fn elapsed_saturates_and_ignores_out_of_range_registers() {
        assert_eq!(elapsed_nanos(0, u32::MAX), 0);
        assert_eq!(elapsed_nanos(u64::MAX, 0), u64::MAX);
    }

    #[test]
    fn hemant_time_needs_an_anchor_not_just_uptime() {
        // 2026-10-18 00:00:00 UTC, read 2 ms after boot.
        let anchor = HostAnchor {
            unix_seconds: 1_792_281_600,
            uptime_nanos: 2_000_000,
        };
        let at_anchor = anchor.hemant_elapsed_nanos(2_000_000).unwrap();
        assert_eq!(
            at_anchor,
            1_792_281_600_000_000_000 - hemant_core::time::HEMANT_SAMWAT_EPOCH_NANOS
        );
        assert_eq!(
            anchor.hemant_elapsed_nanos(1_002_000_000),
            Some(at_anchor + 1_000_000_000)
        );
        // Uptime alone is not Hemant time: a reading before the anchor is refused.
        assert_eq!(anchor.hemant_elapsed_nanos(1_000_000), None);
        // A host clock before 1979 is refused, not wrapped.
        let early = HostAnchor {
            unix_seconds: 1,
            uptime_nanos: 0,
        };
        assert_eq!(early.hemant_elapsed_nanos(0), None);
    }
}
