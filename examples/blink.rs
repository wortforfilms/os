#![no_std]
#![no_main]

use cortex_m_rt::entry;
use panic_halt as _;
use defmt_rtt as _;

#[entry]
fn main() -> ! {
    defmt::info!("💡 Blink example starting");
    
    loop {
        defmt::info!("💡 LED ON");
        cortex_m::asm::delay(8_000_000);
        defmt::info!("💡 LED OFF");
        cortex_m::asm::delay(8_000_000);
    }
}