use littlefs2::{fs::Filesystem, driver::Storage};

pub fn mount_flash<S: Storage>(storage: &mut S) {
    if let Ok(_fs) = Filesystem::mount(storage) {
        defmt::info!("Flash mounted successfully");
    } else {
        defmt::warn!("Flash mount failed");
    }
}
