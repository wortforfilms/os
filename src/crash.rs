//! Reset cause and crash record.
//!
//! When the kernel stops on its own error (panic, kernel stack overflow,
//! kernel memory fault, hard fault) it writes a small record into RAM that
//! the startup code does not clear (`.uninit`). On the F411 the watchdog then
//! resets the board; the next boot reads the record, reads the reset cause
//! from `RCC_CSR`, prints both, and saves them to persistent key 1
//! (`maataa_link::BootRecord`), where the host can read them.
//!
//! A power cut loses the record (RAM is not kept), so only the reset cause
//! survives it.

pub use maataa_link::{BootRecord, CrashKind, ResetCause};

const MAGIC: u32 = 0x4D43_5253; // "MCRS"

/// The RAM record; a checksum guards against stale or random contents.
#[repr(C)]
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct Raw {
    pub magic: u32,
    pub kind: u32,
    pub address: u32,
    pub detail: u32,
    pub uptime_ms: u32,
    pub check: u32,
}

impl Raw {
    pub const fn new(kind: CrashKind, address: u32, detail: u32, uptime_ms: u32) -> Self {
        let kind = kind as u32;
        Self {
            magic: MAGIC,
            kind,
            address,
            detail,
            uptime_ms,
            check: Self::checksum(kind, address, detail, uptime_ms),
        }
    }

    const fn checksum(kind: u32, address: u32, detail: u32, uptime_ms: u32) -> u32 {
        (MAGIC ^ kind ^ address.rotate_left(7) ^ detail.rotate_left(13) ^ uptime_ms.rotate_left(19))
            .wrapping_mul(0x9E37_79B1)
    }

    /// The crash this record describes, if the record is intact.
    pub fn decode(&self) -> Option<(CrashKind, u32, u32, u32)> {
        let valid = self.magic == MAGIC
            && self.check == Self::checksum(self.kind, self.address, self.detail, self.uptime_ms)
            && self.kind <= u8::MAX as u32
            && CrashKind::from_u8(self.kind as u8) != CrashKind::None;
        valid.then(|| {
            (
                CrashKind::from_u8(self.kind as u8),
                self.address,
                self.detail,
                self.uptime_ms,
            )
        })
    }
}

/// Decodes the F411 `RCC_CSR` reset flags. Several flags can be set at once
/// (an external reset also sets PINRSTF); the most specific one wins.
#[cfg_attr(feature = "board-qemu-f405", allow(dead_code))] // F411 only, and the tests
pub const fn cause_from_csr(csr: u32) -> ResetCause {
    const LPWR: u32 = 1 << 31;
    const WWDG: u32 = 1 << 30;
    const IWDG: u32 = 1 << 29;
    const SFT: u32 = 1 << 28;
    const POR: u32 = 1 << 27;
    const PIN: u32 = 1 << 26;
    const BOR: u32 = 1 << 25;
    if csr & IWDG != 0 {
        ResetCause::Watchdog
    } else if csr & WWDG != 0 {
        ResetCause::WindowWatchdog
    } else if csr & SFT != 0 {
        ResetCause::Software
    } else if csr & LPWR != 0 {
        ResetCause::LowPower
    } else if csr & POR != 0 {
        ResetCause::PowerOn
    } else if csr & BOR != 0 {
        ResetCause::Brownout
    } else if csr & PIN != 0 {
        ResetCause::Pin
    } else {
        ResetCause::Unknown
    }
}

#[cfg(target_arch = "arm")]
pub use hw::{record, reset_cause, take};

#[cfg(target_arch = "arm")]
mod hw {
    use super::*;
    use core::mem::MaybeUninit;

    #[link_section = ".uninit.MAATAA_CRASH"]
    static mut RECORD: MaybeUninit<Raw> = MaybeUninit::uninit();

    /// Writes the crash record. Safe to call from a fault handler.
    pub fn record(kind: CrashKind, address: u32, detail: u32) {
        let raw = Raw::new(kind, address, detail, crate::clock::get_ticks() as u32);
        // SAFETY: a plain volatile write to a RAM word block owned by this
        // module; the startup code never initialises it.
        unsafe {
            core::ptr::addr_of_mut!(RECORD)
                .cast::<Raw>()
                .write_volatile(raw)
        };
    }

    /// Reads and clears the record left by the previous run.
    pub fn take() -> Option<(CrashKind, u32, u32, u32)> {
        // SAFETY: any bit pattern is a valid `Raw` (plain u32s); the
        // checksum decides whether it means anything.
        let raw = unsafe { core::ptr::addr_of!(RECORD).cast::<Raw>().read_volatile() };
        // SAFETY: as above, clearing the magic.
        unsafe {
            core::ptr::addr_of_mut!(RECORD)
                .cast::<Raw>()
                .write_volatile(Raw::default())
        };
        raw.decode()
    }

    /// Reads and clears the reset flags (once, at boot).
    #[cfg(all(feature = "board-f411", not(feature = "board-qemu-f405")))]
    pub fn reset_cause() -> ResetCause {
        const RCC_CSR: *mut u32 = 0x4002_3874 as *mut u32;
        const RMVF: u32 = 1 << 24;
        // SAFETY: RCC_CSR is a fixed register; RMVF clears the flags.
        let csr = unsafe { RCC_CSR.read_volatile() };
        unsafe { RCC_CSR.write_volatile(csr | RMVF) };
        cause_from_csr(csr)
    }

    /// QEMU has no RCC model to ask.
    #[cfg(feature = "board-qemu-f405")]
    pub fn reset_cause() -> ResetCause {
        ResetCause::Unknown
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn records_round_trip_and_reject_garbage() {
        let raw = Raw::new(CrashKind::HardFault, 0x0800_1234, 0x8200, 99);
        assert_eq!(
            raw.decode(),
            Some((CrashKind::HardFault, 0x0800_1234, 0x8200, 99))
        );
        assert_eq!(Raw::default().decode(), None);
        let mut bad = raw;
        bad.address ^= 1;
        assert_eq!(bad.decode(), None, "checksum catches a changed field");
        let none = Raw::new(CrashKind::None, 0, 0, 0);
        assert_eq!(none.decode(), None);
    }

    #[test]
    fn reset_flags_pick_the_most_specific_cause() {
        let pin = 1 << 26;
        assert_eq!(cause_from_csr((1 << 29) | pin), ResetCause::Watchdog);
        assert_eq!(cause_from_csr((1 << 28) | pin), ResetCause::Software);
        assert_eq!(
            cause_from_csr((1 << 27) | (1 << 25) | pin),
            ResetCause::PowerOn
        );
        assert_eq!(cause_from_csr(pin), ResetCause::Pin);
        assert_eq!(cause_from_csr(0), ResetCause::Unknown);
    }
}
