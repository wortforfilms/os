//! Task memory protection with the ARMv7-M MPU (Cortex-M4).
//!
//! Policy, milestone 1:
//!
//! | Region | Memory | Privileged (kernel) | Unprivileged (tasks) |
//! | --- | --- | --- | --- |
//! | background | everything | default map (`PRIVDEFENA`) | no access |
//! | 0 | flash, first 512 KB | read, execute | read, execute |
//! | 1 | the running task's stack | read, write | read, write, never execute |
//!
//! Kernel RAM, peripherals and other tasks' stacks are therefore out of reach
//! for a task: touching them raises MemManage, and the kernel kills that task
//! only. Region 1 is reprogrammed on every context switch. A task stack must
//! be a power of two of at least 32 bytes and aligned to its own size.

/// Start of flash on STM32F4 parts.
pub const FLASH_BASE: usize = 0x0800_0000;
/// Flash covered for tasks: the F411's 512 KB (`memory.x`). The QEMU F405 image
/// also lies inside the first 512 KB.
pub const FLASH_SIZE: usize = 512 * 1024;

/// RASR SIZE field for a power-of-two region of `bytes`: region size is
/// 2^(SIZE+1) bytes, from 32 bytes upward.
pub const fn size_field(bytes: usize) -> Option<u32> {
    if bytes < 32 || !bytes.is_power_of_two() {
        return None;
    }
    Some(bytes.trailing_zeros() - 1)
}

/// Whether `len` bytes at `base` can be one MPU region.
pub const fn region_ok(base: usize, len: usize) -> bool {
    size_field(len).is_some() && base % len == 0
}

/// Whether `[ptr, ptr + len)` lies wholly inside `[base, base + size)`.
pub const fn contains(base: usize, size: usize, ptr: usize, len: usize) -> bool {
    match (ptr.checked_add(len), base.checked_add(size)) {
        (Some(end), Some(limit)) => ptr >= base && end <= limit,
        _ => false,
    }
}

// RASR fields.
const RASR_ENABLE: u32 = 1;
const XN: u32 = 1 << 28;
const AP_FULL: u32 = 0b011 << 24; // read/write for both levels
const AP_RO: u32 = 0b110 << 24; // read-only for both levels
const NORMAL_C: u32 = 1 << 17; // TEX=000 C=1 B=0: normal memory, write-through
const SHAREABLE: u32 = 1 << 18;

/// RASR value for the flash region.
pub const fn flash_rasr() -> u32 {
    let size = match size_field(FLASH_SIZE) {
        Some(s) => s,
        None => 0,
    };
    AP_RO | NORMAL_C | (size << 1) | RASR_ENABLE
}

/// RASR value for a task stack region of `len` bytes (None if not a valid size).
pub const fn stack_rasr(len: usize) -> Option<u32> {
    match size_field(len) {
        Some(size) => Some(XN | AP_FULL | SHAREABLE | NORMAL_C | (size << 1) | RASR_ENABLE),
        None => None,
    }
}

/// A word in kernel RAM (`.bss`) that the fault test task tries to overwrite.
/// The MemManage report prints it to show the write never landed.
pub static mut FAULT_TEST_TARGET: u32 = 0;

#[cfg(target_arch = "arm")]
mod hw {
    use super::*;
    use cortex_m::peripheral::{MPU, SCB};

    const REGION_FLASH: u32 = 0;
    const REGION_STACK: u32 = 1;
    const CTRL_ENABLE: u32 = 1;
    const CTRL_PRIVDEFENA: u32 = 1 << 2;
    const SHCSR_MEMFAULTENA: u32 = 1 << 16;

    /// Programs the flash region, leaves the stack region off, turns on the
    /// MPU with the privileged default map, and enables the MemManage fault.
    /// Call once, from privileged code, before the first task runs.
    pub fn enable() {
        // SAFETY: boot-time, single-threaded; only MPU and SHCSR bits change.
        unsafe {
            let mpu = &*MPU::PTR;
            mpu.ctrl.write(0);
            mpu.rnr.write(REGION_FLASH);
            mpu.rbar.write(FLASH_BASE as u32);
            mpu.rasr.write(flash_rasr());
            mpu.rnr.write(REGION_STACK);
            mpu.rasr.write(0);
            mpu.ctrl.write(CTRL_ENABLE | CTRL_PRIVDEFENA);
            let scb = &*SCB::PTR;
            scb.shcsr.modify(|v| v | SHCSR_MEMFAULTENA);
        }
        cortex_m::asm::dsb();
        cortex_m::asm::isb();
    }

    /// Opens region 1 on the next task's stack. Called from PendSV, which
    /// issues the barriers before returning to the task.
    pub fn set_task_stack(base: usize, len: usize) {
        let Some(rasr) = stack_rasr(len) else { return };
        // SAFETY: called in the PendSV handler with interrupts masked.
        unsafe {
            let mpu = &*MPU::PTR;
            mpu.rnr.write(REGION_STACK);
            mpu.rasr.write(0);
            mpu.rbar.write(base as u32);
            mpu.rasr.write(rasr);
        }
    }

    /// MemManage status (low byte of CFSR) and the fault address register.
    pub fn fault_status() -> (u8, u32) {
        // SAFETY: plain reads of fault status registers.
        unsafe {
            let scb = &*SCB::PTR;
            ((scb.cfsr.read() & 0xFF) as u8, scb.mmfar.read())
        }
    }

    /// Clears the MemManage status bits (write one to clear).
    pub fn clear_fault_status() {
        // SAFETY: writing 1s to MMFSR clears only those status bits.
        unsafe { (*SCB::PTR).cfsr.write(0xFF) };
    }
}

#[cfg(target_arch = "arm")]
pub use hw::{clear_fault_status, enable, fault_status, set_task_stack};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_field_follows_the_rasr_encoding() {
        assert_eq!(size_field(32), Some(4));
        assert_eq!(size_field(2048), Some(10));
        assert_eq!(size_field(512 * 1024), Some(18));
        assert_eq!(size_field(16), None);
        assert_eq!(size_field(3000), None);
    }

    #[test]
    fn a_region_must_be_aligned_to_its_size() {
        assert!(region_ok(0x2000_0800, 2048));
        assert!(!region_ok(0x2000_0400, 2048));
        assert!(!region_ok(0x2000_0000, 1000));
    }

    #[test]
    fn contains_checks_both_ends_and_overflow() {
        assert!(contains(0x2000_0000, 2048, 0x2000_0010, 16));
        assert!(contains(0x2000_0000, 2048, 0x2000_07F0, 16));
        assert!(!contains(0x2000_0000, 2048, 0x2000_07F8, 16));
        assert!(!contains(0x2000_0000, 2048, 0x1FFF_FFF0, 32));
        assert!(!contains(0x2000_0000, 2048, usize::MAX - 4, 16));
    }

    #[test]
    fn stack_regions_are_never_executable_and_flash_is_read_only() {
        let s = stack_rasr(2048).unwrap();
        assert_ne!(s & XN, 0);
        assert_eq!(s & (0b111 << 24), AP_FULL);
        assert_eq!(flash_rasr() & (0b111 << 24), AP_RO);
        assert_eq!(flash_rasr() & XN, 0);
        assert_eq!(stack_rasr(1000), None);
    }
}
