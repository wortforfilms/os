#![no_std]
#![no_main]

use cortex_m_rt::{entry, exception};
use panic_halt as _;

mod board;
#[path = "capsule/mod.rs"]
mod capsule;
mod clock;
mod drivers;
mod ipc;
mod kernel;
mod log;
mod logging;
mod mpu;
mod sched;
#[path = "storage/mod.rs"]
mod storage;
mod syscall;

/// Task stacks are 2 KB and aligned to 2 KB so each can be one MPU region.
const TASK_STACK_BYTES: usize = 2048;

#[repr(C, align(2048))]
struct DemoStack([u8; TASK_STACK_BYTES]);

static mut TASK_ONE_STACK: DemoStack = DemoStack([0; TASK_STACK_BYTES]);
static mut TASK_TWO_STACK: DemoStack = DemoStack([0; TASK_STACK_BYTES]);
static mut TASK_THREE_STACK: DemoStack = DemoStack([0; TASK_STACK_BYTES]);
static mut TASK_FOUR_STACK: DemoStack = DemoStack([0; TASK_STACK_BYTES]);
static mut TASK_FIVE_STACK: DemoStack = DemoStack([0; TASK_STACK_BYTES]);

// The tasks below run unprivileged inside their MPU regions: they reach the
// log and the LED only through supervisor calls (src/syscall.rs).

fn demo_task_one() -> ! {
    crate::uprintln!("task 1");
    match syscall::mutex_lock(0) {
        Ok(()) => crate::uprintln!("task 1: mutex 0 acquired; holding through 2000 ms sleep"),
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
        if blinks % 10 == 0 {
            crate::uprintln!("task 1: {} blinks", blinks);
        }
    }
}

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
                Ok(()) => {
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
    loop {
        clock::idle();
    }
}

fn demo_task_three() -> ! {
    crate::uprintln!("task 3");
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
    let r = syscall::send_raw(9, b"hi".as_ptr(), 2);
    crate::uprintln!("task 3: send to task 9 -> {}", syscall::error_name(r));
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
    loop {
        clock::idle();
    }
}

/// The MPU test: write to a kernel word. The MPU must stop the write, the
/// kernel must kill this task, and the other tasks must keep running.
fn demo_task_four() -> ! {
    let target = core::ptr::addr_of_mut!(mpu::FAULT_TEST_TARGET);
    crate::uprintln!(
        "task 4: writing to kernel memory at {:#010x}",
        target as usize
    );
    // SAFETY: deliberately not safe; this is the protection test.
    unsafe { target.write_volatile(0xDEAD_BEEF) };
    crate::uprintln!("task 4: the write went through: MEMORY IS NOT PROTECTED");
    loop {
        clock::idle();
    }
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
    loop {
        clock::idle();
    }
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

    kernel::run();

    {
        let mut queue = sched::RunQueue::<{ sched::MAX_TASKS }>::new();
        let added = queue
            .add(sched::Task::new(
                1,
                task_stack(core::ptr::addr_of_mut!(TASK_ONE_STACK)),
                demo_task_one,
                1,
            ))
            .and_then(|()| {
                queue.add(sched::Task::new(
                    2,
                    task_stack(core::ptr::addr_of_mut!(TASK_TWO_STACK)),
                    demo_task_two,
                    1,
                ))
            })
            .and_then(|()| {
                queue.add(sched::Task::new(
                    3,
                    task_stack(core::ptr::addr_of_mut!(TASK_THREE_STACK)),
                    demo_task_three,
                    1,
                ))
            })
            .and_then(|()| {
                queue.add(sched::Task::new(
                    4,
                    task_stack(core::ptr::addr_of_mut!(TASK_FOUR_STACK)),
                    demo_task_four,
                    1,
                ))
            })
            .and_then(|()| {
                queue.add(sched::Task::new(
                    5,
                    task_stack(core::ptr::addr_of_mut!(TASK_FIVE_STACK)),
                    demo_task_five,
                    1,
                ))
            });
        let started = added.is_ok()
            && match sched::start_round_robin(queue, sched::DEFAULT_DEMO_QUANTUM_MS, &mut core.SCB)
            {
                Ok(()) => true,
                Err(e) => {
                    logging::kprintln!("scheduler did not start: {:?}", e);
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
