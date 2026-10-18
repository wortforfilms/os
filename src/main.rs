#![no_std]
#![no_main]

use cortex_m_rt::{entry, exception};
#[cfg(feature = "board-qemu-f405")]
use cortex_m_semihosting::debug;
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
mod sched;
#[path = "storage/mod.rs"]
mod storage;

#[cfg(feature = "board-qemu-f405")]
#[repr(align(8))]
struct DemoStack([u8; 1024]);

#[cfg(feature = "board-qemu-f405")]
static mut TASK_ONE_STACK: DemoStack = DemoStack([0; 1024]);
#[cfg(feature = "board-qemu-f405")]
static mut TASK_TWO_STACK: DemoStack = DemoStack([0; 1024]);
#[cfg(feature = "board-qemu-f405")]
static mut TASK_THREE_STACK: DemoStack = DemoStack([0; 1024]);

#[cfg(feature = "board-qemu-f405")]
fn demo_task_one() -> ! {
    logging::kprintln!("task 1");
    cortex_m::asm::delay(1_000_000);
    loop {
        cortex_m::asm::wfi();
    }
}

#[cfg(feature = "board-qemu-f405")]
fn demo_task_two() -> ! {
    logging::kprintln!("task 2");
    cortex_m::asm::delay(1_000_000);
    loop {
        cortex_m::asm::wfi();
    }
}

#[cfg(feature = "board-qemu-f405")]
fn demo_task_three() -> ! {
    logging::kprintln!("task 3");
    cortex_m::asm::delay(1_000_000);
    debug::exit(debug::EXIT_SUCCESS);
    loop {
        cortex_m::asm::wfi();
    }
}

#[cfg(feature = "board-qemu-f405")]
fn task_stack(stack: *mut DemoStack) -> &'static mut [u8] {
    // SAFETY: each private static stack is handed to exactly one scheduler task.
    unsafe { core::slice::from_raw_parts_mut(stack.cast::<u8>(), 1024) }
}

#[entry]
fn main() -> ! {
    board::init_logging();
    logging::kprintln!("Maataa OS starting...");
    logging::kprintln!("Kernel output initialized");

    // The board sets up its clock tree and reports the core clock; the kernel
    // clock starts from that value before anything else reads time.
    let core_hz = board::init_core_clock();
    let config = clock::Config::for_core_hz(core_hz).expect("core clock gives a whole 1 kHz tick");
    let mut core = cortex_m::Peripherals::take().expect("core peripherals are taken once");
    clock::start(&mut core.SYST, config);

    kernel::run();

    #[cfg(feature = "board-qemu-f405")]
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
            });
        if added.is_err()
            || sched::start_round_robin(queue, sched::DEFAULT_DEMO_QUANTUM_MS, &mut core.SCB)
                .is_err()
        {
            loop {
                cortex_m::asm::wfi();
            }
        }
    }

    loop {
        cortex_m::asm::wfi();
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
