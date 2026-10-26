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

// The tasks below run unprivileged inside their MPU regions: they reach the
// log and the LED only through supervisor calls (src/syscall.rs).

fn demo_task_one() -> ! {
    crate::uprintln!("task 1");
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
    loop {
        clock::idle();
    }
}

fn demo_task_three() -> ! {
    crate::uprintln!("task 3");
    // Long enough for task 4 to run (and be killed) first; then QEMU ends the
    // run. A real board ignores demo_done and keeps the tasks switching.
    cortex_m::asm::delay(50_000_000);
    syscall::demo_done();
    loop {
        clock::idle();
    }
}

/// The MPU test: write to a kernel word. The MPU must stop the write, the
/// kernel must kill this task, and the other tasks must keep running.
fn demo_task_four() -> ! {
    let target = core::ptr::addr_of_mut!(mpu::FAULT_TEST_TARGET);
    crate::uprintln!("task 4: writing to kernel memory at {:#010x}", target as usize);
    // SAFETY: deliberately not safe; this is the protection test.
    unsafe { target.write_volatile(0xDEAD_BEEF) };
    crate::uprintln!("task 4: the write went through: MEMORY IS NOT PROTECTED");
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
    logging::kprintln!("Maataa OS starting...");
    logging::kprintln!("Kernel output initialized");

    // The board sets up its clock tree and reports the core clock; the kernel
    // clock starts from that value before anything else reads time.
    let core_hz = board::init_core_clock();
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
            });
        let started = added.is_ok()
            && match sched::start_round_robin(queue, sched::DEFAULT_DEMO_QUANTUM_MS, &mut core.SCB) {
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

/// HardFault: print where the fault happened before stopping, so a board run
/// over RTT names the instruction instead of only "Exception".
#[exception]
unsafe fn HardFault(ef: &cortex_m_rt::ExceptionFrame) -> ! {
    let scb = &*cortex_m::peripheral::SCB::PTR;
    logging::kprintln!(
        "HARD FAULT pc={:#010x} lr={:#010x} cfsr={:#010x} hfsr={:#010x} bfar={:#010x} mmfar={:#010x}",
        ef.pc(),
        ef.lr(),
        scb.cfsr.read(),
        scb.hfsr.read(),
        scb.bfar.read(),
        scb.mmfar.read()
    );
    loop {
        cortex_m::asm::nop();
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
