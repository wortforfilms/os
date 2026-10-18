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
//! * **Core clock, 1 kHz.** `SYST_RVR` is 24 bits: at 168 MHz the longest
//!   period is about 99.9 ms, at 16 MHz about 1.05 s. A 1 ms period gives the
//!   scheduler a usable tick on every supported board.
//! * **Core clock from the board, at start-up.** [`Config::for_core_hz`] takes
//!   the frequency the board module reports (`src/board.rs`): fixed 168 MHz
//!   under QEMU, the RCC result on hardware. Nothing else assumes a frequency.
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
//! * **Decision logic is pure.** [`read`] takes one register sample and the
//!   last reading and decides the result, so the wrap and clamp cases are unit
//!   tested on the host; the hardware module only samples registers.

/// Kernel tick rate.
pub const TICK_HZ: u32 = 1_000;
/// Nanoseconds per tick.
pub const NANOS_PER_TICK: u64 = 1_000_000_000 / TICK_HZ as u64;
/// Label for every reading of this clock.
pub const TIME_BASIS: &str = "kernel-monotonic-since-boot";
/// Largest value the 24-bit SysTick reload register holds.
pub const MAX_RELOAD: u32 = 0x00FF_FFFF;

/// SysTick configuration for one core clock frequency.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Config {
    /// Core clock driving SysTick (`SystClkSource::Core`), in Hz.
    pub core_hz: u32,
    /// Reload value: the counter runs `reload..=0`, i.e. `reload + 1` cycles per tick.
    pub reload: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ConfigError {
    /// The core clock is not a whole number of cycles per tick.
    NotWholeCyclesPerTick,
    /// One tick needs more cycles than the 24-bit reload register holds.
    ReloadTooLarge,
    /// Fewer than two cycles per tick.
    TooSlow,
}

impl Config {
    /// Reload value for a 1 kHz tick at `core_hz`: `core_hz / 1000 - 1`.
    pub const fn for_core_hz(core_hz: u32) -> Result<Self, ConfigError> {
        let cycles = core_hz / TICK_HZ;
        if cycles < 2 {
            return Err(ConfigError::TooSlow);
        }
        if cycles * TICK_HZ != core_hz {
            return Err(ConfigError::NotWholeCyclesPerTick);
        }
        if cycles - 1 > MAX_RELOAD {
            return Err(ConfigError::ReloadTooLarge);
        }
        Ok(Self {
            core_hz,
            reload: cycles - 1,
        })
    }

    /// Elapsed nanoseconds for `ticks` whole ticks plus the current-value
    /// register. The counter counts down from `reload`, so `reload - current`
    /// cycles of the running tick have passed.
    pub const fn elapsed_nanos(&self, ticks: u64, current: u32) -> u64 {
        let current = if current > self.reload {
            self.reload
        } else {
            current
        };
        let cycles_into_tick = (self.reload - current) as u64;
        ticks
            .saturating_mul(NANOS_PER_TICK)
            .saturating_add(cycles_into_tick * 1_000_000_000 / self.core_hz as u64)
    }
}

/// One consistent sample of the clock registers, taken with interrupts masked.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Sample {
    /// Ticks the ISR has counted.
    pub ticks: u64,
    /// `SYST_CVR` read first.
    pub current: u32,
    /// `PENDSTSET` after the first read: the counter wrapped and the ISR has not run.
    pub pending: bool,
    /// `SYST_CVR` read again after seeing `pending` (ignored otherwise).
    pub current_after: u32,
}

/// What [`read`] decided.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Reading {
    pub nanos: u64,
    /// The sample computed to less than `last`, so `last` was returned instead.
    pub regressed: bool,
}

/// Turns one register sample into a reading that never goes backwards.
///
/// A pending wrap means one tick has ended that the ISR has not counted, so it
/// is counted here and the second register read (which belongs to the new
/// tick) is used. Without that, a wrap between the count and the register read
/// would put the reading almost a whole tick in the past.
pub const fn read(config: &Config, sample: Sample, last: u64) -> Reading {
    let (ticks, current) = if sample.pending {
        (sample.ticks.wrapping_add(1), sample.current_after)
    } else {
        (sample.ticks, sample.current)
    };
    let nanos = config.elapsed_nanos(ticks, current);
    if nanos < last {
        Reading {
            nanos: last,
            regressed: true,
        }
    } else {
        Reading {
            nanos,
            regressed: false,
        }
    }
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

/// Hardware side: SysTick setup, ISR and register sampling. Target only.
#[cfg(target_arch = "arm")]
mod hw {
    use super::*;
    use core::cell::Cell;
    use cortex_m::interrupt::{self, Mutex};
    use cortex_m::peripheral::{syst::SystClkSource, SCB, SYST};

    static TICKS: Mutex<Cell<u64>> = Mutex::new(Cell::new(0));
    static LAST: Mutex<Cell<u64>> = Mutex::new(Cell::new(0));
    static REGRESSIONS: Mutex<Cell<u32>> = Mutex::new(Cell::new(0));
    static CONFIG: Mutex<Cell<Option<Config>>> = Mutex::new(Cell::new(None));

    /// Configures and starts SysTick for `config`. Call once at boot.
    pub fn start(syst: &mut SYST, config: Config) {
        syst.disable_interrupt();
        syst.disable_counter();
        syst.set_clock_source(SystClkSource::Core);
        syst.set_reload(config.reload);
        syst.clear_current();
        interrupt::free(|cs| {
            TICKS.borrow(cs).set(0);
            LAST.borrow(cs).set(0);
            CONFIG.borrow(cs).set(Some(config));
        });
        syst.enable_counter();
        syst.enable_interrupt();
    }

    /// The configuration in use, once started.
    pub fn config() -> Option<Config> {
        interrupt::free(|cs| CONFIG.borrow(cs).get())
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
            let Some(config) = CONFIG.borrow(cs).get() else {
                return 0;
            };
            let ticks = TICKS.borrow(cs).get();
            let current = SYST::get_current();
            let pending = SCB::is_pendst_pending();
            let current_after = if pending {
                SYST::get_current()
            } else {
                current
            };
            let last = LAST.borrow(cs);
            let reading = read(
                &config,
                Sample {
                    ticks,
                    current,
                    pending,
                    current_after,
                },
                last.get(),
            );
            if reading.regressed {
                let regressions = REGRESSIONS.borrow(cs);
                regressions.set(regressions.get().saturating_add(1));
            }
            last.set(reading.nanos);
            reading.nanos
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
pub use hw::{config, monotonic_tick, now_nanos, on_systick, regressions, sleep_ms, start, ticks};

#[cfg(test)]
mod tests {
    use super::*;

    const QEMU: Config = match Config::for_core_hz(168_000_000) {
        Ok(config) => config,
        Err(_) => panic!("168 MHz is valid"),
    };

    fn sample(ticks: u64, current: u32) -> Sample {
        Sample {
            ticks,
            current,
            pending: false,
            current_after: current,
        }
    }

    #[test]
    fn reload_math_per_board() {
        assert_eq!(QEMU.reload, 167_999);
        assert_eq!(Config::for_core_hz(100_000_000).unwrap().reload, 99_999);
        // F411 straight out of reset runs on the 16 MHz HSI.
        assert_eq!(Config::for_core_hz(16_000_000).unwrap().reload, 15_999);
        assert_eq!(NANOS_PER_TICK, 1_000_000);
    }

    #[test]
    fn invalid_core_clocks_are_refused() {
        assert_eq!(
            Config::for_core_hz(16_000_500),
            Err(ConfigError::NotWholeCyclesPerTick)
        );
        // At 1 kHz a u32 frequency cannot overflow the 24-bit reload (that
        // needs > 16.7 GHz); the check guards a future change of TICK_HZ.
        assert!(Config::for_core_hz(4_000_000_000).is_ok());
        assert_eq!(Config::for_core_hz(1_000), Err(ConfigError::TooSlow));
    }

    #[test]
    fn elapsed_counts_down_within_a_tick() {
        assert_eq!(QEMU.elapsed_nanos(0, QEMU.reload), 0);
        // Half a tick: 84,000 cycles at 168 MHz = 500 us.
        assert_eq!(QEMU.elapsed_nanos(0, QEMU.reload - 84_000), 500_000);
        assert_eq!(QEMU.elapsed_nanos(3, QEMU.reload), 3_000_000);
        // Last cycle of a tick stays below the next tick boundary.
        assert!(QEMU.elapsed_nanos(0, 0) < QEMU.elapsed_nanos(1, QEMU.reload));
        // The same register value means a different time at another clock.
        let f411 = Config::for_core_hz(100_000_000).unwrap();
        assert_eq!(f411.elapsed_nanos(0, f411.reload - 50_000), 500_000);
    }

    #[test]
    fn elapsed_is_monotonic_across_every_tick_boundary_sample() {
        let mut last = 0;
        for ticks in 0..4 {
            for current in (0..=QEMU.reload).rev().step_by(997) {
                let value = QEMU.elapsed_nanos(ticks, current);
                assert!(value >= last, "{ticks}/{current}");
                last = value;
            }
        }
    }

    #[test]
    fn elapsed_saturates_and_ignores_out_of_range_registers() {
        assert_eq!(QEMU.elapsed_nanos(0, u32::MAX), 0);
        assert_eq!(QEMU.elapsed_nanos(u64::MAX, 0), u64::MAX);
    }

    #[test]
    fn read_plain_sample() {
        let r = read(&QEMU, sample(5, QEMU.reload - 84_000), 0);
        assert_eq!(
            r,
            Reading {
                nanos: 5_500_000,
                regressed: false
            }
        );
    }

    #[test]
    fn read_counts_a_wrap_between_the_count_and_the_register() {
        // The ISR counted 5 ticks. The counter then wrapped (pending) before
        // the first register read saw a value near the top of tick 6.
        let wrapped = Sample {
            ticks: 5,
            current: QEMU.reload - 10,
            pending: true,
            current_after: QEMU.reload - 20,
        };
        let r = read(&QEMU, wrapped, 5_999_000);
        assert!(!r.regressed);
        assert_eq!(r.nanos, QEMU.elapsed_nanos(6, QEMU.reload - 20));
        // Ignoring the pending flag would have read ~1 ms in the past.
        assert!(QEMU.elapsed_nanos(5, QEMU.reload - 10) < 5_999_000);
    }

    #[test]
    fn read_with_the_wrap_landing_between_the_two_register_reads() {
        // First read is the last cycle of tick 5; the wrap happens next, so the
        // second read belongs to tick 6. The second read is the one used.
        let wrapped = Sample {
            ticks: 5,
            current: 0,
            pending: true,
            current_after: QEMU.reload - 3,
        };
        let r = read(&QEMU, wrapped, QEMU.elapsed_nanos(5, 0));
        assert!(!r.regressed);
        assert!(r.nanos > QEMU.elapsed_nanos(5, 0));
    }

    #[test]
    fn read_clamps_and_reports_a_regression() {
        let r = read(&QEMU, sample(1, QEMU.reload), 7_000_000);
        assert_eq!(
            r,
            Reading {
                nanos: 7_000_000,
                regressed: true
            }
        );
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
