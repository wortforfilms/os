//! Hardware watchdog (STM32F411 IWDG).
//!
//! The independent watchdog runs from the ~32 kHz LSI oscillator and resets
//! the chip unless it is fed in time. The kernel feeds it from the scheduler
//! tick (`sched::on_systick`), so it fires when interrupts stay off or the
//! kernel is stuck in a fault handler: exactly the cases that no task can
//! recover from. A task spinning in a loop does not trip it; preemption
//! already handles that.
//!
//! Timeout: 2000 counts at LSI/128 = 8 s nominal. The LSI is only accurate to
//! about ±50 %, so the real timeout lies between about 5.4 and 11.8 s. That
//! is longer than a worst-case flash sector erase (4 s), during which the CPU
//! stalls and cannot feed it. The watchdog is frozen while a debug probe
//! halts the core.
//!
//! QEMU's `netduinoplus2` has no IWDG model; there the watchdog is absent.

/// Nominal timeout.
pub const TIMEOUT_MS: u32 = 8_000;
/// LSI divider and reload: 32 kHz / 128 = 250 Hz, 2000 counts = 8 s.
#[allow(dead_code)] // used by the F411 build and the tests
pub const PRESCALER_DIV128: u32 = 5;
#[allow(dead_code)]
pub const RELOAD: u32 = 2_000 - 1;

/// Whether this board has a watchdog the kernel drives.
pub const AVAILABLE: bool = cfg!(all(feature = "hw-f4", not(feature = "board-qemu-f405")));

#[cfg(all(
    target_arch = "arm",
    feature = "hw-f4",
    not(feature = "board-qemu-f405")
))]
mod hw {
    use super::*;

    const KR: *mut u32 = 0x4000_3000 as *mut u32;
    const PR: *mut u32 = 0x4000_3004 as *mut u32;
    const RLR: *mut u32 = 0x4000_3008 as *mut u32;
    const SR: *mut u32 = 0x4000_300C as *mut u32;
    const DBGMCU_APB1_FZ: *mut u32 = 0xE004_2008 as *mut u32;
    const DBG_IWDG_STOP: u32 = 1 << 12;

    /// Starts the watchdog. It cannot be stopped again until reset.
    pub fn start() {
        // SAFETY: fixed IWDG and DBGMCU registers, written once at boot.
        unsafe {
            DBGMCU_APB1_FZ.write_volatile(DBGMCU_APB1_FZ.read_volatile() | DBG_IWDG_STOP);
            KR.write_volatile(0xCCCC); // start (also starts the LSI)
            KR.write_volatile(0x5555); // unlock PR and RLR
            PR.write_volatile(PRESCALER_DIV128);
            RLR.write_volatile(RELOAD);
            // Wait until the new values reach the LSI domain (a few LSI
            // cycles); bounded so a dead LSI cannot hang boot.
            for _ in 0..1_000_000 {
                if SR.read_volatile() & 0b11 == 0 {
                    break;
                }
            }
            KR.write_volatile(0xAAAA); // reload
        }
    }

    /// Restarts the countdown.
    #[inline(always)]
    pub fn feed() {
        // SAFETY: writing the reload key has no other effect.
        unsafe { KR.write_volatile(0xAAAA) };
    }
}

#[cfg(all(
    target_arch = "arm",
    feature = "hw-f4",
    not(feature = "board-qemu-f405")
))]
pub use hw::{feed, start};

#[cfg(not(all(
    target_arch = "arm",
    feature = "hw-f4",
    not(feature = "board-qemu-f405")
)))]
pub fn start() {}

#[cfg(not(all(
    target_arch = "arm",
    feature = "hw-f4",
    not(feature = "board-qemu-f405")
)))]
#[inline(always)]
pub fn feed() {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timeout_matches_prescaler_and_reload() {
        let lsi_hz = 32_000;
        let tick_hz = lsi_hz / (4 << PRESCALER_DIV128);
        assert_eq!(tick_hz, 250);
        assert_eq!((RELOAD + 1) * 1000 / tick_hz, TIMEOUT_MS);
        assert!(RELOAD < 4096, "IWDG reload is 12 bits");
    }
}
