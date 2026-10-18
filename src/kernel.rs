use crate::board;
use crate::capsule::CapsuleManager;
use crate::clock::{self, HostAnchor};
use crate::drivers::{DriverRegistry, HealthState};
use crate::ipc::comm::COMM_FRAME_BYTES;
use crate::ipc::frame::{
    write_frame_or_recovery, write_rescue_frame, MosrRescueFrame, SchedulerTelemetrySnapshot,
    MOSF_FRAME_BYTES, MOSR_FRAME_BYTES,
};
use crate::ipc::radio::RADIO_STATE_BYTES;
use crate::ipc::terminal::{TerminalMode, ASCII_SCREEN_BUFFER_BYTES};
use crate::ipc::verification::{run_embedded_reference_verification, VERIFY_CERTIFIED_MASK};
use crate::ipc::{
    AsciiScreenBuffer, MosfTelemetryFrame, RadioAutomationState, SecludedCommFrame,
    VerificationReport,
};
use crate::storage::StorageManager;
use cortex_m_semihosting::{debug, hprintln, syscall};

const SCRIPT_AI_BATCH_STATUS: u32 = 0x001b_0047;
const AI_BATCH_CERTIFICATION_CLEARANCE: u32 = 0x08;

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
    hprintln!(
        "drivers: {}/{} ready",
        drivers.ready_count(),
        drivers.total_count()
    );
    hprintln!("storage mounted: {}", storage.is_mounted());
    hprintln!(
        "manifest: {} {}",
        storage.manifest().name,
        storage.manifest().version
    );
    hprintln!("capsules loaded: {}", capsules.count());
    hprintln!(
        "capsule memory: {}/{} bytes",
        capsules.used_bytes(),
        capsules.capacity_bytes()
    );
    hprintln!("telemetry capsule id: {:?}", telemetry_capsule);
    hprintln!("control capsule id: {:?}", control_capsule);

    // Time. The kernel clock is monotonic since boot. A Hemant reading needs
    // an anchor; the only one available under QEMU is the host clock, read
    // once over semihosting, so it stays labelled unverified. Hardware builds
    // do not ask the probe for host time and report the anchor unavailable.
    let anchor = if board::HOST_TIME_AVAILABLE {
        let uptime_nanos = clock::now_nanos();
        // SAFETY: SYS_TIME takes no arguments and only returns a value.
        let unix_seconds = unsafe { syscall!(TIME) } as u64;
        Some(HostAnchor {
            unix_seconds,
            uptime_nanos,
        })
    } else {
        None
    };
    let tick = clock::monotonic_tick();
    let config = clock::config().expect("clock started in main");
    hprintln!(
        "clock: systick {} Hz, core {} Hz ({})",
        clock::TICK_HZ,
        config.core_hz,
        board::CLOCK_SOURCE
    );
    hprintln!("board: {}", board::NAME);
    hprintln!("time: {}", clock::TIME_BASIS);
    hprintln!("uptime ns: {}", tick.elapsed_nanos());
    match anchor.and_then(|a| a.hemant_elapsed_nanos(tick.elapsed_nanos())) {
        Some(since_epoch) => {
            let p = hemant_core::time::VedanticTimePosition::from_elapsed_nanos(since_epoch);
            hprintln!("hemant anchor: {}", HostAnchor::BASIS);
            hprintln!("hemant ns since epoch: {}", since_epoch);
            hprintln!(
                "hemant position: ahoratra {} muhurta {} kala {} kastha {} nimesha {}",
                p.ahoratra,
                p.muhurta,
                p.kala,
                p.kastha,
                p.nimesha
            );
        }
        None => hprintln!("hemant anchor: unavailable"),
    }

    let mut screen = AsciiScreenBuffer::new();
    screen.write_str("Maataa OS local terminal\n");
    screen.parse_shell_input(b"boot-contract: locked");
    screen.set_mode(TerminalMode::RecoveryConsole);
    screen.clear();
    screen.set_mode(TerminalMode::NominalWorkspace);
    screen.write_str("workspace: nominal");
    let mut screen_bytes = [0u8; ASCII_SCREEN_BUFFER_BYTES];
    let _ = screen.serialize_into(&mut screen_bytes);

    let comm_frame = SecludedCommFrame::new(*b"MSAR0001", 1, b"offline-local-message-01");
    let mut comm_bytes = [0u8; COMM_FRAME_BYTES];
    let _ = comm_frame.serialize_into(&mut comm_bytes);
    let comm_valid = SecludedCommFrame::from_bytes(&comm_bytes).is_ok();

    let mut radio = RadioAutomationState::new();
    radio.trigger_next_slot([0x52; 16], 1);
    let mut radio_bytes = [0u8; RADIO_STATE_BYTES];
    let _ = radio.serialize_into(&mut radio_bytes);
    radio.stop();

    hprintln!("");
    hprintln!("Native local engines");
    hprintln!("--------------------");
    hprintln!("terminal grid: {}x{}", 80, 40);
    hprintln!("comm frame signed: {}", comm_valid);
    hprintln!("radio channel lock: {}", radio_bytes[25]);

    let verification_report: VerificationReport = run_embedded_reference_verification();
    let verification_status = verification_report.status_word();
    let ai_batch_status = if verification_report.is_scientifically_certified() {
        SCRIPT_AI_BATCH_STATUS | AI_BATCH_CERTIFICATION_CLEARANCE
    } else {
        SCRIPT_AI_BATCH_STATUS
    };
    hprintln!("verification status: {}", verification_status);
    // Self-check against the embedded reference only. Its gap state is the
    // built-in nominal value, not an external audit, so this is not
    // certification by anyone outside the kernel.
    hprintln!(
        "verification self-check passed: {}",
        verification_report.is_scientifically_certified()
            && (verification_status & VERIFY_CERTIFIED_MASK) == VERIFY_CERTIFIED_MASK
    );

    hprintln!("");
    hprintln!("Scheduler simulation");
    hprintln!("--------------------");
    let mut telemetry_frame = [0u8; MOSF_FRAME_BYTES];
    let mut rescue_frame = [0u8; MOSR_FRAME_BYTES];
    for tick in 1..=6 {
        hprintln!("tick {}", tick);
        hprintln!("  uptime ns: {}", clock::now_nanos());
        drivers.poll(tick);
        capsules.run_cycle(tick);
        let snapshot = SchedulerTelemetrySnapshot::from_scheduler_with_verification(
            &capsules,
            tick,
            1,
            ai_batch_status,
            verification_status,
        );
        let telemetry_result = write_frame_or_recovery(snapshot, &mut telemetry_frame);

        match drivers.health() {
            HealthState::Nominal => hprintln!("health: nominal"),
            HealthState::Degraded => hprintln!("health: degraded"),
        }

        if let Err(error) = telemetry_result {
            write_rescue_frame(error, tick, &mut rescue_frame);
            let _ = MosrRescueFrame::validate_bytes(&rescue_frame);
            hprintln!("telemetry: rescue frame emitted");
        } else if let Err(error) = MosfTelemetryFrame::validate_bytes(&telemetry_frame) {
            write_rescue_frame(error, tick, &mut rescue_frame);
            let _ = MosrRescueFrame::validate_bytes(&rescue_frame);
            hprintln!("telemetry: recovery frame emitted");
        }

        // One scheduler slot: 10 ms of kernel time, sleeping between ticks.
        clock::sleep_ms(10);
    }

    hprintln!("");
    hprintln!("clock regressions: {}", clock::regressions());
    hprintln!("uptime at exit ns: {}", clock::now_nanos());
    hprintln!("Maataa OS prototype demo complete.");
    hprintln!("Exiting QEMU.");

    debug::exit(debug::EXIT_SUCCESS);

    loop {
        cortex_m::asm::wfi();
    }
}
