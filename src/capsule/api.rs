use defmt::{info, warn};

#[derive(Debug, defmt::Format)]
pub enum ApiError {
    InvalidParameter,
    NotEnoughMemory,
    OperationFailed,
}

pub struct CapsuleApi;

impl CapsuleApi {
    pub fn new() -> Self {
        Self
    }
    
    pub fn log(&self, message: &str) -> Result<(), ApiError> {
        info!("📝 Capsule: {}", message);
        Ok(())
    }
    
    pub fn get_time(&self) -> u64 {
        // Return uptime in milliseconds
        embassy_time::Instant::now().as_millis()
    }
    
    pub fn delay(&self, milliseconds: u32) -> Result<(), ApiError> {
        if milliseconds > 60000 {
            return Err(ApiError::InvalidParameter);
        }
        // Note: This would need to be async in real implementation
        Ok(())
    }
    
    pub fn gpio_set(&self, pin: u8, state: bool) -> Result<(), ApiError> {
        info!("🔌 Capsule GPIO set: pin {} = {}", pin, state);
        Ok(())
    }
    
    pub fn gpio_get(&self, pin: u8) -> Result<bool, ApiError> {
        info!("🔌 Capsule GPIO get: pin {}", pin);
        Ok(false)
    }
}