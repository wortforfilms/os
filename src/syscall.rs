//! Supervisor calls: the only way an unprivileged task reaches the kernel.
//!
//! | Number | Call | r0 | r1 | Returns in r0 |
//! | --- | --- | --- | --- | --- |
//! | 1 | write text to the kernel log | pointer | length | bytes written, or `u32::MAX` if refused |
//! | 2 | set the user LED | 0 = off, else on | | 0 |
//! | 3 | demo finished (QEMU exits; boards ignore it) | | | 0 |
//! | 4 | test only (`kernel-stack-test`): overflow the kernel stack | | | never |
//!
//! The kernel accepts a write only if the whole buffer lies in flash or in the
//! calling task's own stack, so a task cannot make the kernel read memory the
//! task itself may not read.

pub const SYS_WRITE: u8 = 1;
pub const SYS_LED: u8 = 2;
pub const SYS_DEMO_DONE: u8 = 3;
pub const SYS_TEST_KERNEL_OVERFLOW: u8 = 4;
/// Returned in r0 for an unknown call or a refused buffer.
pub const REFUSED: u32 = u32::MAX;

/// Whether the kernel may read `len` bytes at `ptr` for a task whose stack is
/// `stack = (base, size)`.
pub const fn buffer_allowed(ptr: usize, len: usize, stack: Option<(usize, usize)>) -> bool {
    if crate::mpu::contains(crate::mpu::FLASH_BASE, crate::mpu::FLASH_SIZE, ptr, len) {
        return true;
    }
    match stack {
        Some((base, size)) => crate::mpu::contains(base, size, ptr, len),
        None => false,
    }
}

// ---- task side -------------------------------------------------------------

/// Writes `text` to the kernel log (no newline added).
#[cfg(target_arch = "arm")]
pub fn write(text: &str) -> u32 {
    let mut r0 = text.as_ptr() as u32;
    // SAFETY: the kernel only reads the buffer, after checking its bounds.
    unsafe { core::arch::asm!("svc #1", inout("r0") r0, in("r1") text.len()) };
    r0
}

/// Turns the user LED on or off.
#[cfg(target_arch = "arm")]
pub fn led(on: bool) {
    let mut r0 = on as u32;
    // SAFETY: no memory is passed.
    unsafe { core::arch::asm!("svc #2", inout("r0") r0) };
    let _ = r0;
}

/// Tells the kernel the demo is over (QEMU exits).
#[cfg(target_arch = "arm")]
pub fn demo_done() {
    let mut r0 = 0u32;
    // SAFETY: no memory is passed.
    unsafe { core::arch::asm!("svc #3", inout("r0") r0) };
    let _ = r0;
}

/// Test only: asks the kernel to overflow its own stack.
#[cfg(all(target_arch = "arm", feature = "kernel-stack-test"))]
pub fn test_kernel_overflow() {
    let mut r0 = 0u32;
    // SAFETY: no memory is passed; the kernel is expected to stop.
    unsafe { core::arch::asm!("svc #4", inout("r0") r0) };
    let _ = r0;
}

/// A line buffer on the task's own stack for `uprintln!`.
pub struct LineBuf {
    pub buf: [u8; 120],
    pub len: usize,
}

impl LineBuf {
    pub const fn new() -> Self {
        Self { buf: [0; 120], len: 0 }
    }
    pub fn as_str(&self) -> &str {
        // Only whole UTF-8 strings are ever copied in, so this cannot fail.
        core::str::from_utf8(&self.buf[..self.len]).unwrap_or("")
    }
}

impl Default for LineBuf {
    fn default() -> Self {
        Self::new()
    }
}

impl core::fmt::Write for LineBuf {
    fn write_str(&mut self, s: &str) -> core::fmt::Result {
        // Keep room for the newline; drop what does not fit, at a char boundary.
        let room = self.buf.len() - 1 - self.len;
        let mut take = s.len().min(room);
        while !s.is_char_boundary(take) {
            take -= 1;
        }
        self.buf[self.len..self.len + take].copy_from_slice(&s.as_bytes()[..take]);
        self.len += take;
        Ok(())
    }
}

/// `println!` for unprivileged tasks: formats on the task's stack, then one
/// SYS_WRITE. Lines longer than 119 bytes are cut.
#[macro_export]
macro_rules! uprintln {
    ($($arg:tt)*) => {{
        let mut line = $crate::syscall::LineBuf::new();
        let _ = core::fmt::Write::write_fmt(&mut line, format_args!($($arg)*));
        line.buf[line.len] = b'\n';
        line.len += 1;
        $crate::syscall::write(line.as_str());
    }};
}

// ---- kernel side -----------------------------------------------------------

#[cfg(target_arch = "arm")]
mod kernel {
    use super::*;

    fn sys_write(ptr: usize, len: usize) -> u32 {
        if !buffer_allowed(ptr, len, crate::sched::current_stack()) {
            crate::logging::kprintln!("kernel: refused a write from task {:?}", crate::sched::current_task());
            return REFUSED;
        }
        // SAFETY: the range was checked to lie in flash or the caller's stack.
        let bytes = unsafe { core::slice::from_raw_parts(ptr as *const u8, len) };
        match core::str::from_utf8(bytes) {
            Ok(text) => crate::logging::kprint!("{}", text),
            Err(_) => crate::logging::kprintln!("kernel: task wrote invalid UTF-8"),
        }
        len as u32
    }

    fn sys_demo_done() -> u32 {
        #[cfg(feature = "board-qemu-f405")]
        cortex_m_semihosting::debug::exit(cortex_m_semihosting::debug::EXIT_SUCCESS);
        0
    }

    /// Test only: recurse on the main stack until the guard stops it.
    #[cfg(feature = "kernel-stack-test")]
    #[inline(never)]
    #[allow(unconditional_recursion)]
    fn kernel_recurse(depth: u32) -> u32 {
        let frame = core::hint::black_box([depth as u8; 64]);
        kernel_recurse(depth + 1).wrapping_add(frame[3] as u32)
    }

    /// Called by the SVCall handler with the stacked exception frame
    /// (r0, r1, r2, r3, r12, lr, pc, xPSR). The call number is the SVC
    /// instruction's immediate, the byte just before the stacked pc.
    #[no_mangle]
    extern "C" fn __maataa_svc(frame: *mut u32) {
        // SAFETY: the frame was just stacked by hardware on entry to SVCall,
        // and the stacked pc points just past an SVC instruction in flash.
        let (r0, r1, number) = unsafe {
            let pc = frame.add(6).read() as usize;
            (frame.read(), frame.add(1).read(), ((pc - 2) as *const u8).read())
        };
        let result = match number {
            SYS_WRITE => sys_write(r0 as usize, r1 as usize),
            SYS_LED => {
                crate::board::led_set(r0 != 0);
                0
            }
            SYS_DEMO_DONE => sys_demo_done(),
            #[cfg(feature = "kernel-stack-test")]
            SYS_TEST_KERNEL_OVERFLOW => {
                crate::logging::kprintln!("kernel: recursing on the main stack (kernel-stack-test)");
                kernel_recurse(0)
            }
            _ => REFUSED,
        };
        // SAFETY: r0 of the same frame; returned to the task as the result.
        unsafe { frame.write(result) };
    }

    core::arch::global_asm!(
        ".syntax unified",
        ".thumb",
        ".section .text.SVCall, \"ax\"",
        ".global SVCall",
        ".type SVCall,%function",
        ".thumb_func",
        "SVCall:",
        "tst lr, #4",
        "ite eq",
        "mrseq r0, msp",
        "mrsne r0, psp",
        "b __maataa_svc",
        ".size SVCall, .-SVCall",
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use core::fmt::Write;

    #[test]
    fn writes_are_allowed_from_flash_or_the_callers_stack_only() {
        let stack = Some((0x2000_1000, 2048));
        assert!(buffer_allowed(0x0800_1234, 20, stack));
        assert!(buffer_allowed(0x2000_1100, 64, stack));
        assert!(!buffer_allowed(0x2000_0000, 4, stack)); // kernel RAM
        assert!(!buffer_allowed(0x2000_17F0, 32, stack)); // runs off the stack
        assert!(!buffer_allowed(0x4002_0000, 4, stack)); // a peripheral
        assert!(!buffer_allowed(0x2000_1100, 4, None));
    }

    #[test]
    fn line_buffer_cuts_long_lines_at_a_char_boundary() {
        let mut line = LineBuf::new();
        for _ in 0..20 {
            let _ = write!(line, "नमस्ते ");
        }
        assert!(line.len <= 119);
        assert!(core::str::from_utf8(&line.buf[..line.len]).is_ok());
    }
}
