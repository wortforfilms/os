#![no_std]
#![no_main]

use cortex_m_rt::entry;
use panic_halt as _;
use cortex_m_semihosting::hprintln;

#[path = "capsule/mod.rs"]
mod capsule;
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

    kernel::run()
}
