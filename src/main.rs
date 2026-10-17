#![no_std]
#![no_main]

use cortex_m_rt::{entry, exception};
use cortex_m_semihosting::hprintln;
use panic_halt as _;

#[path = "capsule/mod.rs"]
mod capsule;
mod clock;
mod drivers;
mod ipc;
mod kernel;
mod log;
#[path = "storage/mod.rs"]
mod storage;

#[entry]
fn main() -> ! {
    hprintln!("Maataa OS starting in QEMU...");
    hprintln!("Cortex-M semihosting prototype boot");

    // The kernel clock starts before anything else reads time.
    let mut core = cortex_m::Peripherals::take().expect("core peripherals are taken once");
    clock::start(&mut core.SYST);

    kernel::run()
}

/// SysTick exception: one kernel tick. Defined in the binary so the vector
/// table always links it (a handler only in a library can be dropped in
/// favour of the default handler).
#[exception]
fn SysTick() {
    clock::on_systick();
}
