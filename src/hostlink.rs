//! Host channel: a task that answers framed requests over USART2.
//!
//! The codec and message set live in `crates/maataa-link`, shared with the
//! host tool. This module adds the kernel's side: the status block behind
//! syscall 14 and the unprivileged task that serves the channel. See
//! `docs/host-channel.md`.

use crate::ipc::frame::MOSF_FRAME_BYTES;
use maataa_link::Status;

/// Bytes syscall 14 (`SYS_HOST_STATUS`) writes:
/// `[Status; 32][telemetry present: u8][0; 3][MOSF telemetry frame; 40]`.
pub const HOST_STATUS_BYTES: usize = Status::BYTES + 4 + MOSF_FRAME_BYTES;
const TELEMETRY_FLAG_AT: usize = Status::BYTES;
const TELEMETRY_AT: usize = Status::BYTES + 4;

/// Packs a status block. Pure, so the host tests cover the layout.
pub fn pack_status(
    status: &Status,
    telemetry: Option<&[u8; MOSF_FRAME_BYTES]>,
    out: &mut [u8; HOST_STATUS_BYTES],
) {
    *out = [0; HOST_STATUS_BYTES];
    out[..Status::BYTES].copy_from_slice(&status.encode());
    if let Some(frame) = telemetry {
        out[TELEMETRY_FLAG_AT] = 1;
        out[TELEMETRY_AT..].copy_from_slice(frame);
    }
}

/// Splits a status block back into its parts.
pub fn unpack_status(bytes: &[u8; HOST_STATUS_BYTES]) -> (Option<Status>, Option<&[u8]>) {
    let status = Status::decode(&bytes[..Status::BYTES]);
    let telemetry = (bytes[TELEMETRY_FLAG_AT] == 1).then(|| &bytes[TELEMETRY_AT..]);
    (status, telemetry)
}

#[cfg(target_arch = "arm")]
pub use kernel_side::{fill_status, publish_telemetry};

#[cfg(target_arch = "arm")]
mod kernel_side {
    use super::*;
    use core::cell::Cell;
    use cortex_m::interrupt::{self, Mutex};

    static LAST_TELEMETRY: Mutex<Cell<Option<[u8; MOSF_FRAME_BYTES]>>> =
        Mutex::new(Cell::new(None));

    /// Keeps the most recent valid MOSF telemetry frame for the TELEMETRY reply.
    pub fn publish_telemetry(frame: &[u8; MOSF_FRAME_BYTES]) {
        interrupt::free(|cs| LAST_TELEMETRY.borrow(cs).set(Some(*frame)));
    }

    /// The kernel half of syscall 14.
    pub fn fill_status(out: &mut [u8; HOST_STATUS_BYTES]) {
        let (alive, total) = crate::sched::task_counts();
        let status = Status {
            uptime_ns: crate::clock::now_nanos(),
            ticks: crate::clock::get_ticks(),
            tick_hz: crate::clock::TICK_HZ,
            core_hz: crate::clock::config().map_or(0, |c| c.core_hz),
            rx_dropped: crate::drivers::uart::dropped_receive_bytes(),
            tasks_alive: alive.min(u8::MAX as usize) as u8,
            tasks_total: total.min(u8::MAX as usize) as u8,
            clock_regressions: crate::clock::regressions().min(u16::MAX as u32) as u16,
        };
        let telemetry = interrupt::free(|cs| LAST_TELEMETRY.borrow(cs).get());
        pack_status(&status, telemetry.as_ref(), out);
    }
}

/// The channel task. It runs unprivileged and reaches the UART and the status
/// block only through supervisor calls.
#[cfg(target_arch = "arm")]
pub fn channel_task() -> ! {
    use crate::syscall;
    use maataa_link::{
        answer, encode_frame, encode_info, kind, Decoder, Event, MAX_PAYLOAD, MAX_WIRE,
    };

    let mut decoder = Decoder::new();
    let mut wire = [0u8; MAX_WIRE];
    let mut payload = [0u8; MAX_PAYLOAD];
    let mut status_bytes = [0u8; HOST_STATUS_BYTES];
    let mut rx = [0u8; 16];
    let version = env!("CARGO_PKG_VERSION");

    let send = |kind: u8, seq: u8, body: &[u8], wire: &mut [u8; MAX_WIRE]| -> Result<(), u32> {
        let n = encode_frame(kind, seq, body, wire).map_err(|_| syscall::E_TOOLONG)?;
        syscall::uart_write(&wire[..n]).map(|_| ())
    };

    let info_len = encode_info(crate::board::NAME, version, &mut payload).unwrap_or(0);
    match send(kind::HELLO, 0, &payload[..info_len], &mut wire) {
        Ok(()) => crate::uprintln!(
            "host channel: ready on USART2 (protocol {})",
            maataa_link::PROTOCOL_VERSION
        ),
        Err(e) => {
            crate::uprintln!("host channel: not started: {}", syscall::error_name(e));
            // No syscalls from here on: without its capabilities the task
            // would only collect refusals.
            loop {
                crate::clock::idle();
            }
        }
    }

    let mut served: u32 = 0;
    let mut rejected: u32 = 0;
    loop {
        let count = match syscall::uart_read(&mut rx) {
            Ok(count) => count,
            Err(e) => {
                crate::uprintln!("host channel: read failed: {}", syscall::error_name(e));
                let _ = syscall::sleep_ms(100);
                continue;
            }
        };
        for &byte in &rx[..count] {
            let reply = match decoder.push(byte) {
                None => continue,
                Some(Event::Frame(request)) => {
                    let (status, telemetry) = match syscall::host_status(&mut status_bytes) {
                        Ok(()) => unpack_status(&status_bytes),
                        Err(_) => (None, None),
                    };
                    let (reply_kind, len) = answer(
                        &request,
                        crate::board::NAME,
                        version,
                        status.as_ref(),
                        telemetry,
                        &mut payload,
                    );
                    if reply_kind == kind::ERROR {
                        rejected = rejected.wrapping_add(1);
                    } else {
                        served = served.wrapping_add(1);
                    }
                    (reply_kind, request.seq, len)
                }
                Some(Event::Invalid(error)) => {
                    rejected = rejected.wrapping_add(1);
                    payload[0] = error.code();
                    payload[1] = 0;
                    (kind::ERROR, 0, 2)
                }
            };
            let (reply_kind, seq, len) = reply;
            if let Err(e) = send(reply_kind, seq, &payload[..len], &mut wire) {
                crate::uprintln!("host channel: write failed: {}", syscall::error_name(e));
            }
            if served.wrapping_add(rejected) % 16 == 0 {
                crate::uprintln!("host channel: {} served, {} rejected", served, rejected);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_block_round_trips_with_and_without_telemetry() {
        let status = Status {
            uptime_ns: 5_000_000,
            ticks: 5,
            tick_hz: 1000,
            core_hz: 100_000_000,
            rx_dropped: 0,
            tasks_alive: 4,
            tasks_total: 6,
            clock_regressions: 0,
        };
        let mut block = [0xAAu8; HOST_STATUS_BYTES];
        pack_status(&status, None, &mut block);
        assert_eq!(unpack_status(&block), (Some(status), None));

        let frame = [9u8; MOSF_FRAME_BYTES];
        pack_status(&status, Some(&frame), &mut block);
        let (decoded, telemetry) = unpack_status(&block);
        assert_eq!(decoded, Some(status));
        assert_eq!(telemetry, Some(&frame[..]));
        assert_eq!(HOST_STATUS_BYTES, 76);
    }
}
