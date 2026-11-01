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
use crate::logging::kprintln;
use crate::sched::DEFAULT_DEMO_QUANTUM_MS;
use crate::storage::StorageManager;
#[cfg(feature = "board-qemu-f405")]
use cortex_m_semihosting::syscall;

const SCRIPT_AI_BATCH_STATUS: u32 = 0x001b_0047;
const AI_BATCH_CERTIFICATION_CLEARANCE: u32 = 0x08;

/// Signed capsule images built into the kernel: assets/capsules, or the
/// release-signed copies MAATAA_CAPSULE_DIR names (build.rs). Each is
/// verified before it is recorded.
static TELEMETRY_CAPSULE: &[u8] =
    include_bytes!(concat!(env!("OUT_DIR"), "/capsules/telemetry.mcap"));
static HEARTBEAT_CAPSULE: &[u8] =
    include_bytes!(concat!(env!("OUT_DIR"), "/capsules/heartbeat.mcap"));
static CONTROL_CAPSULE: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/capsules/control.mcap"));
static HOSTLINK_CAPSULE: &[u8] =
    include_bytes!(concat!(env!("OUT_DIR"), "/capsules/hostlink.mcap"));

/// Task ids of the capsule tasks, in slot order (see src/main.rs).
pub const CAPSULE_TASK_IDS: [u8; crate::capsule_task::CAPSULE_TASKS] = [7, 8];
/// Task id of the capsule installed at run time.
pub const INSTALLED_TASK_ID: u8 = 9;

/// A capsule load result for the boot report, as `Ok(id)` or `Err(reason)`,
/// without `Debug` formatting (which costs about 6 KB of flash; docs/size.md).
struct LoadResult(Option<Result<usize, crate::capsule::LoadError>>);

impl core::fmt::Display for LoadResult {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self.0 {
            Some(Ok(id)) => write!(f, "Ok({id})"),
            Some(Err(e)) => write!(f, "Err({})", e.as_str()),
            None => f.write_str("Err(not listed)"),
        }
    }
}

/// Comma-separated capability names for the boot report.
struct CapNames(u32);

impl core::fmt::Display for CapNames {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        let mut first = true;
        for (bits, name) in maataa_capsule::cap::NAMES {
            if self.0 & bits == bits {
                if !first {
                    f.write_str(",")?;
                }
                f.write_str(name)?;
                first = false;
            }
        }
        if first {
            f.write_str("none")?;
        }
        Ok(())
    }
}

/// What the boot sequence grants the tasks that run capsules.
pub struct Grants {
    /// Mask signed into the host-channel capsule; 0 if it was rejected, so
    /// the task it governs gets no syscalls at all.
    pub hostlink: u32,
    /// Verified WebAssembly capsules, one per capsule task, in boot order.
    /// A rejected capsule gets no task.
    pub capsule_tasks:
        [Option<crate::capsule_task::CapsuleGrant>; crate::capsule_task::CAPSULE_TASKS],
    /// Capabilities and scheduling level of the capsule installed at run
    /// time, if it passed its checks (task 9 runs it).
    pub installed: Option<(u32, u8)>,
}

/// Runs the boot sequence and returns the capsule grants.
pub fn run() -> Grants {
    kprintln!("Starting Maataa OS kernel...");
    kprintln!("================================");

    let mut drivers = DriverRegistry::new();
    let mut storage = StorageManager::new();
    let mut capsules = CapsuleManager::new();

    drivers.init_all();
    storage.mount();
    storage.save_manifest("maataa-os", env!("CARGO_PKG_VERSION"));

    kprintln!(
        "capsule signer: {} key {}",
        crate::capsule::CAPSULE_KEY_KIND,
        crate::capsule::CAPSULE_KEY_ID
    );
    let images = [
        ("telemetry", TELEMETRY_CAPSULE),
        ("heartbeat", HEARTBEAT_CAPSULE),
        ("control", CONTROL_CAPSULE),
        ("hostlink", HOSTLINK_CAPSULE),
    ];
    let mut capsule_tasks = [None; crate::capsule_task::CAPSULE_TASKS];
    let mut telemetry_capsule = None;
    let mut control_capsule = None;
    for (label, image) in images {
        let result = capsules.load_signed(image);
        match result {
            Ok(_) => kprintln!(
                "capsule verified: {} caps={}",
                label,
                CapNames(capsules.capabilities_of(label).unwrap_or(0))
            ),
            Err(error) => kprintln!("capsule rejected: {}: {}", label, error.as_str()),
        }
        match label {
            "telemetry" => telemetry_capsule = Some(result),
            "control" => control_capsule = Some(result),
            _ => {}
        }
        // A verified capsule whose payload is WebAssembly gets a task of its
        // own, with the capabilities it was signed with.
        let Some(capabilities) = result.ok().and_then(|_| capsules.capabilities_of(label)) else {
            continue;
        };
        if !maataa_capsule::payload_unverified(image).is_some_and(maataa_capsule::is_wasm) {
            continue;
        }
        match capsule_tasks.iter_mut().position(|slot| slot.is_none()) {
            Some(index) => {
                let priority = crate::capsule_task::manifest_priority(image);
                capsule_tasks[index] = Some(crate::capsule_task::CapsuleGrant {
                    name: label,
                    image,
                    capabilities,
                    priority,
                });
                kprintln!(
                    "capsule task {}: {} (priority {})",
                    CAPSULE_TASK_IDS[index],
                    label,
                    priority
                );
            }
            None => kprintln!("capsule {}: no capsule task free; not started", label),
        }
    }
    // The capsule installed at run time (src/installed.rs), if any.
    let installed = match crate::installed::mount() {
        crate::installed::Boot::Accepted {
            name,
            capabilities,
            schedule,
        } => {
            kprintln!(
                "capsule installed: {} version {} caps={}",
                name,
                schedule.version,
                CapNames(capabilities)
            );
            let _ = capsules.record_verified(name, 0, capabilities);
            kprintln!(
                "capsule task {}: {} (priority {})",
                INSTALLED_TASK_ID,
                name,
                schedule.priority
            );
            Some((capabilities, schedule.priority))
        }
        crate::installed::Boot::Empty => {
            kprintln!("capsule installed: none");
            None
        }
        crate::installed::Boot::Refused(refusal) => {
            kprintln!("capsule installed: not run: {}", refusal.as_str());
            None
        }
        crate::installed::Boot::Unavailable => {
            kprintln!("capsule installed: area not available");
            None
        }
    };
    // Tamper check: the same signed image with one payload byte changed must
    // not verify. The copy lives on the stack and is never loaded.
    let mut tampered = [0u8; 160];
    let tamper_len = HOSTLINK_CAPSULE.len().min(tampered.len());
    tampered[..tamper_len].copy_from_slice(&HOSTLINK_CAPSULE[..tamper_len]);
    tampered[maataa_capsule::HEADER_BYTES] ^= 0x01;
    match maataa_capsule::verify(&tampered[..tamper_len], &crate::capsule::CAPSULE_PUBLIC_KEY) {
        Ok(_) => kprintln!("capsule tamper check: ACCEPTED A MODIFIED IMAGE"),
        Err(error) => kprintln!("capsule tamper check: rejected ({})", error.as_str()),
    }
    let hostlink_capabilities = capsules.capabilities_of("hostlink").unwrap_or(0);

    // Why we are booting, and what (if anything) stopped the last run.
    let cause = crate::crash::reset_cause();
    let crash = crate::crash::take();
    let boot_record = crate::crash::BootRecord {
        cause,
        crash: crash.map_or(crate::crash::CrashKind::None, |c| c.0),
        address: crash.map_or(0, |c| c.1),
        detail: crash.map_or(0, |c| c.2),
        uptime_ms: crash.map_or(0, |c| c.3),
    };
    kprintln!("reset cause: {}", cause.as_str());
    match crash {
        Some((kind, address, detail, uptime_ms)) => kprintln!(
            "last crash: {} (address {:#010x}, detail {:#010x}, at {} ms)",
            kind.as_str(),
            address,
            detail,
            uptime_ms
        ),
        None => kprintln!("last crash: none"),
    }
    if crate::watchdog::AVAILABLE {
        kprintln!(
            "watchdog: IWDG {} ms nominal, fed by the scheduler tick",
            crate::watchdog::TIMEOUT_MS
        );
    } else {
        kprintln!("watchdog: not available on this board");
    }
    #[cfg(feature = "watchdog-test")]
    crate::syscall::arm_watchdog_test(cause != crate::crash::ResetCause::Watchdog);

    // Persistent store: flash sectors 6-7 on the F411, a host file in QEMU.
    match crate::storage::persist::mount() {
        Ok((report, stats)) => {
            kprintln!(
                "flash store: bank {} generation {} keys {} used {}/{} bytes{}{}{}",
                stats.bank,
                stats.generation,
                stats.live_keys,
                stats.used_bytes,
                stats.bank_bytes,
                if report.formatted { " (formatted)" } else { "" },
                if report.recovered {
                    " (recovered from a torn write)"
                } else {
                    ""
                },
                if report.migrated {
                    " (sealed the unsealed store)"
                } else {
                    ""
                }
            );
            match crate::storage::persist::rollback_counter() {
                Some((value, capacity)) => kprintln!(
                    "flash store: rollback counter {}/{} (one-time programmable){}",
                    value,
                    capacity,
                    if report.counter_full {
                        "; FULL, rollback no longer detected"
                    } else {
                        ""
                    }
                ),
                None => kprintln!("flash store: rollback counter: off (feature otp-rollback)"),
            }
            kprintln!(
                "flash store: sealed with ChaCha20-Poly1305, {} key bound to this chip, id {:08x}",
                crate::storage::persist::STORE_KEY_KIND,
                maataa_store::key_id(&crate::storage::persist::device_store_key())
            );
            match crate::storage::persist::count_boot() {
                Ok(count) => kprintln!("boot count: {}", count),
                Err(error) => kprintln!("boot count: not saved: {}", error.as_str()),
            }
            if let Some(Err(error)) = crate::storage::persist::put(
                crate::storage::persist::KEY_LAST_RESET,
                &boot_record.encode(),
            ) {
                kprintln!("reset record: not saved: {}", error.as_str());
            }
        }
        Err(error) => kprintln!("flash store: not mounted: {}", error.as_str()),
    }

    kprintln!("");
    kprintln!("Boot report");
    kprintln!("-----------");
    kprintln!(
        "drivers: {}/{} ready",
        drivers.ready_count(),
        drivers.total_count()
    );
    kprintln!("storage mounted: {}", storage.is_mounted());
    kprintln!(
        "manifest: {} {}",
        storage.manifest().name,
        storage.manifest().version
    );
    kprintln!("capsules loaded: {}", capsules.count());
    kprintln!(
        "capsule memory: {}/{} bytes",
        capsules.used_bytes(),
        capsules.capacity_bytes()
    );
    kprintln!("telemetry capsule id: {}", LoadResult(telemetry_capsule));
    kprintln!("control capsule id: {}", LoadResult(control_capsule));

    // Time. The kernel clock is monotonic since boot. A Hemant reading needs
    // an anchor; the only one available under QEMU is the host clock, read
    // once over semihosting, so it stays labelled unverified. Hardware builds
    // do not ask the probe for host time and report the anchor unavailable.
    #[cfg(feature = "board-qemu-f405")]
    let anchor = {
        let uptime_nanos = clock::now_nanos();
        // SAFETY: SYS_TIME takes no arguments and only returns a value.
        let unix_seconds = unsafe { syscall!(TIME) } as u64;
        Some(HostAnchor {
            unix_seconds,
            uptime_nanos,
        })
    };
    #[cfg(feature = "board-f411")]
    let anchor: Option<HostAnchor> = None;
    let tick = clock::monotonic_tick();
    let config = clock::config().expect("clock started in main");
    kprintln!(
        "clock: systick {} Hz, core {} Hz ({})",
        clock::TICK_HZ,
        config.core_hz,
        board::CLOCK_SOURCE
    );
    kprintln!("board: {}", board::NAME);
    kprintln!("time: {}", clock::TIME_BASIS);
    kprintln!(
        "sched: strict priority, round-robin within a level, tasks={} quantum_ms={}",
        6 + capsule_tasks.iter().flatten().count() + usize::from(installed.is_some()),
        DEFAULT_DEMO_QUANTUM_MS
    );
    kprintln!("mpu: tasks unprivileged, own stack region, flash read-only; syscalls: write, led, demo_done, send, timed recv, sleep, mutex, semaphore, uart, host status; each task limited to its capability mask");
    kprintln!("uptime ns: {}", tick.elapsed_nanos());
    match anchor.and_then(|a| a.hemant_elapsed_nanos(tick.elapsed_nanos())) {
        Some(since_epoch) => {
            let p = hemant_core::time::VedanticTimePosition::from_elapsed_nanos(since_epoch);
            kprintln!("hemant anchor: {}", HostAnchor::BASIS);
            kprintln!("hemant ns since epoch: {}", since_epoch);
            kprintln!(
                "hemant position: ahoratra {} muhurta {} kala {} kastha {} nimesha {}",
                p.ahoratra,
                p.muhurta,
                p.kala,
                p.kastha,
                p.nimesha
            );
        }
        None => {
            kprintln!("hemant anchor: unavailable");
            kprintln!("hemant ns since epoch: unavailable");
            kprintln!("hemant position: unavailable");
        }
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

    kprintln!("");
    kprintln!("Native local engines");
    kprintln!("--------------------");
    kprintln!("terminal grid: {}x{}", 80, 40);
    kprintln!("comm frame signed: {}", comm_valid);
    kprintln!("radio channel lock: {}", radio_bytes[25]);

    let verification_report: VerificationReport = run_embedded_reference_verification();
    let verification_status = verification_report.status_word();
    let ai_batch_status = if verification_report.is_scientifically_certified() {
        SCRIPT_AI_BATCH_STATUS | AI_BATCH_CERTIFICATION_CLEARANCE
    } else {
        SCRIPT_AI_BATCH_STATUS
    };
    kprintln!("verification status: {}", verification_status);
    // Self-check against the embedded reference only. Its gap state is the
    // built-in nominal value, not an external audit, so this is not
    // certification by anyone outside the kernel.
    kprintln!(
        "verification self-check passed: {}",
        verification_report.is_scientifically_certified()
            && (verification_status & VERIFY_CERTIFIED_MASK) == VERIFY_CERTIFIED_MASK
    );

    kprintln!("");
    kprintln!("Scheduler simulation");
    kprintln!("--------------------");
    let mut telemetry_frame = [0u8; MOSF_FRAME_BYTES];
    let mut rescue_frame = [0u8; MOSR_FRAME_BYTES];
    for tick in 1..=6 {
        kprintln!("tick {}", tick);
        kprintln!("  uptime ns: {}", clock::now_nanos());
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
            HealthState::Nominal => kprintln!("health: nominal"),
            HealthState::Degraded => kprintln!("health: degraded"),
        }

        if let Err(error) = telemetry_result {
            write_rescue_frame(error, tick, &mut rescue_frame);
            let _ = MosrRescueFrame::validate_bytes(&rescue_frame);
            kprintln!("telemetry: rescue frame emitted");
        } else if let Err(error) = MosfTelemetryFrame::validate_bytes(&telemetry_frame) {
            write_rescue_frame(error, tick, &mut rescue_frame);
            let _ = MosrRescueFrame::validate_bytes(&rescue_frame);
            kprintln!("telemetry: recovery frame emitted");
        } else {
            // The host channel's TELEMETRY reply serves the latest valid frame.
            crate::hostlink::publish_telemetry(&telemetry_frame);
        }

        // One scheduler slot: 10 ms of kernel time, sleeping between ticks.
        clock::sleep_ms(10);
    }

    kprintln!("");
    kprintln!("clock regressions: {}", clock::regressions());
    kprintln!("uptime at exit ns: {}", clock::now_nanos());
    kprintln!("Maataa OS prototype demo complete.");
    #[cfg(feature = "board-qemu-f405")]
    kprintln!("Exiting QEMU.");
    #[cfg(feature = "board-f411")]
    kprintln!(
        "Starting the demo tasks (task 4 tests memory protection, task 5 a stack overflow, task 6 serves the host channel)."
    );
    Grants {
        hostlink: hostlink_capabilities,
        capsule_tasks,
        installed,
    }
}
