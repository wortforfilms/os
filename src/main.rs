#![no_std]
#![no_main]
// The binary compiles the kernel modules itself (`mod` below), so items that
// only the library API (src/lib.rs) or the host tests use look unused here.
#![allow(dead_code)]

use cortex_m_rt::{entry, exception};

mod board;
#[path = "capsule/mod.rs"]
mod capsule;
mod capsule_task;
mod clock;
mod crash;
mod drivers;
mod hostauth;
mod hostlink;
mod installed;
mod ipc;
mod kernel;
mod log;
mod logging;
mod mpu;
mod sched;
#[path = "storage/mod.rs"]
mod storage;
mod syscall;
mod watchdog;

#[cfg(all(
    target_arch = "arm",
    feature = "hw-f4",
    not(feature = "board-qemu-f405")
))]
use stm32f4xx_hal::pac::interrupt;

/// Task stacks are 2 KB and aligned to 2 KB so each can be one MPU region.
const TASK_STACK_BYTES: usize = 2048;

#[repr(C, align(2048))]
struct DemoStack([u8; TASK_STACK_BYTES]);

static mut TASK_ONE_STACK: DemoStack = DemoStack([0; TASK_STACK_BYTES]);
static mut TASK_TWO_STACK: DemoStack = DemoStack([0; TASK_STACK_BYTES]);
static mut TASK_THREE_STACK: DemoStack = DemoStack([0; TASK_STACK_BYTES]);
static mut TASK_FOUR_STACK: DemoStack = DemoStack([0; TASK_STACK_BYTES]);
static mut TASK_FIVE_STACK: DemoStack = DemoStack([0; TASK_STACK_BYTES]);
static mut TASK_SIX_STACK: DemoStack = DemoStack([0; TASK_STACK_BYTES]);

/// A WebAssembly capsule task needs room for the interpreter's fixed stacks
/// and the capsule's 4 KiB memory; 16 KiB, aligned to 16 KiB so it is still
/// one MPU region.
const CAPSULE_STACK_BYTES: usize = 16384;

#[repr(C, align(16384))]
struct CapsuleStack([u8; CAPSULE_STACK_BYTES]);

static mut TASK_SEVEN_STACK: CapsuleStack = CapsuleStack([0; CAPSULE_STACK_BYTES]);
static mut TASK_EIGHT_STACK: CapsuleStack = CapsuleStack([0; CAPSULE_STACK_BYTES]);

/// Task 9 (the run-time capsule) has a capsule stack too; it also keeps its
/// own copy of the installed image (at most 4 KiB) on it.
static mut TASK_NINE_STACK: CapsuleStack = CapsuleStack([0; CAPSULE_STACK_BYTES]);

// A capsule task runs unprivileged and may not read kernel memory, so `main`
// hands it its grant through the task's own stack: the grant is written at
// the lowest address of the stack (the end the stack grows towards and reaches
// only on overflow) before the scheduler starts, and the task reads it first.

// The tasks below run unprivileged inside their MPU regions: they reach the
// log and the LED only through supervisor calls (src/syscall.rs), and only
// the calls in their capability mask. Task 6 (host channel) gets its mask
// from its signed capsule manifest (assets/capsules/hostlink.mcap).

use maataa_capsule::cap;

const TASK_ONE_CAPS: u32 = cap::WRITE | cap::LED | cap::SLEEP | cap::MUTEX | cap::SEND;
#[cfg(all(feature = "kernel-stack-test", feature = "watchdog-test"))]
compile_error!("kernel-stack-test and watchdog-test both use syscall 4; pick one");
#[cfg(not(any(feature = "kernel-stack-test", feature = "watchdog-test")))]
const TASK_TWO_CAPS: u32 = cap::WRITE | cap::RECV | cap::MUTEX | cap::SEMAPHORE;
#[cfg(any(feature = "kernel-stack-test", feature = "watchdog-test"))]
const TASK_TWO_CAPS: u32 = cap::WRITE | cap::RECV | cap::MUTEX | cap::SEMAPHORE | cap::TEST;
/// Task 3 tests misuse; it may not touch the LED, and checks that it cannot.
const TASK_THREE_CAPS: u32 = cap::WRITE
    | cap::SEND
    | cap::RECV
    | cap::SLEEP
    | cap::SEMAPHORE
    | cap::DEMO_DONE
    | cap::UART_WRITE;
/// Task 4 takes mutex 2 before its protection test, so it dies holding it.
const TASK_FOUR_CAPS: u32 = cap::WRITE | cap::MUTEX;
const TASK_FIVE_CAPS: u32 = cap::WRITE;

// Scheduling levels (src/sched/mod.rs, PriorityRoundRobin): higher runs
// first, round-robin within a level, idle is 0. Task 1 blinks forever at the
// lowest application level, so everything above it must block (sleep, wait
// or park) when it has nothing to do. Capsules choose 1..=4 in their signed
// manifest; the host channel sits above all of them.
const TASK_ONE_PRIORITY: u8 = 1;
#[cfg(not(feature = "inversion-test"))]
const TASK_TWO_PRIORITY: u8 = 3;
#[cfg(not(feature = "inversion-test"))]
const TASK_THREE_PRIORITY: u8 = 2;
// inversion-test: task 1 low (L), task 2 middle (M), task 3 high (H).
#[cfg(feature = "inversion-test")]
const TASK_TWO_PRIORITY: u8 = 2;
#[cfg(feature = "inversion-test")]
const TASK_THREE_PRIORITY: u8 = 3;
const TASK_FOUR_PRIORITY: u8 = 2;
const TASK_FIVE_PRIORITY: u8 = 2;
const HOST_CHANNEL_PRIORITY: u8 = 6;

#[cfg(not(feature = "inversion-test"))]
const TASK_ONE_ENTRY: fn() -> ! = demo_task_one;
#[cfg(not(feature = "inversion-test"))]
const TASK_TWO_ENTRY: fn() -> ! = demo_task_two;
#[cfg(not(feature = "inversion-test"))]
const TASK_THREE_ENTRY: fn() -> ! = demo_task_three;
#[cfg(not(feature = "inversion-test"))]
const INVERSION_EXTRA_CAPS: u32 = 0;
#[cfg(feature = "inversion-test")]
const TASK_ONE_ENTRY: fn() -> ! = inversion::low;
#[cfg(feature = "inversion-test")]
const TASK_TWO_ENTRY: fn() -> ! = inversion::middle;
#[cfg(feature = "inversion-test")]
const TASK_THREE_ENTRY: fn() -> ! = inversion::high;
/// The inversion tasks also sleep, lock and read kernel key 3.
#[cfg(feature = "inversion-test")]
const INVERSION_EXTRA_CAPS: u32 = cap::SLEEP | cap::MUTEX | cap::STORE_GET;

/// Test only (`inversion-test`, scripts/qemu-inversion-test.sh): the
/// classic priority inversion. L (task 1, level 1) takes mutex 1 and works;
/// H (task 3, level 3) waits for it; M (task 2, level 2) then computes for
/// a long time (over a second). With priority inheritance L runs at H's
/// level until it unlocks, so H gets the lock before M finishes. Built with
/// `pi-off`, M starves L while L holds the lock (the starvation monitor
/// reports task 1) and H waits for M. Either way M starves level 1 once L has
/// unlocked: that is strict priority, not inversion.
#[cfg(feature = "inversion-test")]
mod inversion {
    use crate::syscall;

    /// Work in units of a million cycles, so the log shows progress.
    fn work(units: u32) {
        for _ in 0..units {
            cortex_m::asm::delay(1_000_000);
        }
    }

    pub fn low() -> ! {
        match syscall::mutex_lock(1) {
            Ok(_) => crate::uprintln!("inversion: L holds mutex 1"),
            Err(e) => crate::uprintln!("inversion: L lock failed: {}", syscall::error_name(e)),
        }
        work(super::INVERSION_L_UNITS);
        let _ = syscall::mutex_unlock(1);
        crate::uprintln!("inversion: L released mutex 1");
        syscall::park_forever()
    }

    pub fn middle() -> ! {
        // Start after H is already waiting for L.
        let _ = syscall::sleep_ms(20);
        crate::uprintln!("inversion: M computing");
        work(super::INVERSION_M_UNITS);
        crate::uprintln!("inversion: M done");
        let _ = syscall::semaphore_post(1);
        syscall::park_forever()
    }

    pub fn high() -> ! {
        // Let L take the lock first.
        let _ = syscall::sleep_ms(10);
        crate::uprintln!("inversion: H waits for mutex 1");
        match syscall::mutex_lock(1) {
            Ok(_) => crate::uprintln!("inversion: H got mutex 1"),
            Err(e) => crate::uprintln!("inversion: H lock failed: {}", syscall::error_name(e)),
        }
        let _ = syscall::mutex_unlock(1);
        // Wait for M to finish, so the log shows the whole order.
        let _ = syscall::semaphore_wait(1);
        let mut count = [0u8; 4];
        let _ = syscall::store_get(3, &mut count);
        crate::uprintln!(
            "inversion: starvation episodes {}",
            u32::from_le_bytes(count)
        );
        syscall::demo_done();
        syscall::park_forever()
    }
}

#[cfg(feature = "inversion-test")]
const INVERSION_L_UNITS: u32 = 40;
#[cfg(feature = "inversion-test")]
const INVERSION_M_UNITS: u32 = 300;

#[cfg_attr(feature = "inversion-test", allow(dead_code))]
fn demo_task_one() -> ! {
    crate::uprintln!("task 1");
    match syscall::mutex_lock(0) {
        Ok(_) => crate::uprintln!("task 1: mutex 0 acquired; holding through 2000 ms sleep"),
        Err(e) => crate::uprintln!("task 1: mutex lock failed: {}", syscall::error_name(e)),
    }
    crate::uprintln!("task 1: sleeping for 2000 ms");
    match syscall::sleep_ms(2_000) {
        Ok(()) => crate::uprintln!("task 1: woke after its timer"),
        Err(e) => crate::uprintln!("task 1: sleep failed: {}", syscall::error_name(e)),
    }
    match syscall::mutex_unlock(0) {
        Ok(()) => crate::uprintln!("task 1: mutex 0 unlocked; queued owner may continue"),
        Err(e) => crate::uprintln!("task 1: mutex unlock failed: {}", syscall::error_name(e)),
    }
    // IPC: the kernel copies these bytes into its queue for task 2.
    match syscall::send(2, b"Hello from Task 1") {
        Ok(()) => crate::uprintln!("task 1: sent a message to task 2"),
        Err(e) => crate::uprintln!("task 1: send failed: {}", syscall::error_name(e)),
    }
    // Blink LD2 with busy waits and never yield: the LED keeps blinking only
    // because the scheduler preempts this task, and it keeps going with no
    // probe attached. 25 M cycles is 250 ms of this task's own CPU time.
    let mut blinks: u32 = 0;
    loop {
        syscall::led(true);
        cortex_m::asm::delay(25_000_000);
        syscall::led(false);
        cortex_m::asm::delay(25_000_000);
        blinks = blinks.wrapping_add(1);
        if blinks.is_multiple_of(10) {
            crate::uprintln!("task 1: {} blinks", blinks);
        }
    }
}

#[cfg_attr(feature = "inversion-test", allow(dead_code))]
fn demo_task_two() -> ! {
    crate::uprintln!("task 2");
    #[cfg(feature = "kernel-stack-test")]
    syscall::test_kernel_overflow();
    let mut buf = [0u8; 64];
    match syscall::recv_timeout(&mut buf, 1_000) {
        Err(syscall::E_TIMEOUT) => crate::uprintln!("task 2: recv timed out after 1000 ms"),
        Ok((from, n)) => {
            let text = core::str::from_utf8(&buf[..n]).unwrap_or("<not UTF-8>");
            crate::uprintln!("task 2: received early from task {}: {}", from, text);
        }
        Err(e) => crate::uprintln!("task 2: first recv failed: {}", syscall::error_name(e)),
    }
    // A second wait demonstrates message-driven wakeup after the first timeout.
    match syscall::recv_timeout(&mut buf, 2_000) {
        Ok((from, n)) => {
            let text = core::str::from_utf8(&buf[..n]).unwrap_or("<not UTF-8>");
            crate::uprintln!(
                "task 2: received from task {}: {}; waiting on mutex 0",
                from,
                text
            );
            match syscall::mutex_lock(0) {
                Ok(_) => {
                    crate::uprintln!("task 2: mutex 0 handed off; protected output is serialized");
                    if let Err(e) = syscall::mutex_unlock(0) {
                        crate::uprintln!("task 2: mutex unlock failed: {}", syscall::error_name(e));
                    }
                }
                Err(e) => crate::uprintln!("task 2: mutex lock failed: {}", syscall::error_name(e)),
            }
        }
        Err(e) => crate::uprintln!("task 2: second recv failed: {}", syscall::error_name(e)),
    }
    match syscall::semaphore_wait(0) {
        Ok(()) => crate::uprintln!("task 2: semaphore 0 permit received; producer wake verified"),
        Err(e) => crate::uprintln!("task 2: semaphore wait failed: {}", syscall::error_name(e)),
    }
    // Task 4 died holding mutex 2 (the MPU test): the next owner is told.
    match syscall::mutex_lock(2) {
        Ok(syscall::Acquired::OwnerDied) => {
            crate::uprintln!("task 2: mutex 2: its owner died holding it (EOWNERDEAD); recovered");
            let _ = syscall::mutex_unlock(2);
        }
        Ok(syscall::Acquired::Clean) => {
            crate::uprintln!("task 2: mutex 2 acquired clean: OWNER DEATH NOT REPORTED");
            let _ = syscall::mutex_unlock(2);
        }
        Err(e) => crate::uprintln!("task 2: mutex 2 lock failed: {}", syscall::error_name(e)),
    }
    svc_error_paths();
    #[cfg(feature = "watchdog-test")]
    {
        crate::uprintln!("watchdog test: asking the kernel to hang");
        syscall::test_watchdog();
        crate::uprintln!("watchdog test: PASS; the last reset came from the watchdog, so the kernel did not hang again");
    }
    // USART2 belongs to the host channel (task 6); see docs/host-channel.md.
    syscall::park_forever()
}

/// Task 2 makes calls the kernel must refuse and prints what comes back
/// through the `svc` instruction (smoke check 8, docs/SVC_TEST_COVERAGE.md).
/// Mutex 3 and semaphore 3 are used by no other demo task.
#[cfg_attr(feature = "inversion-test", allow(dead_code))]
fn svc_error_paths() {
    let show = |what: &str, result: Result<(), u32>| match result {
        Ok(()) => crate::uprintln!("task 2: svc error {} -> ok (NOT REFUSED)", what),
        Err(e) => crate::uprintln!("task 2: svc error {} -> {}", what, syscall::error_name(e)),
    };
    show("mutex_lock(4)", syscall::mutex_lock(4).map(|_| ()));
    show("mutex_unlock(3) unowned", syscall::mutex_unlock(3));
    if syscall::mutex_lock(3).is_ok() {
        show("mutex_lock(3) twice", syscall::mutex_lock(3).map(|_| ()));
        let parked = syscall::park();
        show(
            "park holding mutex 3",
            if parked == 0 { Ok(()) } else { Err(parked) },
        );
        let _ = syscall::mutex_unlock(3);
    }
    show("semaphore_wait(4)", syscall::semaphore_wait(4));
    show("semaphore_post(4)", syscall::semaphore_post(4));
    // Semaphore 3 holds at most u16::MAX permits: the next post overflows.
    let mut posts = 0u32;
    let overflow = loop {
        match syscall::semaphore_post(3) {
            Ok(()) => posts += 1,
            Err(e) => break e,
        }
        if posts > u32::from(u16::MAX) {
            break 0;
        }
    };
    crate::uprintln!(
        "task 2: svc error semaphore_post(3) after {} permits -> {}",
        posts,
        syscall::error_name(overflow)
    );
    // A call number no capability bit names: refused at the mask.
    let mut r0 = 0u32;
    // SAFETY: no memory is passed; the kernel only writes r0.
    unsafe { core::arch::asm!("svc #20", inout("r0") r0) };
    show("svc #20", if r0 == 0 { Ok(()) } else { Err(r0) });
}

#[cfg_attr(feature = "inversion-test", allow(dead_code))]
fn demo_task_three() -> ! {
    crate::uprintln!("task 3");
    #[cfg(all(feature = "hw-f4", not(feature = "board-qemu-f405")))]
    {
        let payload = b"task 3: direct SVC #12 UART write verified\r\n";
        match syscall::uart_write(payload) {
            Ok(count) if count == payload.len() => {
                crate::uprintln!("task 3: SVC #12 wrote {} bytes", count)
            }
            Ok(count) => crate::uprintln!("task 3: SVC #12 short write {}", count),
            Err(error) => {
                crate::uprintln!("task 3: SVC #12 failed: {}", syscall::error_name(error))
            }
        }
    }
    // IPC misuse: the kernel must refuse each of these without touching the memory.
    let kernel_word = core::ptr::addr_of!(mpu::FAULT_TEST_TARGET) as *const u8;
    let r = syscall::send_raw(2, kernel_word, 4);
    crate::uprintln!(
        "task 3: send from kernel memory -> {}",
        syscall::error_name(r)
    );
    let flash = b"read-only".as_ptr() as *mut u8;
    let (r, _) = syscall::recv_raw(flash, 9);
    crate::uprintln!("task 3: recv into flash -> {}", syscall::error_name(r));
    let r = syscall::send_raw(12, b"hi".as_ptr(), 2);
    crate::uprintln!("task 3: send to task 12 -> {}", syscall::error_name(r));
    // Capability check: task 3 holds no LED capability.
    let r = syscall::led_checked(true);
    crate::uprintln!(
        "task 3: led without capability -> {}",
        syscall::error_name(r)
    );
    // Length limits, checked before anything is copied.
    let long = [0u8; 257];
    let r = syscall::send_raw(1, long.as_ptr(), 65);
    crate::uprintln!("task 3: send of 65 bytes -> {}", syscall::error_name(r));
    let r = match syscall::uart_write(&long) {
        Ok(_) => 0,
        Err(e) => e,
    };
    crate::uprintln!(
        "task 3: uart write of 257 bytes -> {}",
        syscall::error_name(r)
    );
    // A full kernel queue (16 slots, shared by all tasks): task 3 fills it
    // with messages to itself and takes them all back at once, so nothing
    // else is ever refused. No other task sends this early (task 3 itself
    // after 1500 ms, task 1 after 2000 ms).
    let mut queued = 0u32;
    let full = loop {
        match syscall::send(3, b"q") {
            Ok(()) => queued += 1,
            Err(e) => break e,
        }
        if queued > 64 {
            break 0;
        }
    };
    let mut one = [0u8; 1];
    let mut back = 0u32;
    while syscall::recv(&mut one).is_ok() {
        back += 1;
    }
    crate::uprintln!(
        "task 3: send to itself: {} queued, then {}; {} received back",
        queued,
        syscall::error_name(full),
        back
    );
    crate::uprintln!("task 3: sleeping for 1500 ms before sending");
    let _ = syscall::sleep_ms(1_500);
    match syscall::send(2, b"Hello from Task 3 after 1500 ms") {
        Ok(()) => crate::uprintln!("task 3: sent after delay; task 2 should wake"),
        Err(e) => crate::uprintln!("task 3: delayed send failed: {}", syscall::error_name(e)),
    }
    // Keep QEMU alive long enough for task 1's 2000 ms sleep to complete.
    let _ = syscall::sleep_ms(1_000);
    match syscall::semaphore_post(0) {
        Ok(()) => crate::uprintln!("task 3: posted semaphore 0 permit"),
        Err(e) => crate::uprintln!("task 3: semaphore post failed: {}", syscall::error_name(e)),
    }
    let _ = syscall::sleep_ms(100);
    // A real board ignores demo_done and keeps the tasks switching.
    syscall::demo_done();
    syscall::park_forever()
}

/// The MPU test: write to a kernel word. The MPU must stop the write, the
/// kernel must kill this task, and the other tasks must keep running.
fn demo_task_four() -> ! {
    // Die holding a lock: the kernel must hand mutex 2 on with EOWNERDEAD.
    if syscall::mutex_lock(2).is_ok() {
        crate::uprintln!("task 4: holding mutex 2");
    }
    let target = core::ptr::addr_of_mut!(mpu::FAULT_TEST_TARGET);
    crate::uprintln!(
        "task 4: writing to kernel memory at {:#010x}",
        target as usize
    );
    // SAFETY: deliberately not safe; this is the protection test.
    unsafe { target.write_volatile(0xDEAD_BEEF) };
    crate::uprintln!("task 4: the write went through: MEMORY IS NOT PROTECTED");
    syscall::park_forever()
}

/// Recurses with a 64-byte frame until the 2 KB stack runs out.
#[inline(never)]
#[allow(unconditional_recursion)]
fn recurse(depth: u32) -> u32 {
    let frame = core::hint::black_box([depth as u8; 64]);
    recurse(depth + 1).wrapping_add(frame[3] as u32)
}

/// The stack-overflow test: the kernel must kill only this task.
fn demo_task_five() -> ! {
    crate::uprintln!("task 5: recursing until the stack overflows");
    let n = recurse(0);
    crate::uprintln!("task 5: returned {}: THE OVERFLOW WAS NOT CAUGHT", n);
    syscall::park_forever()
}

/// A kernel panic: record it for the next boot (src/crash.rs), report it, and
/// stop. On the F411 the watchdog then resets the board.
#[panic_handler]
fn panic(info: &core::panic::PanicInfo) -> ! {
    let line = info.location().map_or(0, |l| l.line());
    crash::record(crash::CrashKind::Panic, line, 0);
    // Location only: formatting the panic message would pull about 3 KB of
    // formatting code into the kernel (docs/size.md). The crash record keeps
    // the line for the next boot.
    match info.location() {
        Some(l) => logging::kprintln!("KERNEL PANIC at {}:{}; system stopped", l.file(), l.line()),
        None => logging::kprintln!("KERNEL PANIC; system stopped"),
    }
    loop {
        cortex_m::asm::nop();
    }
}

/// Runs the capsule whose grant `main` left at the base of `stack`.
fn capsule_from_stack(stack: *const CapsuleStack) -> ! {
    // SAFETY: the base of this task's own stack, written by `main` before the
    // scheduler started and not yet reached by the stack.
    let grant = unsafe { stack.cast::<capsule_task::CapsuleGrant>().read() };
    capsule_task::run(grant.name, grant.image)
}

/// Task 7: the first verified WebAssembly capsule.
fn capsule_task_seven() -> ! {
    capsule_from_stack(core::ptr::addr_of!(TASK_SEVEN_STACK))
}

/// Task 8: the second verified WebAssembly capsule.
fn capsule_task_eight() -> ! {
    capsule_from_stack(core::ptr::addr_of!(TASK_EIGHT_STACK))
}

/// Task 9: the capsule installed at run time. The kernel copies its image
/// into this task's stack (checking it again on the way) through syscall 18.
fn installed_capsule_task() -> ! {
    let mut image = [0u8; installed::MAX_IMAGE];
    match syscall::capsule_image(&mut image) {
        Ok(len) => {
            let image = &image[..len];
            let name = maataa_capsule::name_unverified(image).unwrap_or("installed");
            capsule_task::run(name, image)
        }
        Err(e) => {
            crate::uprintln!("capsule task 9: no image: {}", syscall::error_name(e));
            syscall::park_forever()
        }
    }
}

/// Task 6: the host channel on USART2 (src/hostlink.rs).
fn host_channel_task() -> ! {
    hostlink::channel_task()
}

fn task_stack(stack: *mut DemoStack) -> &'static mut [u8] {
    // SAFETY: each private static stack is handed to exactly one scheduler task.
    unsafe { core::slice::from_raw_parts_mut(stack.cast::<u8>(), TASK_STACK_BYTES) }
}

#[entry]
fn main() -> ! {
    board::init_logging();
    // The board sets up its clock tree and reports the core clock; the kernel
    // clock starts from that value before anything else reads time.
    let core_hz = board::init_core_clock();
    logging::kprintln!("Maataa OS starting...");
    logging::kprintln!("Kernel output initialized");
    board::led_init();
    let config = clock::Config::for_core_hz(core_hz).expect("core clock gives a whole 1 kHz tick");
    let mut core = cortex_m::Peripherals::take().expect("core peripherals are taken once");
    clock::start(&mut core.SYST, config);

    let grants = kernel::run();
    // From here the scheduler tick must keep running (src/watchdog.rs).
    watchdog::start();

    {
        let mut queue = sched::RunQueue::<{ sched::MAX_TASKS }>::new();
        let added = queue
            .add(
                sched::Task::new(
                    1,
                    task_stack(core::ptr::addr_of_mut!(TASK_ONE_STACK)),
                    TASK_ONE_ENTRY,
                    TASK_ONE_PRIORITY,
                )
                .with_capabilities(TASK_ONE_CAPS),
            )
            .and_then(|()| {
                queue.add(
                    sched::Task::new(
                        2,
                        task_stack(core::ptr::addr_of_mut!(TASK_TWO_STACK)),
                        TASK_TWO_ENTRY,
                        TASK_TWO_PRIORITY,
                    )
                    .with_capabilities(TASK_TWO_CAPS | INVERSION_EXTRA_CAPS),
                )
            })
            .and_then(|()| {
                queue.add(
                    sched::Task::new(
                        3,
                        task_stack(core::ptr::addr_of_mut!(TASK_THREE_STACK)),
                        TASK_THREE_ENTRY,
                        TASK_THREE_PRIORITY,
                    )
                    .with_capabilities(TASK_THREE_CAPS | INVERSION_EXTRA_CAPS),
                )
            })
            .and_then(|()| {
                queue.add(
                    sched::Task::new(
                        4,
                        task_stack(core::ptr::addr_of_mut!(TASK_FOUR_STACK)),
                        demo_task_four,
                        TASK_FOUR_PRIORITY,
                    )
                    .with_capabilities(TASK_FOUR_CAPS),
                )
            })
            .and_then(|()| {
                queue.add(
                    sched::Task::new(
                        5,
                        task_stack(core::ptr::addr_of_mut!(TASK_FIVE_STACK)),
                        demo_task_five,
                        TASK_FIVE_PRIORITY,
                    )
                    .with_capabilities(TASK_FIVE_CAPS),
                )
            })
            .and_then(|()| {
                queue.add(
                    sched::Task::new(
                        6,
                        task_stack(core::ptr::addr_of_mut!(TASK_SIX_STACK)),
                        host_channel_task,
                        HOST_CHANNEL_PRIORITY,
                    )
                    .with_capabilities(grants.hostlink)
                    .with_store_owner(storage::persist::Owner::Host as u8),
                )
            })
            .and_then(|()| {
                // Tasks 7 and 8 run the verified WebAssembly capsules, each
                // with the capabilities its own manifest grants.
                let slots: [(*mut CapsuleStack, fn() -> !); capsule_task::CAPSULE_TASKS] = [
                    (
                        core::ptr::addr_of_mut!(TASK_SEVEN_STACK),
                        capsule_task_seven,
                    ),
                    (
                        core::ptr::addr_of_mut!(TASK_EIGHT_STACK),
                        capsule_task_eight,
                    ),
                ];
                for (index, (stack, body)) in slots.into_iter().enumerate() {
                    let Some(grant) = grants.capsule_tasks[index] else {
                        continue;
                    };
                    // SAFETY: each static stack is handed to exactly one task;
                    // the grant goes at its base (see capsule_from_stack).
                    let stack = unsafe {
                        stack.cast::<capsule_task::CapsuleGrant>().write(grant);
                        core::slice::from_raw_parts_mut(stack.cast::<u8>(), CAPSULE_STACK_BYTES)
                    };
                    queue.add(
                        sched::Task::new(
                            kernel::CAPSULE_TASK_IDS[index],
                            stack,
                            body,
                            grant.priority,
                        )
                        .with_capabilities(grant.capabilities)
                        .with_store_owner(storage::persist::Owner::for_capsule(grant.name) as u8),
                    )?;
                }
                // Task 9: the run-time capsule, with its signed capabilities
                // plus the one call that hands it its image.
                if let Some((capabilities, priority, owner)) = grants.installed {
                    // SAFETY: the static stack is handed to this one task.
                    let stack = unsafe {
                        core::slice::from_raw_parts_mut(
                            core::ptr::addr_of_mut!(TASK_NINE_STACK).cast::<u8>(),
                            CAPSULE_STACK_BYTES,
                        )
                    };
                    queue.add(
                        sched::Task::new(
                            kernel::INSTALLED_TASK_ID,
                            stack,
                            installed_capsule_task,
                            priority,
                        )
                        .with_capabilities(capabilities | maataa_capsule::cap::CAPSULE_IMAGE)
                        .with_store_owner(owner as u8),
                    )?;
                }
                Ok(())
            });
        let started = added.is_ok()
            && match sched::start(queue, sched::DEFAULT_DEMO_QUANTUM_MS, &mut core.SCB) {
                Ok(()) => true,
                Err(e) => {
                    logging::kprintln!("scheduler did not start: {}", e.as_str());
                    false
                }
            };
        if !started {
            loop {
                clock::idle();
            }
        }
    }

    loop {
        clock::idle();
    }
}

/// SysTick exception: one kernel tick. Defined in the binary so the vector
/// table always links it (a handler only in a library can be dropped in
/// favour of the default handler).
#[exception]
fn SysTick() {
    clock::on_systick();
    sched::on_systick();
}

/// USART2 RXNE interrupt. The handler only moves received bytes into the
/// driver's fixed FIFO; task scheduling and SVC reads stay outside the ISR.
#[cfg(all(
    target_arch = "arm",
    feature = "hw-f4",
    not(feature = "board-qemu-f405")
))]
#[interrupt]
fn USART2() {
    drivers::uart::on_receive_interrupt();
}

/// QEMU build: no device crate supplies named interrupt vectors, so device
/// interrupts arrive here with their number. USART2 is the only one enabled.
#[cfg(all(target_arch = "arm", feature = "board-qemu-f405"))]
#[exception]
unsafe fn DefaultHandler(irqn: i16) {
    if irqn == drivers::uart::USART2_IRQ as i16 {
        drivers::uart::on_receive_interrupt();
        return;
    }
    // Any other unexpected interrupt: stop here, as cortex-m-rt's default does.
    loop {
        cortex_m::asm::nop();
    }
}
