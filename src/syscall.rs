//! Supervisor calls: the only way an unprivileged task reaches the kernel.
//!
//! | Number | Call | r0 | r1 | Returns in r0 |
//! | --- | --- | --- | --- | --- |
//! | 1 | write text to the kernel log | pointer | length | bytes written, or `u32::MAX` if refused |
//! | 2 | set the user LED | 0 = off, else on | | 0 |
//! | 3 | demo finished (QEMU exits; boards ignore it) | | | 0 |
//! | 4 | test only (`kernel-stack-test`): overflow the kernel stack; (`watchdog-test`): hang with interrupts off | | | never, or 0 if the watchdog test already ran |
//! | 5 | send a message (copied into the kernel queue) | destination task, r1 = pointer, r2 = length | | 0 or an error |
//! | 6 | receive a message (copied into the caller's buffer) | pointer | capacity | timeout ms | length and sender in r1; or an error |
//! | 7 | sleep until a monotonic deadline | milliseconds | | | 0 or an error |
//! | 8 | lock kernel mutex | mutex ID | | 0, `E_OWNER_DIED` (locked; its last owner died holding it), or an error |
//! | 9 | unlock kernel mutex | mutex ID | | 0 or an error |
//! | 10 | wait for semaphore permit | semaphore ID | | 0 or an error |
//! | 11 | post semaphore permit | semaphore ID | | 0 or an error |
//! | 12 | write bytes to the board UART | pointer | length | bytes written, or an error |
//! | 13 | read board UART bytes (blocks until data arrives) | pointer | capacity | bytes read, or an error |
//! | 14 | copy the host-channel status block (`hostlink::HOST_STATUS_BYTES`) | pointer | length | 0 or an error |
//! | 15 | read a persistent key (0..64; 0..16 are the kernel's; key 3, starvation episodes, comes from RAM) | key, r1 = pointer, r2 = capacity | | length, `E_NOENT`, or an error |
//! | 16 | write a persistent key (16..64; empty deletes) | key, r1 = pointer, r2 = length | | 0 or an error |
//! | 17 | run-time capsule install (begin, write, commit, remove, info) | operation and offset | pointer | length | 0, a length, or an error |
//! | 18 | copy the installed capsule's image | pointer | capacity | | length or an error |
//! | 19 | park: block for good (the task's work is done) | | | | never returns, or `E_BUSY` while it holds a mutex |
//!
//! Each task carries a capability mask (bit n allows call n), set when it is
//! created: from its signed capsule manifest for the host channel, by the
//! kernel for the demo tasks. A call outside the mask returns `E_NOCAP`
//! before the kernel looks at its arguments. Park is the one exception: any
//! task may give up the processor, so it needs no capability.
//!
//! The kernel reads a task buffer (write, send) only if it lies wholly in flash
//! or in the caller's own stack, and writes one (receive) only if it lies in
//! the caller's own stack. So a task cannot make the kernel read or write
//! memory the task itself may not touch. Errors are the top values of u32.

pub const SYS_WRITE: u8 = 1;
pub const SYS_LED: u8 = 2;
pub const SYS_DEMO_DONE: u8 = 3;
pub const SYS_TEST_KERNEL_OVERFLOW: u8 = 4;
pub const SYS_SEND: u8 = 5;
pub const SYS_RECV: u8 = 6;
pub const SYS_SLEEP: u8 = 7;
pub const SYS_MUTEX_LOCK: u8 = 8;
pub const SYS_MUTEX_UNLOCK: u8 = 9;
pub const SYS_SEMAPHORE_WAIT: u8 = 10;
pub const SYS_SEMAPHORE_POST: u8 = 11;
pub const SYS_UART_WRITE: u8 = 12;
pub const SYS_UART_READ: u8 = 13;
pub const SYS_HOST_STATUS: u8 = 14;
pub const SYS_STORE_GET: u8 = 15;
pub const SYS_STORE_PUT: u8 = 16;
/// Run-time capsule install: begin, write, commit, remove and info
/// (src/installed.rs). r0 = operation | offset << 8, r1/r2 = buffer.
pub const SYS_CAPSULE_INSTALL: u8 = 17;
/// Copies the installed capsule's image into the caller's buffer (the task
/// that runs it).
pub const SYS_CAPSULE_IMAGE: u8 = 18;
/// Blocks the caller for good. Exempt from the capability gate.
pub const SYS_PARK: u8 = 19;

/// The capability gate: whether a task with `capabilities` may make call
/// `number`. Parking needs no capability, so even an empty mask can stop
/// competing for the processor.
pub const fn call_allowed(capabilities: u32, number: u8) -> bool {
    number == SYS_PARK || maataa_capsule::cap::allows(capabilities, number)
}

/// Operations of [`SYS_CAPSULE_INSTALL`].
pub mod capsule_op {
    pub const BEGIN: u32 = 0;
    pub const WRITE: u32 = 1;
    pub const COMMIT: u32 = 2;
    pub const REMOVE: u32 = 3;
    pub const INFO: u32 = 4;
    /// Copy the current host-request challenge (20 bytes) into the buffer
    /// (src/hostauth.rs).
    pub const CHALLENGE: u32 = 5;
    /// A signed host request: buffer `[signature 64, operation, args..]`
    /// (`maataa_link::host_auth`). COMMIT and REMOVE without a signature
    /// are refused since signed requests exist.
    pub const SIGNED: u32 = 6;
}
/// Maximum bytes copied or sent by one UART syscall.
pub const MAX_UART_TRANSFER: usize = 256;

// Used by the ARM UART syscalls and the tests; a plain host build has neither.
#[cfg(any(test, target_arch = "arm"))]
const fn uart_len_allowed(len: usize) -> bool {
    len <= MAX_UART_TRANSFER
}

/// A buffer outside the caller's own memory, or an unknown call.
pub const E_PERM: u32 = u32::MAX;
/// No message waiting (receive).
pub const E_AGAIN: u32 = u32::MAX - 1;
/// The kernel queue is full (send).
pub const E_FULL: u32 = u32::MAX - 2;
/// Longer than the 64-byte message limit (send).
pub const E_TOOLONG: u32 = u32::MAX - 3;
/// The destination task does not exist or is dead (send).
pub const E_NOTASK: u32 = u32::MAX - 4;
/// Receive deadline elapsed.
pub const E_TIMEOUT: u32 = u32::MAX - 5;
/// Internal result: the task was parked and must retry the receive after waking.
pub const E_BLOCKED: u32 = u32::MAX - 6;
/// The caller does not own the mutex being unlocked.
pub const E_NOT_OWNER: u32 = u32::MAX - 7;
/// Mutex IDs are limited to the kernel's fixed registry.
pub const E_BAD_MUTEX: u32 = u32::MAX - 8;
/// Recursive lock by the current owner.
pub const E_DEADLOCK: u32 = u32::MAX - 9;
/// The bounded mutex waiter queue is full.
pub const E_MUTEX_FULL: u32 = u32::MAX - 10;
/// The semaphore waiter queue is full.
pub const E_SEMAPHORE_FULL: u32 = u32::MAX - 11;
/// The semaphore count cannot exceed its fixed u16 maximum.
pub const E_SEMAPHORE_OVERFLOW: u32 = u32::MAX - 12;
/// Semaphore ID is outside the fixed registry.
pub const E_BAD_SEMAPHORE: u32 = u32::MAX - 13;
/// This board does not provide a physical UART.
pub const E_NOT_SUPPORTED: u32 = u32::MAX - 14;
/// The calling task has no capability for this supervisor call.
pub const E_NOCAP: u32 = u32::MAX - 15;
/// The persistent key has no value.
pub const E_NOENT: u32 = u32::MAX - 16;
/// The caller holds a mutex and may not park (park).
pub const E_BUSY: u32 = u32::MAX - 17;
/// Mutex lock: the caller now OWNS the lock, but its previous owner died
/// holding it, so the data it guards may be half updated. Not a failure.
pub const E_OWNER_DIED: u32 = u32::MAX - 18;
/// Every error code is at least this; smaller results are counts or lengths.
pub const E_LOWEST: u32 = E_OWNER_DIED;
/// Older name for E_PERM.
pub const REFUSED: u32 = E_PERM;

/// A short name for an error code, for task logs.
pub const fn error_name(code: u32) -> &'static str {
    match code {
        E_PERM => "EPERM",
        E_AGAIN => "EAGAIN",
        E_FULL => "EFULL",
        E_TOOLONG => "ETOOLONG",
        E_NOTASK => "ENOTASK",
        E_TIMEOUT => "ETIMEDOUT",
        E_BLOCKED => "EBLOCKED",
        E_NOT_OWNER => "ENOTOWNER",
        E_BAD_MUTEX => "EBADMUTEX",
        E_DEADLOCK => "EDEADLK",
        E_MUTEX_FULL => "EMUTEXFULL",
        E_SEMAPHORE_FULL => "ESEMFULL",
        E_SEMAPHORE_OVERFLOW => "ESEMOVERFLOW",
        E_BAD_SEMAPHORE => "EBADSEMAPHORE",
        E_NOT_SUPPORTED => "ENOTSUP",
        E_NOCAP => "ENOCAP",
        E_NOENT => "ENOENT",
        E_BUSY => "EBUSY",
        E_OWNER_DIED => "EOWNERDEAD",
        _ => "?",
    }
}

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

/// Whether the kernel may write `len` bytes at `ptr` for a task whose stack is
/// `stack`: only inside that stack (never flash, never kernel memory).
pub const fn writable_allowed(ptr: usize, len: usize, stack: Option<(usize, usize)>) -> bool {
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

/// Like `led`, but returns the kernel's result (0, or `E_NOCAP` without the
/// LED capability).
#[cfg(target_arch = "arm")]
pub fn led_checked(on: bool) -> u32 {
    let mut r0 = on as u32;
    // SAFETY: no memory is passed.
    unsafe { core::arch::asm!("svc #2", inout("r0") r0) };
    r0
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

/// Test only: asks the kernel to hang with interrupts off. Returns 0 if the
/// kernel declines because the last reset already came from the watchdog.
#[cfg(all(target_arch = "arm", feature = "watchdog-test"))]
pub fn test_watchdog() -> u32 {
    let mut r0 = 0u32;
    // SAFETY: no memory is passed; the kernel may never return.
    unsafe { core::arch::asm!("svc #4", inout("r0") r0) };
    r0
}

#[cfg(feature = "watchdog-test")]
static WATCHDOG_TEST_ARMED: core::sync::atomic::AtomicBool =
    core::sync::atomic::AtomicBool::new(false);

/// Kernel, at boot: whether the watchdog test should hang this run.
#[cfg(feature = "watchdog-test")]
pub fn arm_watchdog_test(armed: bool) {
    WATCHDOG_TEST_ARMED.store(armed, core::sync::atomic::Ordering::Relaxed);
}

/// Sends a raw buffer to task `to`. `send` is the safe wrapper; this form
/// exists so a test can hand the kernel a pointer it must refuse.
#[cfg(target_arch = "arm")]
pub fn send_raw(to: u8, ptr: *const u8, len: usize) -> u32 {
    let mut r0 = to as u32;
    // SAFETY: the kernel checks the range before reading it.
    unsafe { core::arch::asm!("svc #5", inout("r0") r0, in("r1") ptr, in("r2") len) };
    r0
}

/// Sends `data` (copied by the kernel) to task `to`.
#[cfg(target_arch = "arm")]
pub fn send(to: u8, data: &[u8]) -> Result<(), u32> {
    match send_raw(to, data.as_ptr(), data.len()) {
        0 => Ok(()),
        e => Err(e),
    }
}

/// Receives into a raw buffer with a timeout; returns (r0, r1) = (length or error, sender).
#[cfg(target_arch = "arm")]
pub fn recv_raw_timeout(ptr: *mut u8, cap: usize, timeout_ms: u32) -> (u32, u32) {
    let mut r0 = ptr as u32;
    let mut r1 = cap as u32;
    let r2 = timeout_ms;
    // SAFETY: the kernel validates the output buffer before writing it.
    unsafe { core::arch::asm!("svc #6", inout("r0") r0, inout("r1") r1, in("r2") r2) };
    (r0, r1)
}

/// Nonblocking receive; returns E_AGAIN if no message is waiting.
#[cfg(target_arch = "arm")]
pub fn recv_raw(ptr: *mut u8, cap: usize) -> (u32, u32) {
    recv_raw_timeout(ptr, cap, 0)
}

/// Receives the oldest message for this task: (sender, length copied).
#[cfg(target_arch = "arm")]
pub fn recv(buf: &mut [u8]) -> Result<(u8, usize), u32> {
    recv_timeout(buf, 0)
}

/// Receives until a message arrives or the monotonic timeout expires.
/// Parking is performed by the kernel; E_BLOCKED is an internal retry signal.
#[cfg(target_arch = "arm")]
pub fn recv_timeout(buf: &mut [u8], timeout_ms: u32) -> Result<(u8, usize), u32> {
    loop {
        let (r0, r1) = recv_raw_timeout(buf.as_mut_ptr(), buf.len(), timeout_ms);
        match r0 {
            E_BLOCKED => continue,
            E_TIMEOUT => return Err(E_TIMEOUT),
            E_AGAIN if timeout_ms == 0 => return Err(E_AGAIN),
            value if value >= E_LOWEST => return Err(value),
            length => return Ok((r1 as u8, length as usize)),
        }
    }
}

/// Sleeps in the kernel scheduler instead of spinning until the deadline.
#[cfg(target_arch = "arm")]
pub fn sleep_ms(millis: u32) -> Result<(), u32> {
    let mut r0 = millis;
    // SAFETY: the kernel treats this as a duration and checks the deadline arithmetic.
    unsafe { core::arch::asm!("svc #7", inout("r0") r0) };
    if r0 == 0 {
        Ok(())
    } else {
        Err(r0)
    }
}

/// How a mutex lock succeeded.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Acquired {
    Clean,
    /// The previous owner died holding the lock; check what it guards.
    OwnerDied,
}

/// Locks a kernel mutex, sleeping until ownership is handed to this task.
/// Waiting would close a lock cycle: `Err(E_DEADLOCK)`.
#[cfg(target_arch = "arm")]
pub fn mutex_lock(id: u8) -> Result<Acquired, u32> {
    loop {
        let mut r0 = id as u32;
        // SAFETY: the kernel validates the mutex ID and blocks this task if busy.
        unsafe { core::arch::asm!("svc #8", inout("r0") r0) };
        match r0 {
            0 => return Ok(Acquired::Clean),
            E_OWNER_DIED => return Ok(Acquired::OwnerDied),
            E_BLOCKED => continue,
            error => return Err(error),
        }
    }
}

/// Unlocks a mutex owned by the current task.
#[cfg(target_arch = "arm")]
pub fn mutex_unlock(id: u8) -> Result<(), u32> {
    let mut r0 = id as u32;
    // SAFETY: the kernel checks ownership before releasing or handing off.
    unsafe { core::arch::asm!("svc #9", inout("r0") r0) };
    if r0 == 0 {
        Ok(())
    } else {
        Err(r0)
    }
}

/// Waits for one permit from a zero-initialized kernel counting semaphore.
/// Blocks until a permit is available; posted permits are handed to FIFO waiters.
#[cfg(target_arch = "arm")]
pub fn semaphore_wait(id: u8) -> Result<(), u32> {
    loop {
        let mut r0 = id as u32;
        // SAFETY: the kernel validates the ID and parks this task when empty.
        unsafe { core::arch::asm!("svc #10", inout("r0") r0) };
        match r0 {
            0 => return Ok(()),
            E_BLOCKED => continue,
            error => return Err(error),
        }
    }
}

/// Posts one permit; wakes the oldest task waiting on this semaphore, if any.
#[cfg(target_arch = "arm")]
pub fn semaphore_post(id: u8) -> Result<(), u32> {
    let mut r0 = id as u32;
    // SAFETY: the kernel validates the ID and checks count overflow.
    unsafe { core::arch::asm!("svc #11", inout("r0") r0) };
    if r0 == 0 {
        Ok(())
    } else {
        Err(r0)
    }
}

/// Writes bytes to the board's UART. On F411 this is USART2 at 115200 baud;
/// other targets return `E_NOT_SUPPORTED`.
#[cfg(target_arch = "arm")]
pub fn uart_write(data: &[u8]) -> Result<usize, u32> {
    let mut r0 = data.as_ptr() as u32;
    let r1 = data.len() as u32;
    // SAFETY: the kernel bounds-checks this caller-owned input range.
    unsafe { core::arch::asm!("svc #12", inout("r0") r0, in("r1") r1) };
    if r0 >= E_LOWEST {
        Err(r0)
    } else {
        Ok(r0 as usize)
    }
}

/// Copies the kernel's status block (time, tasks, UART drops, last telemetry
/// frame) into the caller's stack buffer, for the host channel's replies.
#[cfg(target_arch = "arm")]
pub fn host_status(out: &mut [u8; crate::hostlink::HOST_STATUS_BYTES]) -> Result<(), u32> {
    let mut r0 = out.as_mut_ptr() as u32;
    let r1 = out.len() as u32;
    // SAFETY: the kernel checks the range lies in the caller's own stack.
    unsafe { core::arch::asm!("svc #14", inout("r0") r0, in("r1") r1) };
    if r0 == 0 {
        Ok(())
    } else {
        Err(r0)
    }
}

/// Reads persistent key `key` (16..64) into `out`; returns the value's length.
#[cfg(target_arch = "arm")]
pub fn store_get(key: u8, out: &mut [u8]) -> Result<usize, u32> {
    let mut r0 = key as u32;
    // SAFETY: the kernel checks the output range lies in the caller's stack.
    unsafe {
        core::arch::asm!("svc #15", inout("r0") r0, in("r1") out.as_mut_ptr(), in("r2") out.len())
    };
    if r0 >= E_LOWEST {
        Err(r0)
    } else {
        Ok(r0 as usize)
    }
}

/// Writes persistent key `key` (16..64); an empty value deletes it.
#[cfg(target_arch = "arm")]
pub fn store_put(key: u8, value: &[u8]) -> Result<(), u32> {
    let mut r0 = key as u32;
    // SAFETY: the kernel checks the input range is the caller's own.
    unsafe {
        core::arch::asm!("svc #16", inout("r0") r0, in("r1") value.as_ptr(), in("r2") value.len())
    };
    if r0 == 0 {
        Ok(())
    } else {
        Err(r0)
    }
}

#[cfg(target_arch = "arm")]
fn capsule_install(op: u32, offset: usize, ptr: *const u8, len: usize) -> u32 {
    let mut r0 = op | ((offset as u32) << 8);
    // SAFETY: the kernel checks the range is flash or the caller's own stack
    // (and, for INFO, writes only inside the caller's own stack).
    unsafe { core::arch::asm!("svc #17", inout("r0") r0, in("r1") ptr, in("r2") len) };
    r0
}

#[cfg(target_arch = "arm")]
fn status(r0: u32) -> Result<(), u32> {
    if r0 == 0 {
        Ok(())
    } else {
        Err(r0)
    }
}

/// Starts installing a run-time capsule image of `len` bytes.
#[cfg(target_arch = "arm")]
pub fn capsule_begin(len: usize) -> Result<(), u32> {
    status(capsule_install(
        capsule_op::BEGIN,
        0,
        core::ptr::null(),
        len,
    ))
}

/// Writes `data` at `offset` of the image being installed.
#[cfg(target_arch = "arm")]
pub fn capsule_write(offset: usize, data: &[u8]) -> Result<(), u32> {
    if offset >= 1 << 24 {
        return Err(E_TOOLONG);
    }
    status(capsule_install(
        capsule_op::WRITE,
        offset,
        data.as_ptr(),
        data.len(),
    ))
}

/// Checks the image and, if it passes, installs it (it runs from the next
/// boot); `E_PERM` if the kernel refused it.
#[cfg(target_arch = "arm")]
pub fn capsule_commit() -> Result<(), u32> {
    status(capsule_install(capsule_op::COMMIT, 0, core::ptr::null(), 0))
}

/// Removes the installed capsule; `E_NOENT` if there is none.
#[cfg(target_arch = "arm")]
pub fn capsule_remove() -> Result<(), u32> {
    status(capsule_install(capsule_op::REMOVE, 0, core::ptr::null(), 0))
}

/// Copies the current host-request challenge into `out`.
#[cfg(target_arch = "arm")]
pub fn capsule_challenge(
    out: &mut [u8; maataa_link::host_auth::CHALLENGE_BYTES],
) -> Result<(), u32> {
    status(capsule_install(
        capsule_op::CHALLENGE,
        0,
        out.as_mut_ptr(),
        out.len(),
    ))
}

/// Hands a signed host request (`[signature 64, operation, args..]`) to
/// the kernel, which checks and carries it out.
#[cfg(target_arch = "arm")]
pub fn capsule_signed(request: &[u8]) -> Result<(), u32> {
    status(capsule_install(
        capsule_op::SIGNED,
        0,
        request.as_ptr(),
        request.len(),
    ))
}

/// Describes the installed capsule (`crate::installed::encode_info`).
#[cfg(target_arch = "arm")]
pub fn capsule_info(out: &mut [u8]) -> Result<usize, u32> {
    let r0 = capsule_install(capsule_op::INFO, 0, out.as_mut_ptr(), out.len());
    if r0 >= E_LOWEST {
        Err(r0)
    } else {
        Ok(r0 as usize)
    }
}

/// Copies the installed capsule's image into `out`; returns its length.
#[cfg(target_arch = "arm")]
pub fn capsule_image(out: &mut [u8]) -> Result<usize, u32> {
    let mut r0 = out.as_mut_ptr() as u32;
    // SAFETY: the kernel checks the range lies in the caller's own stack.
    unsafe { core::arch::asm!("svc #18", inout("r0") r0, in("r1") out.len()) };
    if r0 >= E_LOWEST {
        Err(r0)
    } else {
        Ok(r0 as usize)
    }
}

/// Parks the calling task for good. Returns only with `E_BUSY` (the task
/// holds a mutex; unlock it first).
#[cfg(target_arch = "arm")]
pub fn park() -> u32 {
    let mut r0 = 0u32;
    // SAFETY: no memory is passed.
    unsafe { core::arch::asm!("svc #19", inout("r0") r0) };
    r0
}

/// The end of a task whose work is done: park, and never compete for the
/// processor again. A task that still holds a mutex is a bug; it is
/// reported once and then sleeps in long steps so lower levels still run.
#[cfg(target_arch = "arm")]
pub fn park_forever() -> ! {
    let error = park();
    crate::uprintln!("park refused: {}; sleeping instead", error_name(error));
    loop {
        let _ = park();
        let _ = sleep_ms(1_000);
    }
}

/// Reads UART bytes from the interrupt-fed kernel FIFO, blocking the task until
/// data arrives. The internal parked result is retried after the IRQ wakes it.
#[cfg(target_arch = "arm")]
pub fn uart_read(buffer: &mut [u8]) -> Result<usize, u32> {
    if buffer.is_empty() {
        return Ok(0);
    }
    loop {
        let mut r0 = buffer.as_mut_ptr() as u32;
        let r1 = buffer.len() as u32;
        // SAFETY: the kernel bounds-checks this caller-owned output range.
        unsafe { core::arch::asm!("svc #13", inout("r0") r0, in("r1") r1) };
        match r0 {
            E_BLOCKED => continue,
            value if value >= E_LOWEST => return Err(value),
            count => return Ok(count as usize),
        }
    }
}

/// A line buffer on the task's own stack for `uprintln!`.
pub struct LineBuf {
    pub buf: [u8; 120],
    pub len: usize,
}

impl LineBuf {
    pub const fn new() -> Self {
        Self {
            buf: [0; 120],
            len: 0,
        }
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
    use crate::ipc::mailbox::{Mailbox, MailboxError};
    use core::cell::RefCell;
    use cortex_m::interrupt::{self, Mutex};

    static MAILBOX: Mutex<RefCell<Mailbox>> = Mutex::new(RefCell::new(Mailbox::new()));

    /// Drops a dead task's messages (called when the kernel kills a task).
    pub fn forget_task(task: u8) {
        interrupt::free(|cs| MAILBOX.borrow(cs).borrow_mut().forget(task));
    }

    fn sys_send(to: u32, ptr: usize, len: usize) -> u32 {
        let from = crate::sched::current_task().unwrap_or(0);
        if !buffer_allowed(ptr, len, crate::sched::current_stack()) {
            crate::logging::kprintln!(
                "kernel: send from task {} refused: buffer {:#010x}+{} is not the task's own",
                from,
                ptr,
                len
            );
            return E_PERM;
        }
        if to > u8::MAX as u32 || !crate::sched::task_alive(to as u8) {
            return E_NOTASK;
        }
        // SAFETY: the range was checked to lie in flash or the caller's stack.
        let data = unsafe { core::slice::from_raw_parts(ptr as *const u8, len) };
        match interrupt::free(|cs| MAILBOX.borrow(cs).borrow_mut().send(from, to as u8, data)) {
            Ok(()) => {
                crate::sched::wake_waiting_receiver(to as u8);
                0
            }
            Err(MailboxError::Full) => E_FULL,
            Err(MailboxError::TooLong) => E_TOOLONG,
            Err(MailboxError::Empty) => E_AGAIN,
        }
    }

    /// Returns (r0, r1): (length, sender) or (error, 0).
    fn sys_recv(ptr: usize, cap: usize, timeout_ms: u32) -> (u32, u32) {
        let me = crate::sched::current_task().unwrap_or(0);
        if !writable_allowed(ptr, cap, crate::sched::current_stack()) {
            crate::logging::kprintln!(
                "kernel: recv by task {} refused: buffer {:#010x}+{} is not in the task's stack",
                me,
                ptr,
                cap
            );
            return (E_PERM, 0);
        }
        if crate::sched::take_recv_timeout() {
            return (E_TIMEOUT, 0);
        }
        // SAFETY: the range was checked to lie in the caller's own stack.
        let out = unsafe { core::slice::from_raw_parts_mut(ptr as *mut u8, cap) };
        match interrupt::free(|cs| MAILBOX.borrow(cs).borrow_mut().recv(me, out)) {
            Ok((from, n)) => (n as u32, from as u32),
            Err(_) if timeout_ms == 0 => (E_AGAIN, 0),
            Err(_) => {
                let deadline = crate::clock::get_ticks().saturating_add(timeout_ms as u64);
                if crate::sched::block_current_until(deadline, true) {
                    (E_BLOCKED, 0)
                } else {
                    (E_AGAIN, 0)
                }
            }
        }
    }

    fn sys_sleep(millis: u32) -> u32 {
        if millis == 0 {
            return 0;
        }
        let deadline = crate::clock::get_ticks().saturating_add(millis as u64);
        if crate::sched::block_current_until(deadline, false) {
            0
        } else {
            E_AGAIN
        }
    }

    fn mutex_error(error: crate::sched::MutexError) -> u32 {
        match error {
            crate::sched::MutexError::InvalidId => E_BAD_MUTEX,
            crate::sched::MutexError::NotOwner => E_NOT_OWNER,
            crate::sched::MutexError::Deadlock => E_DEADLOCK,
            crate::sched::MutexError::QueueFull => E_MUTEX_FULL,
        }
    }

    fn semaphore_error(error: crate::sched::SemaphoreError) -> u32 {
        match error {
            crate::sched::SemaphoreError::InvalidId => E_BAD_SEMAPHORE,
            crate::sched::SemaphoreError::AlreadyWaiting => E_DEADLOCK,
            crate::sched::SemaphoreError::QueueFull => E_SEMAPHORE_FULL,
            crate::sched::SemaphoreError::Overflow => E_SEMAPHORE_OVERFLOW,
        }
    }

    fn sys_semaphore_wait(id: u32) -> u32 {
        if id > u8::MAX as u32 {
            return E_BAD_SEMAPHORE;
        }
        match crate::sched::semaphore_wait_current(id as u8) {
            Ok(crate::sched::LockResult::Acquired | crate::sched::LockResult::OwnerDied) => 0,
            Ok(crate::sched::LockResult::Blocked) => E_BLOCKED,
            Err(error) => semaphore_error(error),
        }
    }

    fn sys_semaphore_post(id: u32) -> u32 {
        if id > u8::MAX as u32 {
            return E_BAD_SEMAPHORE;
        }
        crate::sched::semaphore_post_current(id as u8).map_or_else(semaphore_error, |_| 0)
    }

    fn sys_uart_write(ptr: usize, len: usize) -> u32 {
        if !uart_len_allowed(len) {
            return E_TOOLONG;
        }
        if !buffer_allowed(ptr, len, crate::sched::current_stack()) {
            return REFUSED;
        }
        // SAFETY: the task buffer was validated as flash or its own stack.
        let bytes = unsafe { core::slice::from_raw_parts(ptr as *const u8, len) };
        crate::drivers::uart::write(bytes).map_or(E_NOT_SUPPORTED, |written| written as u32)
    }

    fn sys_uart_read(ptr: usize, len: usize) -> u32 {
        if !uart_len_allowed(len) {
            return E_TOOLONG;
        }
        if !writable_allowed(ptr, len, crate::sched::current_stack()) {
            return REFUSED;
        }
        // SAFETY: the task buffer was validated as its own writable stack.
        let buffer = unsafe { core::slice::from_raw_parts_mut(ptr as *mut u8, len) };
        match crate::drivers::uart::read_or_block(buffer) {
            Ok(crate::drivers::uart::ReadResult::Bytes(read)) => read as u32,
            Ok(crate::drivers::uart::ReadResult::Blocked) => E_BLOCKED,
            Err(_) => E_NOT_SUPPORTED,
        }
    }

    fn sys_host_status(ptr: usize, len: usize) -> u32 {
        if len != crate::hostlink::HOST_STATUS_BYTES {
            return E_TOOLONG;
        }
        if !writable_allowed(ptr, len, crate::sched::current_stack()) {
            return REFUSED;
        }
        // SAFETY: the range was checked to lie in the caller's own stack and
        // to be exactly one status block long.
        let out = unsafe { &mut *(ptr as *mut [u8; crate::hostlink::HOST_STATUS_BYTES]) };
        crate::hostlink::fill_status(out);
        0
    }

    fn sys_store_get(key: u32, ptr: usize, cap: usize) -> u32 {
        use crate::storage::persist;
        if !persist::task_key_readable(key) {
            return E_PERM;
        }
        if !writable_allowed(ptr, cap, crate::sched::current_stack()) {
            return REFUSED;
        }
        if key == persist::KEY_STARVATION_COUNT as u32 {
            // Served from RAM; never written to flash.
            if cap < 4 {
                return E_TOOLONG;
            }
            // SAFETY: the range was checked to lie in the caller's own stack.
            let out = unsafe { core::slice::from_raw_parts_mut(ptr as *mut u8, 4) };
            out.copy_from_slice(&crate::sched::starvation_count().to_le_bytes());
            return 4;
        }
        let mut value = [0u8; persist::MAX_VALUE];
        let found = if persist::is_ram_key(key) {
            // Live readings (keys 54-59): RAM only, never flash.
            Some(persist::ram_get(key, &mut value))
        } else {
            persist::get(key as u8, &mut value)
        };
        match found {
            None => E_NOT_SUPPORTED,
            Some(Ok(None)) => E_NOENT,
            Some(Ok(Some(len))) if len > cap => E_TOOLONG,
            Some(Ok(Some(len))) => {
                // SAFETY: the range was checked to lie in the caller's own stack.
                let out = unsafe { core::slice::from_raw_parts_mut(ptr as *mut u8, cap) };
                out[..len].copy_from_slice(&value[..len]);
                len as u32
            }
            Some(Err(_)) => E_NOT_SUPPORTED,
        }
    }

    fn sys_store_put(key: u32, ptr: usize, len: usize) -> u32 {
        use crate::storage::persist;
        // Kernel code (no task) may not call this either: kernel keys are
        // written through persist directly.
        let owner = persist::Owner::from_u8(crate::sched::current_store_owner().unwrap_or(0));
        if !persist::owner_may_write(owner, key) {
            return E_PERM;
        }
        if len > persist::MAX_VALUE {
            return E_TOOLONG;
        }
        if !buffer_allowed(ptr, len, crate::sched::current_stack()) {
            return REFUSED;
        }
        // SAFETY: the range was checked to be flash or the caller's stack.
        let value = unsafe { core::slice::from_raw_parts(ptr as *const u8, len) };
        let stored = if persist::is_ram_key(key) {
            // Live readings (keys 54-59): RAM only, never flash.
            Some(persist::ram_put(key, value))
        } else {
            persist::put(key as u8, value)
        };
        match stored {
            None => E_NOT_SUPPORTED,
            Some(Ok(())) => 0,
            Some(Err(persist::StoreError::Full)) => E_FULL,
            Some(Err(_)) => E_NOT_SUPPORTED,
        }
    }

    /// Checks a signed host request and carries it out (src/hostauth.rs).
    fn signed_request(request: &[u8]) -> u32 {
        use maataa_link::host_auth::{op, MAX_ARGS, SIGNATURE_BYTES};
        if request.len() < SIGNATURE_BYTES + 1 || request.len() > SIGNATURE_BYTES + 1 + MAX_ARGS {
            return E_TOOLONG;
        }
        let mut signature = [0u8; SIGNATURE_BYTES];
        signature.copy_from_slice(&request[..SIGNATURE_BYTES]);
        let operation = request[SIGNATURE_BYTES];
        let args = &request[SIGNATURE_BYTES + 1..];
        if !crate::hostauth::accept(
            operation,
            args,
            &signature,
            &crate::capsule::CAPSULE_PUBLIC_KEY,
        ) {
            crate::logging::kprintln!(
                "host request: refused: bad signature, or not for this board and challenge"
            );
            return E_PERM;
        }
        match operation {
            op::REMOVE => crate::installed::remove(args),
            op::COMMIT => crate::installed::commit(args),
            op::STORE_PUT => {
                use crate::storage::persist;
                let Some((&key, value)) = args.split_first() else {
                    return E_TOOLONG;
                };
                // Signed, the host may write any task key; never a kernel
                // key, and never a RAM-only key (only its capsule writes
                // live readings).
                if !persist::task_key_allowed(key as u32) || persist::is_ram_key(key as u32) {
                    return E_PERM;
                }
                match persist::put(key, value) {
                    None => E_NOT_SUPPORTED,
                    Some(Ok(())) => 0,
                    Some(Err(persist::StoreError::Full)) => E_FULL,
                    Some(Err(_)) => E_NOT_SUPPORTED,
                }
            }
            _ => E_NOT_SUPPORTED,
        }
    }

    fn sys_capsule_install(r0: u32, ptr: usize, len: usize) -> u32 {
        let stack = crate::sched::current_stack();
        let offset = (r0 >> 8) as usize;
        match r0 & 0xFF {
            capsule_op::BEGIN => crate::installed::begin(len),
            capsule_op::WRITE => {
                if !buffer_allowed(ptr, len, stack) {
                    return REFUSED;
                }
                // SAFETY: the range was checked to be flash or the caller's stack.
                let data = unsafe { core::slice::from_raw_parts(ptr as *const u8, len) };
                crate::installed::write(offset, data)
            }
            capsule_op::COMMIT | capsule_op::REMOVE => {
                crate::logging::kprintln!(
                    "capsule install: refused: commit and remove need a signed request"
                );
                E_PERM
            }
            capsule_op::CHALLENGE => {
                use maataa_link::host_auth::CHALLENGE_BYTES;
                if len < CHALLENGE_BYTES || !writable_allowed(ptr, CHALLENGE_BYTES, stack) {
                    return REFUSED;
                }
                match crate::hostauth::challenge() {
                    Some(challenge) => {
                        // SAFETY: the range was checked to lie in the caller's own stack.
                        let out = unsafe {
                            core::slice::from_raw_parts_mut(ptr as *mut u8, CHALLENGE_BYTES)
                        };
                        out.copy_from_slice(&challenge);
                        0
                    }
                    None => E_NOT_SUPPORTED,
                }
            }
            capsule_op::SIGNED => {
                if !buffer_allowed(ptr, len, stack) {
                    return REFUSED;
                }
                // SAFETY: the range was checked to be flash or the caller's stack.
                let request = unsafe { core::slice::from_raw_parts(ptr as *const u8, len) };
                signed_request(request)
            }
            capsule_op::INFO => {
                if !writable_allowed(ptr, len, stack) {
                    return REFUSED;
                }
                // SAFETY: the range was checked to lie in the caller's own stack.
                let out = unsafe { core::slice::from_raw_parts_mut(ptr as *mut u8, len) };
                crate::installed::info(out)
            }
            _ => E_NOT_SUPPORTED,
        }
    }

    fn sys_capsule_image(ptr: usize, len: usize) -> u32 {
        if !writable_allowed(ptr, len, crate::sched::current_stack()) {
            return REFUSED;
        }
        // SAFETY: the range was checked to lie in the caller's own stack.
        let out = unsafe { core::slice::from_raw_parts_mut(ptr as *mut u8, len) };
        crate::installed::read_image(out)
    }

    fn sys_mutex_lock(id: u32) -> u32 {
        if id > u8::MAX as u32 {
            return E_BAD_MUTEX;
        }
        match crate::sched::mutex_lock_current(id as u8) {
            Ok(crate::sched::LockResult::Acquired) => 0,
            Ok(crate::sched::LockResult::OwnerDied) => E_OWNER_DIED,
            Ok(crate::sched::LockResult::Blocked) => E_BLOCKED,
            Err(error) => mutex_error(error),
        }
    }

    fn sys_mutex_unlock(id: u32) -> u32 {
        if id > u8::MAX as u32 {
            return E_BAD_MUTEX;
        }
        crate::sched::mutex_unlock_current(id as u8).map_or_else(mutex_error, |_| 0)
    }

    fn sys_write(ptr: usize, len: usize) -> u32 {
        if !buffer_allowed(ptr, len, crate::sched::current_stack()) {
            crate::logging::kprintln!(
                "kernel: refused a write from task {}",
                crate::sched::current_task().unwrap_or(0)
            );
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
        let (r0, r1, r2, number) = unsafe {
            let pc = frame.add(6).read() as usize;
            (
                frame.read(),
                frame.add(1).read(),
                frame.add(2).read(),
                ((pc - 2) as *const u8).read(),
            )
        };
        // Capability gate: a running task may make only the calls its mask
        // allows. Kernel code before the scheduler starts has no task.
        if let Some(capabilities) = crate::sched::current_capabilities() {
            if !call_allowed(capabilities, number) {
                crate::logging::kprintln!(
                    "kernel: task {} has no capability for syscall {}",
                    crate::sched::current_task().unwrap_or(0),
                    number
                );
                // SAFETY: r0 of the same frame; returned to the task as the result.
                unsafe { frame.write(E_NOCAP) };
                return;
            }
        }
        let result = match number {
            SYS_WRITE => sys_write(r0 as usize, r1 as usize),
            SYS_LED => {
                crate::board::led_set(r0 != 0);
                0
            }
            SYS_DEMO_DONE => sys_demo_done(),
            SYS_SEND => sys_send(r0, r1 as usize, r2 as usize),
            SYS_RECV => {
                let (len, from) = sys_recv(r0 as usize, r1 as usize, r2);
                // SAFETY: r1 of the same frame carries the sender back.
                unsafe { frame.add(1).write(from) };
                len
            }
            SYS_SLEEP => sys_sleep(r0),
            SYS_MUTEX_LOCK => sys_mutex_lock(r0),
            SYS_MUTEX_UNLOCK => sys_mutex_unlock(r0),
            SYS_SEMAPHORE_WAIT => sys_semaphore_wait(r0),
            SYS_SEMAPHORE_POST => sys_semaphore_post(r0),
            SYS_UART_WRITE => sys_uart_write(r0 as usize, r1 as usize),
            SYS_UART_READ => sys_uart_read(r0 as usize, r1 as usize),
            SYS_HOST_STATUS => sys_host_status(r0 as usize, r1 as usize),
            SYS_STORE_GET => sys_store_get(r0, r1 as usize, r2 as usize),
            SYS_STORE_PUT => sys_store_put(r0, r1 as usize, r2 as usize),
            SYS_CAPSULE_INSTALL => sys_capsule_install(r0, r1 as usize, r2 as usize),
            SYS_CAPSULE_IMAGE => sys_capsule_image(r0 as usize, r1 as usize),
            SYS_PARK => match crate::sched::park_current() {
                Ok(()) => 0,
                Err(crate::sched::ParkError::HoldsMutex) => E_BUSY,
                Err(crate::sched::ParkError::NoTask) => E_PERM,
            },
            #[cfg(feature = "kernel-stack-test")]
            SYS_TEST_KERNEL_OVERFLOW => {
                crate::logging::kprintln!(
                    "kernel: recursing on the main stack (kernel-stack-test)"
                );
                kernel_recurse(0)
            }
            #[cfg(feature = "watchdog-test")]
            SYS_TEST_KERNEL_OVERFLOW => {
                if WATCHDOG_TEST_ARMED.load(core::sync::atomic::Ordering::Relaxed) {
                    crate::logging::kprintln!(
                        "kernel: hanging with interrupts off (watchdog-test); the watchdog must reset the board"
                    );
                    cortex_m::interrupt::disable();
                    loop {
                        cortex_m::asm::nop();
                    }
                }
                0
            }
            _ => E_PERM,
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

#[cfg(target_arch = "arm")]
pub use kernel::forget_task;

#[cfg(test)]
mod tests {
    use super::*;
    use core::fmt::Write;

    #[test]
    fn receive_buffers_must_be_in_the_callers_stack() {
        let stack = Some((0x2000_1000, 2048));
        assert!(writable_allowed(0x2000_1100, 64, stack));
        assert!(!writable_allowed(0x0800_1234, 16, stack)); // flash: read-only
        assert!(!writable_allowed(0x2000_0000, 4, stack)); // kernel RAM
        assert!(!writable_allowed(0x2000_17F0, 32, stack)); // runs off the stack
        assert!(!writable_allowed(0x2000_1100, 4, None));
    }

    #[test]
    fn error_codes_are_distinct_and_named() {
        let codes = [
            E_PERM,
            E_AGAIN,
            E_FULL,
            E_TOOLONG,
            E_NOTASK,
            E_TIMEOUT,
            E_BLOCKED,
            E_NOT_OWNER,
            E_BAD_MUTEX,
            E_DEADLOCK,
            E_MUTEX_FULL,
            E_SEMAPHORE_FULL,
            E_SEMAPHORE_OVERFLOW,
            E_BAD_SEMAPHORE,
            E_NOT_SUPPORTED,
            E_NOCAP,
            E_NOENT,
            E_BUSY,
            E_OWNER_DIED,
        ];
        assert!(codes.iter().all(|&c| c >= E_LOWEST));
        for (i, a) in codes.iter().enumerate() {
            assert_ne!(error_name(*a), "?");
            for b in &codes[i + 1..] {
                assert_ne!(a, b);
            }
        }
        assert!(
            64 < E_NOTASK,
            "a message length can never look like an error"
        );
    }

    #[test]
    fn any_task_may_park_but_other_calls_need_their_capability() {
        assert!(call_allowed(0, SYS_PARK));
        assert!(!call_allowed(0, SYS_WRITE));
        assert!(!call_allowed(0, SYS_SLEEP));
        assert!(call_allowed(maataa_capsule::cap::WRITE, SYS_WRITE));
        assert!(!call_allowed(maataa_capsule::cap::ALL, SYS_PARK + 1));
        // No capability bit names park, so no manifest can grant or deny it.
        assert_eq!(maataa_capsule::cap::ALL & (1 << SYS_PARK), 0);
    }

    #[test]
    fn uart_syscall_transfer_is_bounded() {
        assert!(uart_len_allowed(0));
        assert!(uart_len_allowed(MAX_UART_TRANSFER));
        assert!(!uart_len_allowed(MAX_UART_TRANSFER + 1));
    }

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
