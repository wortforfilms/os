use crate::boot_log;

pub mod flash;
use flash::{HardenedFlashController, ROLLING_DATABASE_SECTOR_START, SYSTEM_KERNEL_SECTOR_START};

#[derive(Clone, Copy)]
pub struct SystemManifest {
    pub name: &'static str,
    pub version: &'static str,
}

pub struct StorageManager {
    mounted: bool,
    manifest: SystemManifest,
    flash_controller: HardenedFlashController,
}

impl StorageManager {
    pub const fn new() -> Self {
        Self {
            mounted: false,
            manifest: SystemManifest {
                name: "uninitialized",
                version: "0.0.0",
            },
            flash_controller: HardenedFlashController::new(true),
        }
    }

    pub fn mount(&mut self) {
        if self
            .flash_controller
            .validate_boundary_transition(SYSTEM_KERNEL_SECTOR_START, ROLLING_DATABASE_SECTOR_START)
            .is_err()
        {
            boot_log!("storage sector boundary validation failed");
            return;
        }

        self.mounted = true;
        boot_log!("storage mounted: virtual flash");
    }

    pub fn save_manifest(&mut self, name: &'static str, version: &'static str) {
        self.manifest = SystemManifest { name, version };
        boot_log!("storage manifest committed");
    }

    pub const fn is_mounted(&self) -> bool {
        self.mounted
    }

    pub const fn manifest(&self) -> &SystemManifest {
        &self.manifest
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_unmounted_with_default_manifest() {
        let storage = StorageManager::new();

        assert!(!storage.is_mounted());
        assert_eq!(storage.manifest().name, "uninitialized");
        assert_eq!(storage.manifest().version, "0.0.0");
    }

    #[test]
    fn mount_and_manifest_update_are_recorded() {
        let mut storage = StorageManager::new();

        storage.mount();
        storage.save_manifest("maataa-os", "0.1.0-alpha.1");

        assert!(storage.is_mounted());
        assert_eq!(storage.manifest().name, "maataa-os");
        assert_eq!(storage.manifest().version, "0.1.0-alpha.1");
    }
}
