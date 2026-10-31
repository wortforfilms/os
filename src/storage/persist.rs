//! Persistent key-value storage for the kernel and, through syscalls 15 and
//! 16, for tasks that hold the `store_get` / `store_put` capabilities.
//!
//! The store itself (format, power-loss safety, compaction) is
//! `crates/maataa-store`. This module gives it a backend per board:
//!
//! | Board | Banks | Notes |
//! | --- | --- | --- |
//! | STM32F411 | flash sectors 6 and 7 (`0x0804_0000`, `0x0806_0000`), 128 KiB each | erase and program through the FLASH registers; `memory.x` keeps the kernel below them |
//! | QEMU `netduinoplus2` | two 16 KiB banks in the host file `target/qemu-flash.bin` | through semihosting, because QEMU does not model flash writes; the file persists between runs |
//!
//! Keys 0..16 belong to the kernel (key 0 is the boot count); tasks may use
//! [`FIRST_TASK_KEY`]..64.

pub use maataa_store::{FlashError, MountReport, Stats, StoreError, KEYS, MAX_VALUE};

/// Kernel key: number of boots, u32 little-endian.
pub const KEY_BOOT_COUNT: u8 = 0;
/// Kernel key: the last boot's reset cause and crash (`maataa_link::BootRecord`).
pub const KEY_LAST_RESET: u8 = 1;
/// Lowest key a task may write.
pub const FIRST_TASK_KEY: u8 = 16;

/// Whether a task may write `key`. Kernel keys (0..16) are read-only for
/// tasks.
pub const fn task_key_allowed(key: u32) -> bool {
    key >= FIRST_TASK_KEY as u32 && key < KEYS as u32
}

/// Whether a task may read `key`: any key, kernel keys included.
pub const fn task_key_readable(key: u32) -> bool {
    key < KEYS as u32
}

#[cfg(all(
    target_arch = "arm",
    feature = "board-f411",
    not(feature = "board-qemu-f405")
))]
mod backend {
    //! STM32F411 flash sectors 6 and 7.
    use maataa_store::{Flash, FlashError};

    const FLASH_BASE: u32 = 0x4002_3C00;
    const ACR: *mut u32 = FLASH_BASE as *mut u32;
    const KEYR: *mut u32 = (FLASH_BASE + 0x04) as *mut u32;
    const SR: *mut u32 = (FLASH_BASE + 0x0C) as *mut u32;
    const CR: *mut u32 = (FLASH_BASE + 0x10) as *mut u32;

    const SR_BSY: u32 = 1 << 16;
    /// WRPERR, PGAERR, PGPERR, PGSERR, and RDERR.
    const SR_ERRORS: u32 = 0b1111_0000 | (1 << 8);
    const SR_EOP: u32 = 1;
    const CR_PG: u32 = 1;
    const CR_SER: u32 = 1 << 1;
    const CR_STRT: u32 = 1 << 16;
    const CR_LOCK: u32 = 1 << 31;
    const ACR_DCEN: u32 = 1 << 10;
    const ACR_DCRST: u32 = 1 << 12;

    const BANK_BASES: [u32; 2] = [0x0804_0000, 0x0806_0000];
    const BANK_SECTORS: [u32; 2] = [6, 7];
    pub const BANK_SIZE: u32 = 128 * 1024;

    pub struct Backend;

    impl Backend {
        pub fn open() -> Result<Self, FlashError> {
            Ok(Self)
        }
    }

    fn reg_read(r: *mut u32) -> u32 {
        // SAFETY: fixed FLASH interface register.
        unsafe { r.read_volatile() }
    }

    fn reg_write(r: *mut u32, v: u32) {
        // SAFETY: fixed FLASH interface register; only this module writes it.
        unsafe { r.write_volatile(v) }
    }

    fn wait_idle() -> Result<(), FlashError> {
        // Erase of a 128 KiB sector takes up to about 2 s; the loop count is
        // far above that at 100 MHz.
        for _ in 0..400_000_000u32 {
            if reg_read(SR) & SR_BSY == 0 {
                let errors = reg_read(SR) & SR_ERRORS;
                reg_write(SR, errors | SR_EOP);
                return if errors == 0 {
                    Ok(())
                } else {
                    Err(FlashError::Device(errors))
                };
            }
        }
        Err(FlashError::Device(SR_BSY))
    }

    fn unlock() {
        if reg_read(CR) & CR_LOCK != 0 {
            reg_write(KEYR, 0x4567_0123);
            reg_write(KEYR, 0xCDEF_89AB);
        }
    }

    fn lock_and_flush_data_cache() {
        reg_write(CR, CR_LOCK);
        // Flash contents changed under the data cache: reset it (DCRST may be
        // set only while the cache is off).
        let acr = reg_read(ACR);
        reg_write(ACR, acr & !ACR_DCEN);
        reg_write(ACR, (acr & !ACR_DCEN) | ACR_DCRST);
        reg_write(ACR, acr & !ACR_DCRST);
    }

    impl Flash for Backend {
        fn bank_size(&self) -> u32 {
            BANK_SIZE
        }

        fn read(&mut self, bank: u8, offset: u32, buf: &mut [u8]) -> Result<(), FlashError> {
            let end = offset
                .checked_add(buf.len() as u32)
                .ok_or(FlashError::OutOfRange)?;
            if bank > 1 || end > BANK_SIZE {
                return Err(FlashError::OutOfRange);
            }
            let base = BANK_BASES[bank as usize] + offset;
            for (i, b) in buf.iter_mut().enumerate() {
                // SAFETY: inside one of the two reserved sectors, checked above.
                *b = unsafe { ((base + i as u32) as *const u8).read_volatile() };
            }
            Ok(())
        }

        fn program(&mut self, bank: u8, offset: u32, data: &[u8]) -> Result<(), FlashError> {
            let end = offset
                .checked_add(data.len() as u32)
                .ok_or(FlashError::OutOfRange)?;
            if bank > 1 || end > BANK_SIZE {
                return Err(FlashError::OutOfRange);
            }
            let base = BANK_BASES[bank as usize] + offset;
            wait_idle()?;
            unlock();
            // Byte programming (PSIZE x8) works at any supply voltage.
            reg_write(CR, CR_PG);
            let mut result = Ok(());
            for (i, &b) in data.iter().enumerate() {
                // SAFETY: inside one of the two reserved sectors, checked above.
                unsafe { ((base + i as u32) as *mut u8).write_volatile(b) };
                if let Err(e) = wait_idle() {
                    result = Err(e);
                    break;
                }
            }
            lock_and_flush_data_cache();
            result
        }

        fn erase(&mut self, bank: u8) -> Result<(), FlashError> {
            if bank > 1 {
                return Err(FlashError::OutOfRange);
            }
            wait_idle()?;
            unlock();
            reg_write(CR, CR_SER | (BANK_SECTORS[bank as usize] << 3));
            reg_write(CR, CR_SER | (BANK_SECTORS[bank as usize] << 3) | CR_STRT);
            let result = wait_idle();
            lock_and_flush_data_cache();
            result
        }
    }
}

#[cfg(all(target_arch = "arm", feature = "board-qemu-f405"))]
mod backend {
    //! Two banks in a host file, through semihosting.
    use cortex_m_semihosting::syscall;
    use maataa_store::{Flash, FlashError};

    pub const BANK_SIZE: u32 = 16 * 1024;
    const PATH: &[u8] = b"target/qemu-flash.bin\0";
    const MODE_RW_BINARY: usize = 3; // "r+b"
    const MODE_CREATE_BINARY: usize = 7; // "w+b"

    pub struct Backend {
        handle: usize,
    }

    fn seek(handle: usize, pos: u32) -> Result<(), FlashError> {
        // SAFETY: SYS_SEEK takes a handle and an absolute position.
        let r = unsafe { syscall!(SEEK, handle, pos as usize) };
        if r == 0 {
            Ok(())
        } else {
            Err(FlashError::Device(r as u32))
        }
    }

    fn write_all(handle: usize, data: &[u8]) -> Result<(), FlashError> {
        // SAFETY: SYS_WRITE reads `data` and returns the bytes not written.
        let left = unsafe { syscall!(WRITE, handle, data.as_ptr(), data.len()) };
        if left == 0 {
            Ok(())
        } else {
            Err(FlashError::Device(left as u32))
        }
    }

    impl Backend {
        pub fn open() -> Result<Self, FlashError> {
            // SAFETY: SYS_OPEN reads the NUL-terminated path; the length
            // excludes the NUL.
            let mut handle =
                unsafe { syscall!(OPEN, PATH.as_ptr(), MODE_RW_BINARY, PATH.len() - 1) };
            if handle == usize::MAX {
                // SAFETY: as above, creating the file.
                handle =
                    unsafe { syscall!(OPEN, PATH.as_ptr(), MODE_CREATE_BINARY, PATH.len() - 1) };
            }
            if handle == usize::MAX {
                return Err(FlashError::Device(0xFFFF_FFFF));
            }
            // SAFETY: SYS_FLEN takes the handle.
            let len = unsafe { syscall!(FLEN, handle) };
            let want = 2 * BANK_SIZE as usize;
            if len == usize::MAX || len < want {
                // A new or short file: fill it with erased flash.
                let erased = [0xFFu8; 256];
                seek(handle, len.min(want) as u32)?;
                let mut at = if len == usize::MAX { 0 } else { len };
                while at < want {
                    let n = (want - at).min(erased.len());
                    write_all(handle, &erased[..n])?;
                    at += n;
                }
            }
            Ok(Self { handle })
        }
    }

    impl Flash for Backend {
        fn bank_size(&self) -> u32 {
            BANK_SIZE
        }

        fn read(&mut self, bank: u8, offset: u32, buf: &mut [u8]) -> Result<(), FlashError> {
            if bank > 1 || offset as usize + buf.len() > BANK_SIZE as usize {
                return Err(FlashError::OutOfRange);
            }
            seek(self.handle, bank as u32 * BANK_SIZE + offset)?;
            // SAFETY: SYS_READ writes at most `buf.len()` bytes into `buf`.
            let left = unsafe { syscall!(READ, self.handle, buf.as_mut_ptr(), buf.len()) };
            if left == 0 {
                Ok(())
            } else {
                Err(FlashError::Device(left as u32))
            }
        }

        fn program(&mut self, bank: u8, offset: u32, data: &[u8]) -> Result<(), FlashError> {
            if bank > 1 || offset as usize + data.len() > BANK_SIZE as usize {
                return Err(FlashError::OutOfRange);
            }
            // NOR semantics: programming only clears bits.
            let mut merged = [0u8; 128];
            for (i, chunk) in data.chunks(merged.len()).enumerate() {
                let at = offset + (i * merged.len()) as u32;
                self.read(bank, at, &mut merged[..chunk.len()])?;
                for (m, &d) in merged.iter_mut().zip(chunk) {
                    *m &= d;
                }
                seek(self.handle, bank as u32 * BANK_SIZE + at)?;
                write_all(self.handle, &merged[..chunk.len()])?;
            }
            Ok(())
        }

        fn erase(&mut self, bank: u8) -> Result<(), FlashError> {
            if bank > 1 {
                return Err(FlashError::OutOfRange);
            }
            let erased = [0xFFu8; 256];
            seek(self.handle, bank as u32 * BANK_SIZE)?;
            for _ in 0..BANK_SIZE as usize / erased.len() {
                write_all(self.handle, &erased)?;
            }
            Ok(())
        }
    }
}

#[cfg(target_arch = "arm")]
pub use kernel_side::*;

#[cfg(target_arch = "arm")]
mod kernel_side {
    use super::backend::Backend;
    use super::*;
    use core::cell::RefCell;
    use cortex_m::interrupt::{self, Mutex};
    use maataa_store::Store;

    static STORE: Mutex<RefCell<Option<Store<Backend>>>> = Mutex::new(RefCell::new(None));

    /// Mounts the store (once, at boot) and returns what it found.
    pub fn mount() -> Result<(MountReport, Stats), StoreError> {
        let backend = Backend::open()?;
        let (store, report) = Store::mount(backend)?;
        let stats = store.stats();
        interrupt::free(|cs| *STORE.borrow(cs).borrow_mut() = Some(store));
        Ok((report, stats))
    }

    fn with<R>(
        f: impl FnOnce(&mut Store<Backend>) -> Result<R, StoreError>,
    ) -> Option<Result<R, StoreError>> {
        interrupt::free(|cs| STORE.borrow(cs).borrow_mut().as_mut().map(f))
    }

    /// Reads, increments and stores the boot count; returns the new value.
    pub fn count_boot() -> Result<u32, StoreError> {
        with(|store| {
            let mut buf = [0u8; 4];
            let previous = match store.get(KEY_BOOT_COUNT, &mut buf)? {
                Some(4) => u32::from_le_bytes(buf),
                _ => 0,
            };
            let count = previous.wrapping_add(1);
            store.put(KEY_BOOT_COUNT, &count.to_le_bytes())?;
            Ok(count)
        })
        .unwrap_or(Err(StoreError::Flash(FlashError::Device(0))))
    }

    pub fn get(key: u8, out: &mut [u8]) -> Option<Result<Option<usize>, StoreError>> {
        with(|store| store.get(key, out))
    }

    pub fn put(key: u8, value: &[u8]) -> Option<Result<(), StoreError>> {
        with(|store| store.put(key, value))
    }

    pub fn stats() -> Option<Stats> {
        interrupt::free(|cs| STORE.borrow(cs).borrow().as_ref().map(|s| s.stats()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tasks_may_read_but_not_write_kernel_keys() {
        assert!(task_key_readable(KEY_BOOT_COUNT as u32));
        assert!(task_key_readable(KEY_LAST_RESET as u32));
        assert!(!task_key_readable(64));
    }

    #[test]
    fn tasks_cannot_touch_kernel_keys() {
        assert!(!task_key_allowed(KEY_BOOT_COUNT as u32));
        assert!(!task_key_allowed(15));
        assert!(task_key_allowed(16));
        assert!(task_key_allowed(63));
        assert!(!task_key_allowed(64));
        assert!(!task_key_allowed(u32::MAX));
    }
}
