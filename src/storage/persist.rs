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

include!(concat!(env!("OUT_DIR"), "/store_key.rs"));

/// The chip's 96-bit unique id, which binds the store key to this device.
#[cfg(all(
    target_arch = "arm",
    feature = "board-f411",
    not(feature = "board-qemu-f405")
))]
pub fn device_id() -> [u8; 12] {
    const UID: *const u8 = 0x1FFF_7A10 as *const u8;
    let mut id = [0u8; 12];
    for (i, byte) in id.iter_mut().enumerate() {
        // SAFETY: the factory-programmed unique id, read-only system memory.
        *byte = unsafe { UID.add(i).read_volatile() };
    }
    id
}

/// QEMU does not model the unique id; every QEMU "device" is the same one.
#[cfg(any(not(target_arch = "arm"), feature = "board-qemu-f405"))]
pub fn device_id() -> [u8; 12] {
    *b"qemu-netduin"
}

/// The key this device's store is sealed with: the build's master key bound
/// to the chip's unique id.
pub fn device_store_key() -> maataa_store::StoreKey {
    maataa_store::derive_device_key(&STORE_MASTER_KEY, &device_id())
}

/// Kernel key: number of boots, u32 little-endian.
pub const KEY_BOOT_COUNT: u8 = 0;
/// Kernel key: the last boot's reset cause and crash (`maataa_link::BootRecord`).
pub const KEY_LAST_RESET: u8 = 1;
/// Kernel key: the version floors of run-time capsules
/// (`crate::installed::VersionFloors`).
pub const KEY_CAPSULE_FLOORS: u8 = 2;
/// Kernel key: starvation episodes since boot, u32 little-endian. Served
/// from RAM by the store-get call (src/syscall.rs); never stored.
pub const KEY_STARVATION_COUNT: u8 = 3;
/// Lowest key a task may write.
pub const FIRST_TASK_KEY: u8 = 16;

/// Whether a task may write `key` at all. Kernel keys (0..16) are
/// read-only for tasks; which task key a task may write is decided by its
/// [`Owner`] ([`owner_may_write`]).
pub const fn task_key_allowed(key: u32) -> bool {
    key >= FIRST_TASK_KEY as u32 && key < KEYS as u32
}

/// Whose task keys a task writes (docs/SECURITY_DESIGN.md, Part B). Set by
/// the kernel when it creates the task: the host channel, or a capsule by
/// its signed name. Every task may still read every key.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Owner {
    /// Writes no key: the demo tasks, and a capsule with no range yet.
    None = 0,
    /// The host channel (task 6).
    Host = 1,
    /// The `telemetry` capsule.
    Telemetry = 2,
    /// The `panini` capsule.
    Panini = 3,
}

impl Owner {
    /// The owner for a capsule's signed name. A capsule the table does not
    /// name writes no key until it is given a range here.
    pub fn for_capsule(name: &str) -> Self {
        match name {
            "telemetry" => Self::Telemetry,
            "panini" => Self::Panini,
            _ => Self::None,
        }
    }

    /// The owner stored in a task (`sched::Task::store_owner`).
    pub const fn from_u8(value: u8) -> Self {
        match value {
            1 => Self::Host,
            2 => Self::Telemetry,
            3 => Self::Panini,
            _ => Self::None,
        }
    }
}

/// Panini's request key, written by the host and deleted by panini.
pub const KEY_PANINI_REQUEST: u8 = 40;
/// Panini's answer key, written by panini and cleared by the host.
pub const KEY_PANINI_ANSWER: u8 = 41;

/// Whether `owner` may write `key`:
///
/// | Keys | Writers |
/// | --- | --- |
/// | 16–31, 63 | host channel (scratch: selftest 20, tests 30, `store-stress` 63) |
/// | 32–35 | `telemetry` |
/// | 40, 41 | `panini` and the host channel (the sandhi wire format) |
/// | 42–47 | `panini` |
/// | 36–39, 48–62 | nobody yet |
pub const fn owner_may_write(owner: Owner, key: u32) -> bool {
    if !task_key_allowed(key) {
        return false;
    }
    let shared = key == KEY_PANINI_REQUEST as u32 || key == KEY_PANINI_ANSWER as u32;
    match owner {
        Owner::None => false,
        Owner::Host => (key >= 16 && key <= 31) || key == 63 || shared,
        Owner::Telemetry => key >= 32 && key <= 35,
        Owner::Panini => key >= 40 && key <= 47,
    }
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
pub(crate) mod backend {
    //! STM32F411 flash: sectors 6 and 7 for the store, sector 5 for the
    //! run-time capsule area.
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

    pub const BANK_SIZE: u32 = 128 * 1024;

    /// Erase units given as (base address, sector number).
    pub struct Backend {
        banks: &'static [(u32, u32)],
    }

    impl Backend {
        /// The persistent store: sectors 6 and 7.
        pub fn open() -> Result<Self, FlashError> {
            Ok(Self {
                banks: &[(0x0804_0000, 6), (0x0806_0000, 7)],
            })
        }

        /// The run-time capsule area: sector 5 (memory.x keeps the kernel
        /// below it).
        pub fn open_capsule_area() -> Result<Self, FlashError> {
            Ok(Self {
                banks: &[(0x0802_0000, 5)],
            })
        }

        fn bank(&self, bank: u8) -> Result<(u32, u32), FlashError> {
            self.banks
                .get(bank as usize)
                .copied()
                .ok_or(FlashError::OutOfRange)
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

    /// Programs one byte anywhere the FLASH interface writes: used for the
    /// OTP rollback counter (`otp` below). The caller checks the address.
    #[cfg(feature = "otp-rollback")]
    pub fn program_byte(address: u32, value: u8) -> Result<(), FlashError> {
        wait_idle()?;
        unlock();
        reg_write(CR, CR_PG);
        // SAFETY: the caller passes an address in the OTP counter range.
        unsafe { (address as *mut u8).write_volatile(value) };
        let result = wait_idle();
        lock_and_flush_data_cache();
        result
    }

    impl Flash for Backend {
        fn bank_size(&self) -> u32 {
            BANK_SIZE
        }

        fn read(&mut self, bank: u8, offset: u32, buf: &mut [u8]) -> Result<(), FlashError> {
            let end = offset
                .checked_add(buf.len() as u32)
                .ok_or(FlashError::OutOfRange)?;
            let (bank_base, _) = self.bank(bank)?;
            if end > BANK_SIZE {
                return Err(FlashError::OutOfRange);
            }
            let base = bank_base + offset;
            for (i, b) in buf.iter_mut().enumerate() {
                // SAFETY: inside one of this backend's reserved sectors,
                // checked above.
                *b = unsafe { ((base + i as u32) as *const u8).read_volatile() };
            }
            Ok(())
        }

        fn program(&mut self, bank: u8, offset: u32, data: &[u8]) -> Result<(), FlashError> {
            let end = offset
                .checked_add(data.len() as u32)
                .ok_or(FlashError::OutOfRange)?;
            let (bank_base, _) = self.bank(bank)?;
            if end > BANK_SIZE {
                return Err(FlashError::OutOfRange);
            }
            let base = bank_base + offset;
            wait_idle()?;
            unlock();
            // Byte programming (PSIZE x8) works at any supply voltage.
            reg_write(CR, CR_PG);
            let mut result = Ok(());
            for (i, &b) in data.iter().enumerate() {
                // SAFETY: inside one of this backend's reserved sectors,
                // checked above.
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
            let (_, sector) = self.bank(bank)?;
            wait_idle()?;
            unlock();
            reg_write(CR, CR_SER | (sector << 3));
            reg_write(CR, CR_SER | (sector << 3) | CR_STRT);
            let result = wait_idle();
            lock_and_flush_data_cache();
            result
        }
    }
}

#[cfg(all(target_arch = "arm", feature = "board-qemu-f405"))]
pub(crate) mod backend {
    //! Banks in a host file, through semihosting: two for the store
    //! (`target/qemu-flash.bin`), one for the run-time capsule area
    //! (`target/qemu-capsule.bin`).
    use cortex_m_semihosting::syscall;
    use maataa_store::{Flash, FlashError};

    pub const BANK_SIZE: u32 = 16 * 1024;
    const MODE_RW_BINARY: usize = 3; // "r+b"
    const MODE_CREATE_BINARY: usize = 7; // "w+b"

    pub struct Backend {
        handle: usize,
        banks: u32,
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
        /// The persistent store.
        pub fn open() -> Result<Self, FlashError> {
            Self::open_file(b"target/qemu-flash.bin\0", 2)
        }

        /// The run-time capsule area.
        pub fn open_capsule_area() -> Result<Self, FlashError> {
            Self::open_file(b"target/qemu-capsule.bin\0", 1)
        }

        fn open_file(path: &[u8], banks: u32) -> Result<Self, FlashError> {
            // SAFETY: SYS_OPEN reads the NUL-terminated path; the length
            // excludes the NUL.
            let mut handle =
                unsafe { syscall!(OPEN, path.as_ptr(), MODE_RW_BINARY, path.len() - 1) };
            if handle == usize::MAX {
                // SAFETY: as above, creating the file.
                handle =
                    unsafe { syscall!(OPEN, path.as_ptr(), MODE_CREATE_BINARY, path.len() - 1) };
            }
            if handle == usize::MAX {
                return Err(FlashError::Device(0xFFFF_FFFF));
            }
            // SAFETY: SYS_FLEN takes the handle.
            let len = unsafe { syscall!(FLEN, handle) };
            let want = (banks * BANK_SIZE) as usize;
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
            Ok(Self { handle, banks })
        }
    }

    impl Flash for Backend {
        fn bank_size(&self) -> u32 {
            BANK_SIZE
        }

        fn read(&mut self, bank: u8, offset: u32, buf: &mut [u8]) -> Result<(), FlashError> {
            if bank as u32 >= self.banks || offset as usize + buf.len() > BANK_SIZE as usize {
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
            if bank as u32 >= self.banks || offset as usize + data.len() > BANK_SIZE as usize {
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
            if bank as u32 >= self.banks {
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

/// The one-time-programmable bytes behind the rollback counter.
#[cfg(all(target_arch = "arm", feature = "otp-rollback"))]
pub(crate) mod otp {
    use maataa_store::rollback::OneTimeBytes;
    use maataa_store::FlashError;

    /// Bytes the counter uses: 256, so the store can compact 256 times.
    pub const BYTES: usize = 256;

    #[cfg(all(feature = "board-f411", not(feature = "board-qemu-f405")))]
    pub struct Otp;

    /// OTP blocks 8 to 15 (blocks 0 to 7 and the lock bytes at 0x1FFF7A00
    /// are never touched).
    #[cfg(all(feature = "board-f411", not(feature = "board-qemu-f405")))]
    const BASE: u32 = 0x1FFF_7900;

    #[cfg(all(feature = "board-f411", not(feature = "board-qemu-f405")))]
    impl Otp {
        pub fn open() -> Result<Self, FlashError> {
            Ok(Self)
        }
    }

    #[cfg(all(feature = "board-f411", not(feature = "board-qemu-f405")))]
    impl OneTimeBytes for Otp {
        fn len(&self) -> usize {
            BYTES
        }
        fn read(&mut self, offset: usize) -> Result<u8, FlashError> {
            if offset >= BYTES {
                return Err(FlashError::OutOfRange);
            }
            // SAFETY: inside the counter's OTP range, checked above.
            Ok(unsafe { ((BASE + offset as u32) as *const u8).read_volatile() })
        }
        fn program(&mut self, offset: usize, value: u8) -> Result<(), FlashError> {
            if offset >= BYTES {
                return Err(FlashError::OutOfRange);
            }
            super::backend::program_byte(BASE + offset as u32, value)
        }
    }

    /// QEMU: a 256-byte host file whose bytes can each be written once.
    #[cfg(feature = "board-qemu-f405")]
    pub struct Otp {
        handle: usize,
    }

    #[cfg(feature = "board-qemu-f405")]
    impl Otp {
        pub fn open() -> Result<Self, FlashError> {
            use cortex_m_semihosting::syscall;
            const PATH: &[u8] = b"target/qemu-otp.bin\0";
            // SAFETY: SYS_OPEN reads the NUL-terminated path.
            let mut handle = unsafe { syscall!(OPEN, PATH.as_ptr(), 3usize, PATH.len() - 1) };
            if handle == usize::MAX {
                // SAFETY: as above, creating the file.
                handle = unsafe { syscall!(OPEN, PATH.as_ptr(), 7usize, PATH.len() - 1) };
            }
            if handle == usize::MAX {
                return Err(FlashError::Device(0xFFFF_FFFF));
            }
            // SAFETY: SYS_FLEN takes the handle.
            let len = unsafe { syscall!(FLEN, handle) };
            if len != BYTES {
                let erased = [0xFFu8; BYTES];
                // SAFETY: SYS_SEEK / SYS_WRITE with a handle and our buffer.
                unsafe {
                    syscall!(SEEK, handle, 0usize);
                    syscall!(WRITE, handle, erased.as_ptr(), erased.len());
                }
            }
            Ok(Self { handle })
        }
    }

    #[cfg(feature = "board-qemu-f405")]
    impl OneTimeBytes for Otp {
        fn len(&self) -> usize {
            BYTES
        }
        fn read(&mut self, offset: usize) -> Result<u8, FlashError> {
            use cortex_m_semihosting::syscall;
            if offset >= BYTES {
                return Err(FlashError::OutOfRange);
            }
            let mut byte = [0u8; 1];
            // SAFETY: SYS_SEEK / SYS_READ into a one-byte buffer.
            let left = unsafe {
                syscall!(SEEK, self.handle, offset);
                syscall!(READ, self.handle, byte.as_mut_ptr(), 1usize)
            };
            if left == 0 {
                Ok(byte[0])
            } else {
                Err(FlashError::Device(left as u32))
            }
        }
        fn program(&mut self, offset: usize, value: u8) -> Result<(), FlashError> {
            use cortex_m_semihosting::syscall;
            if self.read(offset)? != 0xFF {
                // One time only, as on the chip.
                return Err(FlashError::Device(0x0700));
            }
            let byte = [value];
            // SAFETY: SYS_SEEK / SYS_WRITE from a one-byte buffer.
            let left = unsafe {
                syscall!(SEEK, self.handle, offset);
                syscall!(WRITE, self.handle, byte.as_ptr(), 1usize)
            };
            if left == 0 {
                Ok(())
            } else {
                Err(FlashError::Device(left as u32))
            }
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
    use maataa_store::rollback::RollbackCounter;
    use maataa_store::Store;

    #[cfg(feature = "otp-rollback")]
    type Counter = maataa_store::rollback::OtpCounter<super::otp::Otp>;
    #[cfg(not(feature = "otp-rollback"))]
    type Counter = maataa_store::NoCounter;

    static STORE: Mutex<RefCell<Option<Store<Backend, Counter>>>> = Mutex::new(RefCell::new(None));

    #[cfg(feature = "otp-rollback")]
    fn counter() -> Result<Counter, StoreError> {
        Ok(maataa_store::rollback::OtpCounter::new(
            super::otp::Otp::open()?,
        ))
    }

    #[cfg(not(feature = "otp-rollback"))]
    fn counter() -> Result<Counter, StoreError> {
        Ok(maataa_store::NoCounter)
    }

    /// The rollback counter's value and capacity, if this build has one.
    pub fn rollback_counter() -> Option<(u32, u32)> {
        if !cfg!(feature = "otp-rollback") {
            return None;
        }
        let mut c = counter().ok()?;
        Some((c.value().ok()?, c.capacity()))
    }

    /// Mounts the store (once, at boot) and returns what it found.
    pub fn mount() -> Result<(MountReport, Stats), StoreError> {
        let backend = Backend::open()?;
        let (store, report) = Store::mount_with_counter(backend, &device_store_key(), counter()?)?;
        let stats = store.stats();
        interrupt::free(|cs| *STORE.borrow(cs).borrow_mut() = Some(store));
        Ok((report, stats))
    }

    fn with<R>(
        f: impl FnOnce(&mut Store<Backend, Counter>) -> Result<R, StoreError>,
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
    fn this_build_uses_the_development_store_key_by_default() {
        if std::env::var("MAATAA_STORE_KEY").is_err() {
            assert!(STORE_KEY_KIND.starts_with("development"));
            assert_eq!(&STORE_MASTER_KEY, b"maataa-os-dev-store-NOT-SECRET!!");
        }
        assert_ne!(device_store_key(), STORE_MASTER_KEY, "bound to the device");
    }

    #[test]
    fn tasks_may_read_but_not_write_kernel_keys() {
        assert!(task_key_readable(KEY_BOOT_COUNT as u32));
        assert!(task_key_readable(KEY_LAST_RESET as u32));
        assert!(!task_key_readable(64));
    }

    #[test]
    fn each_owner_writes_only_its_own_keys() {
        use Owner::*;
        // Kernel keys: nobody.
        for owner in [None, Host, Telemetry, Panini] {
            for key in 0..16 {
                assert!(!owner_may_write(owner, key), "{owner:?} {key}");
            }
            assert!(!owner_may_write(owner, 64));
        }
        // The keys in use today keep their writers.
        assert!(
            owner_may_write(Host, 20) && owner_may_write(Host, 30) && owner_may_write(Host, 63)
        );
        assert!(owner_may_write(Telemetry, 32));
        for key in [40, 41] {
            assert!(owner_may_write(Host, key) && owner_may_write(Panini, key));
            assert!(!owner_may_write(Telemetry, key) && !owner_may_write(None, key));
        }
        // And nobody else's.
        assert!(!owner_may_write(Telemetry, 20) && !owner_may_write(Panini, 32));
        assert!(!owner_may_write(Host, 32) && !owner_may_write(Host, 42));
        assert!(!owner_may_write(Telemetry, 40) && !owner_may_write(Panini, 63));
        for key in (36..40).chain(48..63) {
            for owner in [None, Host, Telemetry, Panini] {
                assert!(!owner_may_write(owner, key), "{owner:?} {key}");
            }
        }
        for key in 16..64 {
            assert!(!owner_may_write(None, key));
        }
    }

    #[test]
    fn owners_come_from_the_signed_name_and_round_trip() {
        assert_eq!(Owner::for_capsule("telemetry"), Owner::Telemetry);
        assert_eq!(Owner::for_capsule("panini"), Owner::Panini);
        assert_eq!(Owner::for_capsule("greeter"), Owner::None);
        assert_eq!(Owner::for_capsule("hostlink"), Owner::None);
        for owner in [Owner::None, Owner::Host, Owner::Telemetry, Owner::Panini] {
            assert_eq!(Owner::from_u8(owner as u8), owner);
        }
        assert_eq!(Owner::from_u8(200), Owner::None);
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
