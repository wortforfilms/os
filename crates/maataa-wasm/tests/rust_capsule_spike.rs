//! Step 0 spike: does a capsule written in Rust (spikes/rust-capsule), built
//! for `wasm32v1-none`, load and run in this interpreter with the 4 KiB of
//! memory and the fuel a capsule task gets?
//!
//! The test reads the built module from `spikes/rust-capsule/target/`, or
//! from `$RUST_CAPSULE_WASM`. Without it the test says so and passes, so CI
//! (which does not build the spike) is not affected.
//! `scripts/rust-capsule-spike.sh` builds the module and runs this test.

use maataa_wasm::{Host, Import, Instance, Module, Trap};

/// The capsule task's limits (src/capsule_task.rs).
const CAPSULE_MEMORY_BYTES: usize = 4096;
const FUEL_PER_CALL: u32 = 20_000;

#[derive(Default)]
struct Recorder {
    logs: Vec<i32>,
    texts: Vec<String>,
}

impl Host for Recorder {
    fn call(
        &mut self,
        _index: usize,
        import: &Import<'_>,
        args: &[i32],
        memory: &mut [u8],
    ) -> Result<i32, Trap> {
        match (import.module, import.name) {
            ("maataa", "log") => {
                self.logs.push(args[0]);
                Ok(0)
            }
            ("maataa", "log_str") => {
                let (ptr, len) = (args[0] as usize, args[1] as usize);
                let bytes = memory.get(ptr..ptr + len).ok_or(Trap::OutOfBounds)?;
                self.texts.push(String::from_utf8_lossy(bytes).into_owned());
                Ok(0)
            }
            _ => Err(Trap::UnresolvedImport),
        }
    }
}

/// CRC-16/MODBUS, the host reference.
fn crc16(bytes: &[u8]) -> u16 {
    let mut crc = 0xFFFFu16;
    for &b in bytes {
        crc ^= u16::from(b);
        for _ in 0..8 {
            crc = if crc & 1 != 0 {
                (crc >> 1) ^ 0xA001
            } else {
                crc >> 1
            };
        }
    }
    crc
}

fn module_bytes() -> Option<Vec<u8>> {
    let path = std::env::var("RUST_CAPSULE_WASM").unwrap_or_else(|_| {
        concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../spikes/rust-capsule/target/wasm32v1-none/release/rust_capsule_spike.wasm"
        )
        .to_string()
    });
    match std::fs::read(&path) {
        Ok(bytes) => Some(bytes),
        Err(_) => {
            eprintln!("rust capsule spike: {path} not built; skipped");
            None
        }
    }
}

#[test]
fn rust_capsule_loads_and_matches_the_host() {
    let Some(bytes) = module_bytes() else { return };

    // Loading is the instruction check: the parser refuses i64, floats,
    // tables, call_indirect, bulk memory and every other opcode outside the
    // subset, at load time.
    let module = Module::parse(&bytes).expect("the Rust capsule loads");
    assert_eq!(
        maataa_wasm::manifest_section(&bytes).expect("custom sections parse"),
        Some(&b"ticks=3 period_ms=1000"[..]),
        "signed schedule in the `maataa` section"
    );
    let names: Vec<_> = module.export_names().collect();
    assert!(
        names.contains(&"init") && names.contains(&"tick"),
        "{names:?}"
    );

    let mut instance = Instance::new(&module);
    let mut memory = [0u8; CAPSULE_MEMORY_BYTES];
    instance
        .init_memory(&mut memory)
        .expect("data fits in 4 KiB");
    let mut host = Recorder::default();

    let init = instance
        .invoke(&mut host, "init", &[], FUEL_PER_CALL, &mut memory)
        .expect("init runs");
    let want = crc16(&[0x01, 0x03, 0x00, 0x00, 0x00, 0x0A]);
    assert_eq!(want, 0xCDC5, "the textbook example: C5 CD on the wire");
    assert_eq!(init, Some(i32::from(want)));
    assert_eq!(host.logs, [i32::from(want)]);
    assert_eq!(host.texts, ["rust capsule up"]);
    println!(
        "rust capsule spike: {} bytes, {} imports, init -> {:#06x} ({} instructions)",
        bytes.len(),
        module.imports().len(),
        want,
        instance.fuel_used
    );

    for n in 1..=3u16 {
        let got = instance
            .invoke(&mut host, "tick", &[], FUEL_PER_CALL, &mut memory)
            .expect("tick runs");
        let [hi, lo] = n.to_be_bytes();
        let want = crc16(&[0x01, 0x03, hi, lo, 0x00, 0x02]);
        assert_eq!(got, Some(i32::from(want)), "tick {n}");
        println!(
            "rust capsule spike: tick {n} -> {want:#06x} ({} instructions)",
            instance.fuel_used
        );
    }

    // A reply parser with bounds checks the compiler cannot remove: the
    // Rust panic path must not pull in anything the interpreter refuses.
    let base = instance
        .invoke(&mut host, "reply_buf", &[], FUEL_PER_CALL, &mut memory)
        .expect("reply_buf runs")
        .expect("returns an address") as usize;
    let mut check = |reply: &[u8], len: i32| {
        memory[base..base + reply.len()].copy_from_slice(reply);
        instance.invoke(&mut host, "check_reply", &[len], FUEL_PER_CALL, &mut memory)
    };
    let with_crc = |body: &[u8]| {
        let mut v = body.to_vec();
        v.extend_from_slice(&crc16(body).to_le_bytes());
        v
    };
    // Two registers, 0x00E6 (230) and 0x0000.
    let good = with_crc(&[0x01, 0x03, 0x04, 0x00, 0xE6, 0x00, 0x00]);
    assert_eq!(check(&good, good.len() as i32), Ok(Some(230)));
    let mut bad = good.clone();
    bad[4] ^= 1;
    assert_eq!(check(&bad, bad.len() as i32), Ok(Some(-5)), "bad CRC");
    let exception = with_crc(&[0x01, 0x83, 0x02]);
    assert_eq!(check(&exception, 5), Ok(Some(-102)), "exception 2");
    assert_eq!(check(&good, 3), Ok(Some(-1)), "too short");
    assert_eq!(check(&good, 300), Err(Trap::Unreachable), "panic is a trap");
    println!("rust capsule spike: reply checks pass; a panic traps");
}
