use super::{Driver, DriverError};
use defmt::info;

pub struct SpiDriver {
    initialized: bool,
    frequency: u32,
    mode: SpiMode,
}

#[derive(Debug, Clone, Copy, defmt::Format)]
pub enum SpiMode {
    Mode0,
    Mode1,
    Mode2,
    Mode3,
}

impl SpiDriver {
    pub const fn new() -> Self {
        Self {
            initialized: false,
            frequency: 1_000_000, // 1 MHz
            mode: SpiMode::Mode0,
        }
    }
    
    pub fn transfer(&self, tx_data: &[u8], rx_data: &mut [u8]) -> Result<usize, DriverError> {
        if !self.initialized {
            return Err(DriverError::NotSupported);
        }
        
        let len = tx_data.len().min(rx_data.len());
        info!("📡 SPI transfer: {} bytes, mode: {:?}, freq: {} Hz", len, self.mode, self.frequency);
        
        // Placeholder: copy tx to rx
        rx_data[..len].copy_from_slice(&tx_data[..len]);
        Ok(len)
    }
    
    pub fn set_frequency(&mut self, frequency: u32) -> Result<(), DriverError> {
        if frequency > 10_000_000 {
            return Err(DriverError::NotSupported);
        }
        
        self.frequency = frequency;
        info!("🔧 SPI frequency set to: {} Hz", frequency);
        Ok(())
    }
    
    pub fn set_mode(&mut self, mode: SpiMode) {
        self.mode = mode;
        info!("🔧 SPI mode set to: {:?}", mode);
    }
}

impl Driver for SpiDriver {
    fn init(&mut self) -> Result<(), DriverError> {
        info!("🔧 Initializing SPI driver");
        self.initialized = true;
        Ok(())
    }
    
    fn deinit(&mut self) -> Result<(), DriverError> {
        info!("🔧 Deinitializing SPI driver");
        self.initialized = false;
        Ok(())
    }
    
    fn is_ready(&self) -> bool {
        self.initialized
    }
}

static mut SPI: SpiDriver = SpiDriver::new();

pub fn init() -> Result<(), DriverError> {
    unsafe { SPI.init() }
}

pub fn transfer(tx_data: &[u8], rx_data: &mut [u8]) -> Result<usize, DriverError> {
    unsafe { SPI.transfer(tx_data, rx_data) }
}