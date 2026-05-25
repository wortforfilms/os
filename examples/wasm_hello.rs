#![no_std]
#![no_main]

use cortex_m_rt::entry;
use panic_halt as _;
use defmt_rtt as _;

#[entry]
fn main() -> ! {
    defmt::info!("🦀 WASM Hello Example Starting");
    
    // This would typically load and execute a WASM module
    // For demonstration, we'll simulate capsule behavior
    
    let mut capsule_counter = 0;
    loop {
        defmt::info!("🎯 WASM Capsule Execution #{}, capsule_counter");
        
        // Simulate calling different WASM functions
        defmt::info!("   📞 Calling: initialize()");
        defmt::info!("   📞 Calling: process_data()");
        defmt::info!("   📞 Calling: get_result()");
        
        defmt::info!("   ✅ Capsule execution completed successfully");
        
        capsule_counter += 1;
        cortex_m::asm::delay(12_000_000); // ~1.5 second delay
    }
}