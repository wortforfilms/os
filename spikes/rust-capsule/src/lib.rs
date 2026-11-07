//! Rust capsule spike: the same shape as `capsules/heartbeat.wat`, written
//! in Rust. `init` and `tick` build a Modbus RTU read request (function 03)
//! and its CRC-16, the core of the planned `modbus` capsule.
//!
//! Build: `cargo build --release` in this directory (needs the
//! `wasm32v1-none` target). Check: `scripts/rust-capsule-spike.sh`.

#![no_std]

#[link(wasm_import_module = "maataa")]
extern "C" {
    fn log(value: i32);
    fn log_str(ptr: *const u8, len: i32);
}

/// The signed schedule, read from the `maataa` custom section.
#[used]
#[link_section = "maataa"]
static MANIFEST: [u8; 22] = *b"ticks=3 period_ms=1000";

static GREETING: &[u8] = b"rust capsule up";

/// Request frame: address, function, register (2), count (2), CRC (2).
static mut FRAME: [u8; 8] = [0; 8];
static mut TICKS: i32 = 0;
/// Where the host (later: the RS-485 driver) puts a reply.
static mut REPLY: [u8; 256] = [0; 256];

/// CRC-16/MODBUS: polynomial 0xA001 (reflected 0x8005), start 0xFFFF.
fn crc16(bytes: &[u8]) -> u16 {
    let mut crc: u16 = 0xFFFF;
    for &b in bytes {
        crc ^= b as u16;
        let mut bit = 0;
        while bit < 8 {
            crc = if crc & 1 != 0 {
                (crc >> 1) ^ 0xA001
            } else {
                crc >> 1
            };
            bit += 1;
        }
    }
    crc
}

/// Fills FRAME with "read `count` holding registers from `register`" for
/// slave `address`, appends the CRC (low byte first), and returns the CRC.
fn build_request(address: u8, register: u16, count: u16) -> i32 {
    // SAFETY: capsules are single-threaded; nothing else touches FRAME.
    let frame = unsafe { &mut *core::ptr::addr_of_mut!(FRAME) };
    frame[0] = address;
    frame[1] = 0x03;
    frame[2] = (register >> 8) as u8;
    frame[3] = register as u8;
    frame[4] = (count >> 8) as u8;
    frame[5] = count as u8;
    let crc = crc16(&frame[..6]);
    frame[6] = crc as u8;
    frame[7] = (crc >> 8) as u8;
    crc as i32
}

/// Runs once: announce, then the classic example 01 03 0000 000A, whose
/// CRC is C5 CD on the wire (0xCDC5).
#[no_mangle]
pub extern "C" fn init() -> i32 {
    // SAFETY: GREETING lies in this module's memory.
    unsafe { log_str(GREETING.as_ptr(), GREETING.len() as i32) };
    let crc = build_request(0x01, 0x0000, 0x000A);
    // SAFETY: an import with no memory access.
    unsafe { log(crc) };
    crc
}

/// Runs each period: request register `tick` from slave 1; returns the CRC.
#[no_mangle]
pub extern "C" fn tick() -> i32 {
    // SAFETY: as for FRAME.
    let n = unsafe {
        TICKS += 1;
        TICKS
    };
    build_request(0x01, n as u16, 0x0002)
}

/// Address of the reply buffer, so a test host can fill it.
#[no_mangle]
pub extern "C" fn reply_buf() -> i32 {
    core::ptr::addr_of!(REPLY) as i32
}

/// Checks a function-03 reply of `len` bytes in REPLY and returns its first
/// register, or a negative code: -1 short, -2 wrong slave, -3 wrong
/// function, -4 wrong length, -5 bad CRC, -6 no register, -100 - n for
/// Modbus exception n. A `len` above 256 panics (bounds check), on purpose:
/// it shows a Rust panic ends as a trap, not a hang.
#[no_mangle]
pub extern "C" fn check_reply(len: i32) -> i32 {
    // SAFETY: as for FRAME.
    let all = unsafe { &*core::ptr::addr_of!(REPLY) };
    let r = &all[..len as usize];
    if r.len() < 5 {
        return -1;
    }
    if r[0] != 0x01 {
        return -2;
    }
    if r[1] & 0x80 != 0 {
        return -100 - r[2] as i32;
    }
    if r[1] != 0x03 {
        return -3;
    }
    let n = r[2] as usize;
    if r.len() != 5 + n {
        return -4;
    }
    let crc = crc16(&r[..r.len() - 2]);
    let got = r[r.len() - 2] as u16 | (r[r.len() - 1] as u16) << 8;
    if crc != got {
        return -5;
    }
    if n < 2 {
        return -6;
    }
    ((r[3] as i32) << 8) | r[4] as i32
}

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}
