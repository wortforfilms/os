use cortex_m_semihosting::{hprintln, debug};
use crate::capsule::CapsuleManager;
use crate::drivers::{DriverRegistry, HealthState};
use crate::storage::StorageManager;

pub fn run() -> ! {
    hprintln!("Starting Maataa OS kernel...");
    hprintln!("================================");

    let mut drivers = DriverRegistry::new();
    let mut storage = StorageManager::new();
    let mut capsules = CapsuleManager::new();

    drivers.init_all();
    storage.mount();
    storage.save_manifest("maataa-os", env!("CARGO_PKG_VERSION"));

    let telemetry_capsule = capsules.load("telemetry", include_bytes!("../assets/demo.wasm"));
    let control_capsule = capsules.load("control", b"virtual-control-capsule");

    hprintln!("");
    hprintln!("Boot report");
    hprintln!("-----------");
    hprintln!("drivers: {}/{} ready", drivers.ready_count(), drivers.total_count());
    hprintln!("storage mounted: {}", storage.is_mounted());
    hprintln!("manifest: {} {}", storage.manifest().name, storage.manifest().version);
    hprintln!("capsules loaded: {}", capsules.count());
    hprintln!(
        "capsule memory: {}/{} bytes",
        capsules.used_bytes(),
        capsules.capacity_bytes()
    );
    hprintln!("telemetry capsule id: {:?}", telemetry_capsule);
    hprintln!("control capsule id: {:?}", control_capsule);

    hprintln!("");
    hprintln!("Scheduler simulation");
    hprintln!("--------------------");
    for tick in 1..=6 {
        hprintln!("tick {}", tick);
        drivers.poll(tick);
        capsules.run_cycle(tick);

        match drivers.health() {
            HealthState::Nominal => hprintln!("health: nominal"),
            HealthState::Degraded => hprintln!("health: degraded"),
        }

        cortex_m::asm::delay(1_000_000);
    }

    hprintln!("");
    hprintln!("Maataa OS prototype demo complete.");
    hprintln!("Exiting QEMU.");

    debug::exit(debug::EXIT_SUCCESS);

    loop {
        cortex_m::asm::wfi();
    }
}
