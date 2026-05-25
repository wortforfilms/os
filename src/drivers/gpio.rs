use super::{Driver, DriverError};
use defmt::info;

pub struct GpioPin {
    pin: u8,
    mode: PinMode,
    state: PinState,
}

#[derive(Clone, Copy, defmt::Format)]
pub enum PinMode {
    Input,
    Output,
    Analog,
}

#[derive(Clone, Copy, defmt::Format)]
pub enum PinState {
    Low,
    High,
}

impl GpioPin {
    pub fn new(pin: u8) -> Self {
        Self {
            pin,
            mode: PinMode::Input,
            state: PinState::Low,
        }
    }
    
    pub fn set_mode(&mut self, mode: PinMode) {
        self.mode = mode;
        info!("🔌 GPIO {} mode: {:?}", self.pin, mode);
    }
    
    pub fn set_state(&mut self, state: PinState) {
        self.state = state;
        info!("🔌 GPIO {} state: {:?}", self.pin, state);
    }
    
    pub fn read(&self) -> PinState {
        self.state
    }
}

pub struct GpioDriver {
    pins: [Option<GpioPin>; 16],
}

impl GpioDriver {
    pub const fn new() -> Self {
        Self { pins: [None; 16] }
    }
    
    pub fn configure_pin(&mut self, pin: u8, mode: PinMode) -> Result<(), DriverError> {
        if pin as usize >= self.pins.len() {
            return Err(DriverError::NotSupported);
        }
        
        let mut gpio_pin = GpioPin::new(pin);
        gpio_pin.set_mode(mode);
        self.pins[pin as usize] = Some(gpio_pin);
        
        Ok(())
    }
}

impl Driver for GpioDriver {
    fn init(&mut self) -> Result<(), DriverError> {
        info!("🔌 Initializing GPIO driver");
        Ok(())
    }
    
    fn deinit(&mut self) -> Result<(), DriverError> {
        info!("🔌 Deinitializing GPIO driver");
        Ok(())
    }
    
    fn is_ready(&self) -> bool {
        true
    }
}

static mut GPIO: GpioDriver = GpioDriver::new();

pub fn init() -> Result<(), DriverError> {
    unsafe { GPIO.init() }
}