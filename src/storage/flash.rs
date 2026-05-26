pub const SYSTEM_KERNEL_SECTOR_START: usize = 0x0000_0000;
pub const SYSTEM_KERNEL_SECTOR_END: usize = 0x001f_ffff;
pub const MODEL_COMPUTE_SECTOR_START: usize = 0x0020_0000;
pub const MODEL_COMPUTE_SECTOR_END: usize = 0x1fff_ffff;
pub const ROLLING_DATABASE_SECTOR_START: usize = 0x2000_0000;
pub const ROLLING_DATABASE_SECTOR_END: usize = 0x200f_ffff;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FlashSector {
    Kernel,
    ModelCompute,
    RollingDatabase,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SectorAccessError {
    WriteViolation,
    UnauthorizedCrossTalk,
    AddressOutOfBounds,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct HardenedFlashController {
    write_protect_pin_active: bool,
}

impl HardenedFlashController {
    pub const fn new(write_protect_pin_active: bool) -> Self {
        Self {
            write_protect_pin_active,
        }
    }

    pub fn sector_for_address(address: usize) -> Result<FlashSector, SectorAccessError> {
        match address {
            SYSTEM_KERNEL_SECTOR_START..=SYSTEM_KERNEL_SECTOR_END => Ok(FlashSector::Kernel),
            MODEL_COMPUTE_SECTOR_START..=MODEL_COMPUTE_SECTOR_END => Ok(FlashSector::ModelCompute),
            ROLLING_DATABASE_SECTOR_START..=ROLLING_DATABASE_SECTOR_END => Ok(FlashSector::RollingDatabase),
            _ => Err(SectorAccessError::AddressOutOfBounds),
        }
    }

    pub fn validate_boundary_transition(
        &self,
        current_sector: usize,
        target_sector: usize,
    ) -> Result<(), SectorAccessError> {
        let current = Self::sector_for_address(current_sector)?;
        let target = Self::sector_for_address(target_sector)?;

        if self.write_protect_pin_active && target == FlashSector::Kernel {
            return Err(SectorAccessError::WriteViolation);
        }

        if current == FlashSector::ModelCompute && target == FlashSector::Kernel {
            return Err(SectorAccessError::UnauthorizedCrossTalk);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_protect_blocks_kernel_target() {
        let controller = HardenedFlashController::new(true);

        assert_eq!(
            controller.validate_boundary_transition(MODEL_COMPUTE_SECTOR_START, SYSTEM_KERNEL_SECTOR_START),
            Err(SectorAccessError::WriteViolation)
        );
    }

    #[test]
    fn model_to_kernel_crosstalk_is_blocked_without_wp_pin() {
        let controller = HardenedFlashController::new(false);

        assert_eq!(
            controller.validate_boundary_transition(MODEL_COMPUTE_SECTOR_START, SYSTEM_KERNEL_SECTOR_END),
            Err(SectorAccessError::UnauthorizedCrossTalk)
        );
    }

    #[test]
    fn model_to_database_transition_is_allowed() {
        let controller = HardenedFlashController::new(true);

        assert_eq!(
            controller.validate_boundary_transition(MODEL_COMPUTE_SECTOR_START, ROLLING_DATABASE_SECTOR_START),
            Ok(())
        );
    }

    #[test]
    fn unknown_address_is_rejected() {
        let controller = HardenedFlashController::new(false);

        assert_eq!(
            controller.validate_boundary_transition(SYSTEM_KERNEL_SECTOR_START, ROLLING_DATABASE_SECTOR_END + 1),
            Err(SectorAccessError::AddressOutOfBounds)
        );
    }
}
