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
#[path = "storage/mod.rs"]
mod storage;

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

    kernel::run()
}

/// SysTick exception: one kernel tick. Defined in the binary so the vector
/// table always links it (a handler only in a library can be dropped in
/// favour of the default handler).
#[exception]
fn SysTick() {
    clock::on_systick();
}
