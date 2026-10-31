//! `maataa-link`: host side of the Maataa OS host channel.
//!
//! ```text
//! maataa-link --serial /dev/cu.usbmodem1103 status
//! maataa-link --qemu-socket target/hostlink.sock --require-hello selftest
//! ```
//!
//! Commands: `hello`, `ping [text]`, `status`, `telemetry`, `info`,
//! `get KEY`, `put KEY [TEXT]`, `store-stress COUNT`, `selftest`.
//! Build with `cargo run -p maataa-link --features cli -- ...`.

use maataa_link::{
    decode_info, encode_frame, error_code, kind, BootRecord, CrashKind, Decoder, Event, Status,
    CAPSULE_CHUNK, MAX_WIRE,
};
use std::io::{ErrorKind, Read, Write};
use std::process::ExitCode;
use std::time::{Duration, Instant};

const USAGE: &str = "usage: maataa-link (--serial DEVICE | --qemu-socket PATH) [--timeout-ms N] [--require-hello] COMMAND
commands:
  hello           wait for the kernel's HELLO frame (sent once at boot)
  ping [TEXT]     round-trip TEXT (default: maataa)
  status          uptime, ticks, tasks, UART drops
  telemetry       latest MOSF telemetry frame, checked
  info            board name and kernel version
  get KEY         read persistent key KEY (16..63)
  put KEY [TEXT]  write TEXT to persistent key KEY; no TEXT deletes it
  store-stress N  write N 64-byte values to key 63 (forces flash compaction)
  boot-info       boot count, last reset cause and last crash (kernel keys 0 and 1)
  capsule-install FILE   send a signed capsule image (.mcap); it runs from the next boot
  capsule-info    the installed run-time capsule
  capsule-remove  remove the installed run-time capsule (from the next boot)
  selftest        all of the above plus two deliberate bad frames";

trait Link: Read + Write {}
impl<T: Read + Write> Link for T {}

struct Reply {
    kind: u8,
    seq: u8,
    payload: Vec<u8>,
}

struct Channel {
    link: Box<dyn Link>,
    decoder: Decoder,
    seq: u8,
    timeout: Duration,
    ignored_chunks: u32,
    hello: Option<Vec<u8>>,
}

impl Channel {
    /// Reads until a frame arrives or the deadline passes. Chunks that are not
    /// frames (kernel log text on the F411 UART) are counted and skipped.
    fn next_frame(&mut self, deadline: Instant) -> Result<Option<Reply>, String> {
        let mut byte = [0u8; 1];
        while Instant::now() < deadline {
            match self.link.read(&mut byte) {
                Ok(0) => std::thread::sleep(Duration::from_millis(5)),
                Ok(_) => match self.decoder.push(byte[0]) {
                    Some(Event::Frame(f)) => {
                        return Ok(Some(Reply {
                            kind: f.kind,
                            seq: f.seq,
                            payload: f.payload.to_vec(),
                        }))
                    }
                    Some(Event::Invalid(_)) => self.ignored_chunks += 1,
                    None => {}
                },
                Err(e)
                    if matches!(
                        e.kind(),
                        ErrorKind::WouldBlock | ErrorKind::TimedOut | ErrorKind::Interrupted
                    ) => {}
                Err(e) => return Err(format!("read failed: {e}")),
            }
        }
        Ok(None)
    }

    fn wait_hello(&mut self, within: Duration) -> Result<bool, String> {
        if self.hello.is_some() {
            return Ok(true);
        }
        let deadline = Instant::now() + within;
        while let Some(reply) = self.next_frame(deadline)? {
            if reply.kind == kind::HELLO {
                self.hello = Some(reply.payload);
                return Ok(true);
            }
        }
        Ok(false)
    }

    fn send_raw(&mut self, bytes: &[u8]) -> Result<(), String> {
        self.link
            .write_all(bytes)
            .map_err(|e| format!("write failed: {e}"))?;
        self.link.flush().map_err(|e| format!("flush failed: {e}"))
    }

    /// Sends a request and returns the reply with the same sequence number.
    fn request(&mut self, request_kind: u8, payload: &[u8]) -> Result<Reply, String> {
        self.seq = self.seq.wrapping_add(1).max(1);
        let seq = self.seq;
        let mut wire = [0u8; MAX_WIRE];
        let n =
            encode_frame(request_kind, seq, payload, &mut wire).map_err(|e| format!("{e:?}"))?;
        self.send_raw(&wire[..n])?;
        self.await_seq(seq)
    }

    fn await_seq(&mut self, seq: u8) -> Result<Reply, String> {
        let deadline = Instant::now() + self.timeout;
        while let Some(reply) = self.next_frame(deadline)? {
            if reply.kind == kind::HELLO {
                self.hello = Some(reply.payload);
                continue;
            }
            if reply.seq == seq {
                return Ok(reply);
            }
        }
        Err(format!("no reply within {} ms", self.timeout.as_millis()))
    }
}

/// Capability names in bit order (the same bits as maataa_capsule::cap,
/// which this crate does not depend on).
fn maataa_capsule_cap_names(mask: u32) -> Vec<&'static str> {
    const NAMES: [(u32, &str); 16] = [
        (1 << 1, "write"),
        (1 << 2, "led"),
        (1 << 3, "demo_done"),
        (1 << 4, "test"),
        (1 << 5, "send"),
        (1 << 6, "recv"),
        (1 << 7, "sleep"),
        ((1 << 8) | (1 << 9), "mutex"),
        ((1 << 10) | (1 << 11), "semaphore"),
        (1 << 12, "uart_write"),
        (1 << 13, "uart_read"),
        (1 << 14, "host_status"),
        (1 << 15, "store_get"),
        (1 << 16, "store_put"),
        (1 << 17, "capsule_install"),
        (1 << 18, "capsule_image"),
    ];
    let names: Vec<&str> = NAMES
        .iter()
        .filter(|(bits, _)| mask & bits == *bits)
        .map(|(_, name)| *name)
        .collect();
    if names.is_empty() {
        vec!["none"]
    } else {
        names
    }
}

fn describe_error(payload: &[u8]) -> String {
    match payload {
        [code, req] => format!(
            "ERROR {} (request kind {req:#04x})",
            error_code::name(*code)
        ),
        _ => "ERROR (malformed)".to_string(),
    }
}

fn expect(reply: Reply, want: u8) -> Result<Vec<u8>, String> {
    if reply.kind == want {
        Ok(reply.payload)
    } else if reply.kind == kind::ERROR {
        Err(describe_error(&reply.payload))
    } else {
        Err(format!("unexpected reply kind {:#04x}", reply.kind))
    }
}

fn show_info(label: &str, payload: &[u8]) -> Result<String, String> {
    let (version, board, kernel) = decode_info(payload).ok_or("malformed INFO payload")?;
    Ok(format!(
        "{label}: board {board}, kernel {kernel}, protocol {version}"
    ))
}

fn show_status(payload: &[u8]) -> Result<String, String> {
    let s = Status::decode(payload).ok_or("malformed STATUS payload")?;
    Ok(format!(
        "status: uptime {:.3} s ({} ticks at {} Hz, core {} Hz), tasks {}/{} alive, uart rx dropped {}, clock regressions {}",
        s.uptime_ns as f64 / 1e9,
        s.ticks,
        s.tick_hz,
        s.core_hz,
        s.tasks_alive,
        s.tasks_total,
        s.rx_dropped,
        s.clock_regressions
    ))
}

fn fnv1a32(bytes: &[u8]) -> u32 {
    bytes.iter().fold(0x811c_9dc5u32, |h, &b| {
        (h ^ b as u32).wrapping_mul(0x0100_0193)
    })
}

/// Checks the 40-byte MOSF frame (docs/IPC_FRAME_SCHEMA.md).
fn show_telemetry(p: &[u8]) -> Result<String, String> {
    if p.len() != 40 {
        return Err(format!("telemetry frame is {} bytes, expected 40", p.len()));
    }
    if &p[0..4] != b"MOSF" {
        return Err("telemetry magic is not MOSF".into());
    }
    let le32 = |i: usize| u32::from_le_bytes(p[i..i + 4].try_into().unwrap());
    let checksum = le32(36);
    if fnv1a32(&p[..36]) != checksum {
        return Err("telemetry FNV-1a checksum mismatch".into());
    }
    Ok(format!(
        "telemetry: MOSF ok, uptime ticks {}, memory {} bytes, tasks {}, cores {}, capsules {}, ai status {:#010x}",
        le32(4),
        u64::from_le_bytes(p[8..16].try_into().unwrap()),
        le32(16),
        u16::from_le_bytes([p[20], p[21]]),
        u16::from_le_bytes([p[22], p[23]]),
        le32(24)
    ))
}

fn run_command(ch: &mut Channel, command: &str, args: &[String]) -> Result<String, String> {
    match command {
        "hello" => {
            if ch.wait_hello(ch.timeout)? {
                show_info("hello", ch.hello.as_deref().unwrap_or_default())
            } else {
                Err("no HELLO (it is sent once at boot; reset the board or use `info`)".into())
            }
        }
        "ping" => {
            let text = args.first().map(String::as_str).unwrap_or("maataa");
            let started = Instant::now();
            let reply = expect(ch.request(kind::PING, text.as_bytes())?, kind::PONG)?;
            if reply != text.as_bytes() {
                return Err("PONG payload differs from PING".into());
            }
            Ok(format!(
                "pong: {:?} in {} ms",
                text,
                started.elapsed().as_millis()
            ))
        }
        "status" => show_status(&expect(ch.request(kind::STATUS, &[])?, kind::STATUS_REPLY)?),
        "telemetry" => show_telemetry(&expect(
            ch.request(kind::TELEMETRY, &[])?,
            kind::TELEMETRY_REPLY,
        )?),
        "info" => show_info(
            "info",
            &expect(ch.request(kind::INFO, &[])?, kind::INFO_REPLY)?,
        ),
        "get" => {
            let key = parse_key(args.first())?;
            let value = expect(ch.request(kind::STORE_GET, &[key])?, kind::STORE_GET_REPLY)?;
            Ok(format!(
                "key {key}: {:?} ({} bytes)",
                String::from_utf8_lossy(&value),
                value.len()
            ))
        }
        "put" => {
            let key = parse_key(args.first())?;
            let text = args.get(1).map(String::as_str).unwrap_or("");
            let mut payload = vec![key];
            payload.extend_from_slice(text.as_bytes());
            expect(
                ch.request(kind::STORE_PUT, &payload)?,
                kind::STORE_PUT_REPLY,
            )?;
            Ok(if text.is_empty() {
                format!("key {key}: deleted")
            } else {
                format!("key {key}: stored {} bytes", text.len())
            })
        }
        "capsule-install" => {
            let path = args.first().ok_or("capsule-install needs a .mcap file")?;
            let image = std::fs::read(path).map_err(|e| format!("{path}: {e}"))?;
            let started = Instant::now();
            // Starting an install may erase a flash sector (about 2 s on the
            // F411), so allow it more time.
            let saved = ch.timeout;
            ch.timeout = ch.timeout.max(Duration::from_secs(10));
            let begun = ch.request(kind::CAPSULE_BEGIN, &(image.len() as u32).to_le_bytes());
            ch.timeout = saved;
            expect(begun?, kind::CAPSULE_BEGIN_REPLY).map_err(|e| format!("begin: {e}"))?;
            for (i, chunk) in image.chunks(CAPSULE_CHUNK).enumerate() {
                let mut payload = ((i * CAPSULE_CHUNK) as u32).to_le_bytes().to_vec();
                payload.extend_from_slice(chunk);
                expect(
                    ch.request(kind::CAPSULE_WRITE, &payload)?,
                    kind::CAPSULE_WRITE_REPLY,
                )
                .map_err(|e| format!("write at {}: {e}", i * CAPSULE_CHUNK))?;
            }
            expect(
                ch.request(kind::CAPSULE_COMMIT, &[])?,
                kind::CAPSULE_COMMIT_REPLY,
            )
            .map_err(|e| format!("commit: {e} (the kernel log says why)"))?;
            Ok(format!(
                "installed {path}: {} bytes in {} ms; it runs from the next boot",
                image.len(),
                started.elapsed().as_millis()
            ))
        }
        "capsule-info" => {
            let reply = ch.request(kind::CAPSULE_INFO, &[])?;
            if reply.kind == kind::ERROR && reply.payload.first() == Some(&error_code::NOT_FOUND) {
                return Ok("no capsule installed".into());
            }
            let info = expect(reply, kind::CAPSULE_INFO_REPLY)?;
            if info.len() < 13 || info.len() != 13 + info[12] as usize {
                return Err("malformed CAPSULE_INFO reply".into());
            }
            let word =
                |i: usize| u32::from_le_bytes([info[i], info[i + 1], info[i + 2], info[i + 3]]);
            let caps: Vec<&str> = maataa_capsule_cap_names(word(4));
            Ok(format!(
                "installed: {} version {}, {} bytes, caps {}",
                String::from_utf8_lossy(&info[13..]),
                word(0),
                word(8),
                caps.join(",")
            ))
        }
        "capsule-remove" => {
            let reply = ch.request(kind::CAPSULE_REMOVE, &[])?;
            if reply.kind == kind::ERROR && reply.payload.first() == Some(&error_code::NOT_FOUND) {
                return Ok("no capsule installed".into());
            }
            expect(reply, kind::CAPSULE_REMOVE_REPLY)?;
            Ok("removed; the capsule no longer runs from the next boot".into())
        }
        "boot-info" => {
            let count = expect(ch.request(kind::STORE_GET, &[0])?, kind::STORE_GET_REPLY)?;
            let count = <[u8; 4]>::try_from(count.as_slice())
                .map(u32::from_le_bytes)
                .map_err(|_| "boot count is not 4 bytes".to_string())?;
            let record = expect(ch.request(kind::STORE_GET, &[1])?, kind::STORE_GET_REPLY)?;
            let r = BootRecord::decode(&record).ok_or("malformed reset record")?;
            let crash = if r.crash == CrashKind::None {
                "none".to_string()
            } else {
                format!(
                    "{} (address {:#010x}, detail {:#010x}, at {} ms)",
                    r.crash.as_str(),
                    r.address,
                    r.detail,
                    r.uptime_ms
                )
            };
            Ok(format!(
                "boot {count}; reset cause: {}; last crash: {crash}",
                r.cause.as_str()
            ))
        }
        "store-stress" => {
            let count: u32 = args
                .first()
                .and_then(|n| n.parse().ok())
                .ok_or("store-stress needs a count")?;
            let started = Instant::now();
            for i in 0..count {
                let mut payload = vec![63u8];
                payload.extend((0..64u32).map(|j| (i.wrapping_add(j) % 251) as u8));
                expect(
                    ch.request(kind::STORE_PUT, &payload)?,
                    kind::STORE_PUT_REPLY,
                )
                .map_err(|e| format!("write {i}: {e}"))?;
            }
            let last = expect(ch.request(kind::STORE_GET, &[63])?, kind::STORE_GET_REPLY)?;
            let want: Vec<u8> = (0..64u32)
                .map(|j| ((count - 1).wrapping_add(j) % 251) as u8)
                .collect();
            if last != want {
                return Err("key 63 does not hold the last value written".into());
            }
            Ok(format!(
                "{count} writes of 64 bytes in {} ms; key 63 holds the last one",
                started.elapsed().as_millis()
            ))
        }
        _ => Err(format!("unknown command `{command}`\n{USAGE}")),
    }
}

fn parse_key(arg: Option<&String>) -> Result<u8, String> {
    arg.and_then(|k| k.parse().ok())
        .ok_or_else(|| "give a key number".to_string())
}

/// Every request, then two bad frames that the kernel must reject.
fn selftest(ch: &mut Channel) -> bool {
    let mut ok = true;
    let mut check = |name: &str, result: Result<String, String>| match result {
        Ok(line) => println!("PASS {name}: {line}"),
        Err(e) => {
            ok = false;
            println!("FAIL {name}: {e}");
        }
    };
    for (name, command, args) in [
        ("ping", "ping", vec!["selftest-ping".to_string()]),
        ("ping (binary with zeros)", "ping-binary", vec![]),
        ("status", "status", vec![]),
        ("telemetry", "telemetry", vec![]),
        ("info", "info", vec![]),
    ] {
        let result = if command == "ping-binary" {
            let data: Vec<u8> = (0u8..64).collect();
            ch.request(kind::PING, &data)
                .and_then(|r| expect(r, kind::PONG))
                .and_then(|p| {
                    if p == data {
                        Ok("64 bytes echoed".into())
                    } else {
                        Err("payload differs".into())
                    }
                })
        } else {
            run_command(ch, command, &args)
        };
        check(name, result);
    }

    // A frame with one payload byte flipped after the CRC was computed.
    let mut wire = [0u8; MAX_WIRE];
    let n = encode_frame(kind::PING, 0x55, b"corrupt-me", &mut wire).unwrap();
    wire[6] ^= 0x20;
    let bad_crc = ch
        .send_raw(&wire[..n])
        .and_then(|()| ch.await_seq(0))
        .and_then(|r| match (r.kind, r.payload.as_slice()) {
            (kind::ERROR, [error_code::BAD_CRC, _]) => Ok("rejected with bad CRC".into()),
            _ => Err(format!("unexpected reply {:#04x} {:?}", r.kind, r.payload)),
        });
    check("corrupted frame", bad_crc);

    let unknown = ch
        .request(0x7E, &[])
        .and_then(|r| match (r.kind, r.payload.as_slice()) {
            (kind::ERROR, [error_code::UNKNOWN_KIND, 0x7E]) => {
                Ok("rejected as unknown kind".into())
            }
            _ => Err(format!("unexpected reply {:#04x} {:?}", r.kind, r.payload)),
        });
    check("unknown request", unknown);

    // Persistent store: write, read back, delete, and the kernel's own keys.
    let marker = format!("selftest-{}", std::process::id());
    check(
        "store put",
        run_command(ch, "put", &["20".into(), marker.clone()]),
    );
    check(
        "store get",
        run_command(ch, "get", &["20".into()]).and_then(|line| {
            if line.contains(&marker) {
                Ok(line)
            } else {
                Err(format!("read back {line}"))
            }
        }),
    );
    let deleted = run_command(ch, "put", &["21".into()])
        .and_then(|_| ch.request(kind::STORE_GET, &[21]))
        .and_then(|r| match (r.kind, r.payload.as_slice()) {
            (kind::ERROR, [error_code::NOT_FOUND, _]) => {
                Ok("deleted key reads as not found".into())
            }
            _ => Err(format!("unexpected reply {:#04x} {:?}", r.kind, r.payload)),
        });
    check("store delete", deleted);
    let reserved = ch.request(kind::STORE_PUT, &[0, 1, 2, 3, 4]).and_then(|r| {
        match (r.kind, r.payload.as_slice()) {
            (kind::ERROR, [error_code::REFUSED, _]) => {
                Ok("kernel key 0 (boot count) refused".into())
            }
            _ => Err(format!("unexpected reply {:#04x} {:?}", r.kind, r.payload)),
        }
    });
    check("store kernel key", reserved);
    check("boot info", run_command(ch, "boot-info", &[]));

    // The channel still answers after the bad frames.
    check(
        "ping after errors",
        run_command(ch, "ping", &["still-alive".to_string()]),
    );
    ok
}

#[cfg(unix)]
fn open_serial(device: &str) -> Result<Box<dyn Link>, String> {
    // Open first, then configure through that open descriptor (stty acts on
    // its stdin). macOS resets a serial port's settings when the last
    // descriptor closes, so `stty -f DEVICE` before opening would not stick.
    let file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(device)
        .map_err(|e| format!("cannot open {device}: {e}"))?;
    let stdin = file.try_clone().map_err(|e| e.to_string())?;
    // Raw 115200 8-N-1 with a 100 ms read timeout (`min 0 time 1`).
    let status = std::process::Command::new("stty")
        .args([
            "115200", "raw", "-echo", "-ixon", "-ixoff", "cs8", "-cstopb", "-parenb", "clocal",
            "min", "0", "time", "1",
        ])
        .stdin(stdin)
        .status()
        .map_err(|e| format!("stty failed to start: {e}"))?;
    if !status.success() {
        return Err(format!("stty could not configure {device}"));
    }
    Ok(Box::new(file))
}

#[cfg(unix)]
fn open_socket(path: &str, within: Duration) -> Result<Box<dyn Link>, String> {
    let deadline = Instant::now() + within;
    loop {
        match std::os::unix::net::UnixStream::connect(path) {
            Ok(stream) => {
                stream
                    .set_read_timeout(Some(Duration::from_millis(50)))
                    .map_err(|e| e.to_string())?;
                return Ok(Box::new(stream));
            }
            Err(e) if Instant::now() >= deadline => {
                return Err(format!("cannot connect to {path}: {e}"))
            }
            Err(_) => std::thread::sleep(Duration::from_millis(50)),
        }
    }
}

fn main() -> ExitCode {
    let mut args: Vec<String> = std::env::args().skip(1).collect();
    let mut serial = None;
    let mut socket = None;
    let mut timeout_ms = 2_000u64;
    let mut require_hello = false;
    while let Some(first) = args.first().cloned() {
        let value = || args.get(1).cloned();
        match first.as_str() {
            "--serial" => serial = value(),
            "--qemu-socket" => socket = value(),
            "--timeout-ms" => {
                timeout_ms = value().and_then(|v| v.parse().ok()).unwrap_or(timeout_ms)
            }
            "--require-hello" => {
                require_hello = true;
                args.remove(0);
                continue;
            }
            "-h" | "--help" => {
                println!("{USAGE}");
                return ExitCode::SUCCESS;
            }
            _ => break,
        }
        args.drain(..2.min(args.len()));
    }
    let Some(command) = args.first().cloned() else {
        eprintln!("{USAGE}");
        return ExitCode::from(2);
    };
    let timeout = Duration::from_millis(timeout_ms);

    let link = match (serial, socket) {
        (Some(device), None) => open_serial(&device),
        (None, Some(path)) => open_socket(&path, Duration::from_secs(10)),
        _ => Err(format!(
            "give exactly one of --serial or --qemu-socket\n{USAGE}"
        )),
    };
    let link = match link {
        Ok(link) => link,
        Err(e) => {
            eprintln!("maataa-link: {e}");
            return ExitCode::from(2);
        }
    };
    let mut ch = Channel {
        link,
        decoder: Decoder::new(),
        seq: 0,
        timeout,
        ignored_chunks: 0,
        hello: None,
    };

    if require_hello || command == "selftest" {
        match ch.wait_hello(if require_hello {
            timeout
        } else {
            Duration::from_millis(500)
        }) {
            Ok(true) => match show_info("hello", ch.hello.as_deref().unwrap_or_default()) {
                Ok(line) => println!("PASS {line}"),
                Err(e) => {
                    println!("FAIL hello: {e}");
                    return ExitCode::FAILURE;
                }
            },
            Ok(false) if require_hello => {
                println!("FAIL hello: no HELLO within {timeout_ms} ms");
                return ExitCode::FAILURE;
            }
            Ok(false) => println!("note: no HELLO seen (sent once at boot); continuing"),
            Err(e) => {
                println!("FAIL hello: {e}");
                return ExitCode::FAILURE;
            }
        }
    }

    let ok = if command == "selftest" {
        let ok = selftest(&mut ch);
        println!(
            "{}: host channel selftest ({} non-frame chunks ignored)",
            if ok { "PASS" } else { "FAIL" },
            ch.ignored_chunks
        );
        ok
    } else {
        match run_command(&mut ch, &command, &args[1..]) {
            Ok(line) => {
                println!("{line}");
                true
            }
            Err(e) => {
                eprintln!("maataa-link: {e}");
                false
            }
        }
    };
    if ok {
        ExitCode::SUCCESS
    } else {
        ExitCode::FAILURE
    }
}
