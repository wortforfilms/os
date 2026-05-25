use super::{Driver, DriverError};
use defmt::info;

pub struct I2cDriver {
    initialized: bool,
    address: u8,
    frequency: u32,
}

impl I2cDriver {
    pub const fn new() -> Self {
        Self {
            initialized: false,
            address: 0,
            frequency: 100_000, // 100 kHz
        }
    }
    
    pub fn write(&self, data: &[u8]) -> Result<(), DriverError> {
        if !self.initialized {
            return Err(DriverError::NotSupported);
        }
        
        info!("📤 I2C write to 0x{:02X}: {} bytes", self.address, data.len());
        Ok(())
    }
    
    pub fn read(&self, buffer: &mut [u8]) -> Result<(), DriverError> {
        if !self.initialized {
            return Err(DriverError::NotSupported);
        }
        
        info!("📥 I2C read from 0x{:02X}: {} bytes", self.address, buffer.len());
        // Placeholder: fill with zeros
        buffer.fill(0);
        Ok(())
    }
    
    pub fn set_address(&mut self, address: u8) {
        self.address = address;
        info!("🔧 I2C address set to: 0x{:02X}", address);
    }
    
    pub fn set_frequency(&mut self, frequency: u32) -> Result<(), DriverError> {
        if frequency > 400_000 {
            return Err(DriverError::NotSupported);
        }
        
        self.frequency = frequency;
        info!("🔧 I2C frequency set to: {} Hz", frequency);
        Ok(())
    }
}

impl Driver for I2cDriver {
    fn init(&mut self) -> Result<(), DriverError> {
        info!("🔧 Initializing I2C driver");
        self.initialized = true;
        Ok(())
    }
    
    fn deinit(&mut self) -> Result<(), DriverError> {
        info!("🔧 Deinitializing I2C driver");
        self.initialized = false;
        Ok(())
    }
    
    fn is_ready(&self) -> bool {
        self.initialized
    }
}

static mut I2C: I2cDriver = I2cDriver::new();

pub fn init() -> Result<(), DriverError> {
    unsafe { I2C.init() }
}

pub fn write(data: &[u8]) -> Result<(), DriverError> {
    unsafe { I2C.write(data) }
}

pub fn set_address(address: u8) {
    unsafe { I2C.set_address(address) }
}