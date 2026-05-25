#![no_std]
#![no_main]

use cortex_m_rt::entry;
use panic_halt as _;
use defmt_rtt as _;

#[entry]
fn main() -> ! {
    defmt::info!("📡 Sensor Read Example Starting");
    
    let mut sensor_data = [0u8; 8];
    let mut counter = 0;
    
    loop {
        // Simulate reading from different sensors
        sensor_data[0] = counter; // Temperature
        sensor_data[1] = counter.wrapping_mul(2); // Humidity  
        sensor_data[2] = counter.wrapping_add(10); // Pressure
        
        defmt::info!(
            "📊 Sensor Data [{}]: T={}, H={}, P={}",
            counter,
            sensor_data[0],
            sensor_data[1], 
            sensor_data[2]
        );
        
        counter = counter.wrapping_add(1);
        cortex_m::asm::delay(16_000_000); // ~2 second delay
    }
}