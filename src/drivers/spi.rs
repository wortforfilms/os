use super::{Driver, DriverError};
use core::cell::UnsafeCell;
use core::ptr::read_volatile;

pub const ROOT_OF_TRUST_MMIO_BASE: usize = 0xFE00_1000;
const FACTORY_MASK_A_OFFSET: usize = 0x00;
const FACTORY_MASK_B_OFFSET: usize = 0x04;
const STATUS_OFFSET: usize = 0x08;
const EXPECTED_STATUS_ARMED: u32 = 0x4D53_4152;

pub struct SpiDriver {
    initialized: bool,
    frequency: u32,
    mode: SpiMode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpiMode {
    Mode0,
    Mode1,
    Mode2,
    Mode3,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SiliconAttestation {
    pub mask_a: u32,
    pub mask_b: u32,
    pub status: u32,
}

#[derive(Clone, Copy)]
pub struct HardwareRootOfTrust {
    base: *const u32,
}

impl HardwareRootOfTrust {
    pub const fn new() -> Self {
        Self {
            base: ROOT_OF_TRUST_MMIO_BASE as *const u32,
        }
    }

    pub const fn from_base(base: *const u32) -> Self {
        Self { base }
    }

    pub fn read_attestation(&self) -> Result<SiliconAttestation, DriverError> {
        let mask_a = self.read_register(FACTORY_MASK_A_OFFSET);
        let mask_b = self.read_register(FACTORY_MASK_B_OFFSET);
        let status = self.read_register(STATUS_OFFSET);
        validate_attestation(SiliconAttestation {
            mask_a,
            mask_b,
            status,
        })
    }

    #[inline(always)]
    fn read_register(&self, offset: usize) -> u32 {
        let register = unsafe { self.base.byte_add(offset) };
        unsafe { read_volatile(register) }
    }
}

impl SpiDriver {
    pub const fn new() -> Self {
        Self {
            initialized: false,
            frequency: 1_000_000,
            mode: SpiMode::Mode0,
        }
    }

    pub fn transfer(&self, tx_data: &[u8], rx_data: &mut [u8]) -> Result<usize, DriverError> {
        if !self.initialized {
            return Err(DriverError::NotSupported);
        }

        let len = tx_data.len().min(rx_data.len());
        rx_data[..len].copy_from_slice(&tx_data[..len]);
        Ok(len)
    }

    pub fn set_frequency(&mut self, frequency: u32) -> Result<(), DriverError> {
        if frequency > 10_000_000 {
            return Err(DriverError::NotSupported);
        }

        self.frequency = frequency;
        Ok(())
    }

    pub fn set_mode(&mut self, mode: SpiMode) {
        self.mode = mode;
    }

    pub fn verify_root_of_trust(&self, root: HardwareRootOfTrust) -> Result<SiliconAttestation, DriverError> {
        if !self.initialized {
            return Err(DriverError::NotSupported);
        }
        root.read_attestation()
    }
}

impl Driver for SpiDriver {
    fn init(&mut self) -> Result<(), DriverError> {
        self.initialized = true;
        Ok(())
    }

    fn deinit(&mut self) -> Result<(), DriverError> {
        self.initialized = false;
        Ok(())
    }

    fn is_ready(&self) -> bool {
        self.initialized
    }
}

pub fn validate_attestation(attestation: SiliconAttestation) -> Result<SiliconAttestation, DriverError> {
    if attestation.mask_a == 0 || attestation.mask_b == 0 || attestation.status != EXPECTED_STATUS_ARMED {
        return Err(DriverError::SiliconSignatureMismatch);
    }

    Ok(attestation)
}

struct SpiCell(UnsafeCell<SpiDriver>);

unsafe impl Sync for SpiCell {}

static SPI: SpiCell = SpiCell(UnsafeCell::new(SpiDriver::new()));

pub fn init() -> Result<(), DriverError> {
    unsafe { (&mut *SPI.0.get()).init() }
}

pub fn transfer(tx_data: &[u8], rx_data: &mut [u8]) -> Result<usize, DriverError> {
    unsafe { (&*SPI.0.get()).transfer(tx_data, rx_data) }
}

pub fn verify_hardware_root_of_trust() -> Result<SiliconAttestation, DriverError> {
    unsafe { (&*SPI.0.get()).verify_root_of_trust(HardwareRootOfTrust::new()) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_zero_factory_masks() {
        let result = validate_attestation(SiliconAttestation {
            mask_a: 0,
            mask_b: 0x3c4d_5e60,
            status: EXPECTED_STATUS_ARMED,
        });

        assert_eq!(result, Err(DriverError::SiliconSignatureMismatch));
    }

    #[test]
    fn accepts_nonzero_factory_masks_with_armed_status() {
        let result = validate_attestation(SiliconAttestation {
            mask_a: 0x001a_2b3c,
            mask_b: 0x4d5e_0001,
            status: EXPECTED_STATUS_ARMED,
        });

        assert!(result.is_ok());
    }

    #[test]
    fn volatile_reader_uses_supplied_register_window() {
        let registers = [0x001a_2b3c_u32, 0x4d5e_0001, EXPECTED_STATUS_ARMED];
        let root = HardwareRootOfTrust::from_base(registers.as_ptr());
        let attestation = root.read_attestation().unwrap();

        assert_eq!(attestation.mask_a, registers[0]);
        assert_eq!(attestation.mask_b, registers[1]);
        assert_eq!(attestation.status, EXPECTED_STATUS_ARMED);
    }
}
