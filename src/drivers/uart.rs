use super::{Driver, DriverError};
use defmt::info;

pub struct UartDriver {
    initialized: bool,
    baud_rate: u32,
}

impl UartDriver {
    pub const fn new() -> Self {
        Self {
            initialized: false,
            baud_rate: 115200,
        }
    }
    
    pub fn write(&self, data: &[u8]) -> Result<usize, DriverError> {
        if !self.initialized {
            return Err(DriverError::NotSupported);
        }
        
        info!("📤 UART writing {} bytes", data.len());
        Ok(data.len())
    }
    
    pub fn read(&self, buffer: &mut [u8]) -> Result<usize, DriverError> {
        if !self.initialized {
            return Err(DriverError::NotSupported);
        }
        
        info!("📥 UART reading into {} byte buffer", buffer.len());
        Ok(0)
    }
}

impl Driver for UartDriver {
    fn init(&mut self) -> Result<(), DriverError> {
        info!("🔧 Initializing UART at {} baud", self.baud_rate);
        self.initialized = true;
        Ok(())
    }
    
    fn deinit(&mut self) -> Result<(), DriverError> {
        info!("🔧 Deinitializing UART");
        self.initialized = false;
        Ok(())
    }
    
    fn is_ready(&self) -> bool {
        self.initialized
    }
}

static mut UART: UartDriver = UartDriver::new();

pub fn init() -> Result<(), DriverError> {
    unsafe { UART.init() }
}

pub fn write(data: &[u8]) -> Result<usize, DriverError> {
    unsafe { UART.write(data) }
}