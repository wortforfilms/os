//! Maataa OS host channel (protocol version 1).
//!
//! Wire format: each frame is COBS-encoded and ends with a `0x00` byte. A
//! sender also writes one `0x00` before a frame, so bytes that are not part of
//! a frame (a log line, line noise) end up in a chunk of their own that fails
//! its CRC instead of corrupting the next frame.
//!
//! Decoded frame body:
//!
//! | Offset | Size | Field |
//! | --- | --- | --- |
//! | 0 | 1 | protocol version (`1`) |
//! | 1 | 1 | kind |
//! | 2 | 1 | sequence number, echoed in the reply |
//! | 3 | n | payload, at most [`MAX_PAYLOAD`] bytes |
//! | 3 + n | 4 | CRC-32 (IEEE, as zlib) over bytes `0..3 + n`, little-endian |
//!
//! The crate is `no_std` and allocation-free; the kernel and the host tool
//! share it.

#![cfg_attr(not(any(test, feature = "cli")), no_std)]

pub const PROTOCOL_VERSION: u8 = 1;
/// Largest payload in one frame.
pub const MAX_PAYLOAD: usize = 200;
/// Header (version, kind, sequence) plus CRC.
pub const OVERHEAD: usize = 3 + 4;
/// Largest decoded frame body.
pub const MAX_BODY: usize = MAX_PAYLOAD + OVERHEAD;
/// Largest encoded frame including the leading and trailing `0x00`. COBS adds
/// one byte per 254 bytes, plus one.
pub const MAX_WIRE: usize = MAX_BODY + MAX_BODY / 254 + 1 + 2;
/// Longest PING payload the kernel echoes.
pub const MAX_PING: usize = 64;

/// Message kinds. Requests come from the host; replies set the top bit.
pub mod kind {
    pub const PING: u8 = 0x01;
    pub const STATUS: u8 = 0x02;
    pub const TELEMETRY: u8 = 0x03;
    pub const INFO: u8 = 0x04;
    /// Payload `[key]`; reply `[value..]`.
    pub const STORE_GET: u8 = 0x05;
    /// Payload `[key, value..]` (empty value deletes); reply empty.
    pub const STORE_PUT: u8 = 0x06;

    /// Sent once by the kernel when the channel starts; payload as INFO.
    pub const HELLO: u8 = 0x80;
    pub const PONG: u8 = 0x81;
    pub const STATUS_REPLY: u8 = 0x82;
    pub const TELEMETRY_REPLY: u8 = 0x83;
    pub const INFO_REPLY: u8 = 0x84;
    pub const STORE_GET_REPLY: u8 = 0x85;
    pub const STORE_PUT_REPLY: u8 = 0x86;
    pub const ERROR: u8 = 0xFF;
}

/// Error codes carried in an ERROR frame: `[code, request kind]`.
pub mod error_code {
    pub const BAD_CRC: u8 = 1;
    pub const BAD_VERSION: u8 = 2;
    pub const UNKNOWN_KIND: u8 = 3;
    pub const BAD_LENGTH: u8 = 4;
    pub const OVERFLOW: u8 = 5;
    pub const UNAVAILABLE: u8 = 6;
    pub const BAD_COBS: u8 = 7;
    pub const NOT_FOUND: u8 = 8;
    /// The kernel refused (a kernel-reserved key, or no capability).
    pub const REFUSED: u8 = 9;

    pub const fn name(code: u8) -> &'static str {
        match code {
            BAD_CRC => "bad CRC",
            BAD_VERSION => "unsupported protocol version",
            UNKNOWN_KIND => "unknown request kind",
            BAD_LENGTH => "bad payload length",
            OVERFLOW => "frame too long",
            UNAVAILABLE => "not available on this board",
            BAD_COBS => "bad COBS encoding",
            NOT_FOUND => "key not found",
            REFUSED => "refused by the kernel",
            _ => "unknown error",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LinkError {
    /// The output buffer cannot hold the result.
    BufferTooSmall,
    /// Payload longer than [`MAX_PAYLOAD`].
    PayloadTooLong,
    /// A zero byte inside COBS data, or a code byte pointing past the end.
    BadCobs,
    /// The decoded body is shorter than the header and CRC.
    TooShort,
    BadCrc,
    BadVersion,
    /// More bytes arrived before a delimiter than any valid frame can have.
    Overflow,
}

impl LinkError {
    /// The code a receiver reports back in an ERROR frame.
    pub const fn code(self) -> u8 {
        match self {
            Self::BadCrc => error_code::BAD_CRC,
            Self::BadVersion => error_code::BAD_VERSION,
            Self::Overflow => error_code::OVERFLOW,
            Self::BadCobs => error_code::BAD_COBS,
            Self::TooShort | Self::PayloadTooLong | Self::BufferTooSmall => error_code::BAD_LENGTH,
        }
    }
}

/// CRC-32/ISO-HDLC (the zlib and Ethernet CRC), bitwise to keep flash small.
pub const fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = 0xFFFF_FFFFu32;
    let mut i = 0;
    while i < bytes.len() {
        crc ^= bytes[i] as u32;
        let mut bit = 0;
        while bit < 8 {
            crc = if crc & 1 != 0 {
                (crc >> 1) ^ 0xEDB8_8320
            } else {
                crc >> 1
            };
            bit += 1;
        }
        i += 1;
    }
    !crc
}

/// COBS-encodes `input` into `out` (no delimiters). Returns the length.
pub fn cobs_encode(input: &[u8], out: &mut [u8]) -> Result<usize, LinkError> {
    let mut code_at = 0;
    let mut write = 1;
    let mut code: u8 = 1;
    if out.is_empty() {
        return Err(LinkError::BufferTooSmall);
    }
    for &byte in input {
        if byte == 0 {
            out[code_at] = code;
            code_at = write;
            write += 1;
            code = 1;
            if code_at >= out.len() {
                return Err(LinkError::BufferTooSmall);
            }
        } else {
            if write >= out.len() {
                return Err(LinkError::BufferTooSmall);
            }
            out[write] = byte;
            write += 1;
            code += 1;
            if code == 0xFF {
                out[code_at] = code;
                code_at = write;
                write += 1;
                code = 1;
                if code_at >= out.len() {
                    return Err(LinkError::BufferTooSmall);
                }
            }
        }
    }
    out[code_at] = code;
    Ok(write)
}

/// Decodes one COBS chunk (no delimiters) into `out`. Returns the length.
pub fn cobs_decode(input: &[u8], out: &mut [u8]) -> Result<usize, LinkError> {
    let mut read = 0;
    let mut write = 0;
    while read < input.len() {
        let code = input[read];
        if code == 0 {
            return Err(LinkError::BadCobs);
        }
        read += 1;
        let run = code as usize - 1;
        if read + run > input.len() {
            return Err(LinkError::BadCobs);
        }
        for &byte in &input[read..read + run] {
            if byte == 0 {
                return Err(LinkError::BadCobs);
            }
            if write >= out.len() {
                return Err(LinkError::BufferTooSmall);
            }
            out[write] = byte;
            write += 1;
        }
        read += run;
        if code != 0xFF && read < input.len() {
            if write >= out.len() {
                return Err(LinkError::BufferTooSmall);
            }
            out[write] = 0;
            write += 1;
        }
    }
    Ok(write)
}

/// Decodes a COBS chunk in place and returns the decoded length. The output
/// never overtakes the input, so one buffer is enough (the kernel task keeps
/// its stack small this way).
pub fn cobs_decode_in_place(buf: &mut [u8]) -> Result<usize, LinkError> {
    let len = buf.len();
    let mut read = 0;
    let mut write = 0;
    while read < len {
        let code = buf[read];
        if code == 0 {
            return Err(LinkError::BadCobs);
        }
        read += 1;
        let run = code as usize - 1;
        if read + run > len {
            return Err(LinkError::BadCobs);
        }
        for i in 0..run {
            let byte = buf[read + i];
            if byte == 0 {
                return Err(LinkError::BadCobs);
            }
            buf[write] = byte;
            write += 1;
        }
        read += run;
        if code != 0xFF && read < len {
            buf[write] = 0;
            write += 1;
        }
    }
    Ok(write)
}

/// A decoded frame borrowed from the decoder's buffer.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Frame<'a> {
    pub kind: u8,
    pub seq: u8,
    pub payload: &'a [u8],
}

/// Builds a complete wire frame (leading `0x00`, COBS body, trailing `0x00`).
pub fn encode_frame(kind: u8, seq: u8, payload: &[u8], out: &mut [u8]) -> Result<usize, LinkError> {
    if payload.len() > MAX_PAYLOAD {
        return Err(LinkError::PayloadTooLong);
    }
    let mut body = [0u8; MAX_BODY];
    body[0] = PROTOCOL_VERSION;
    body[1] = kind;
    body[2] = seq;
    let end = 3 + payload.len();
    body[3..end].copy_from_slice(payload);
    let crc = crc32(&body[..end]);
    body[end..end + 4].copy_from_slice(&crc.to_le_bytes());
    let body_len = end + 4;

    if out.len() < 2 {
        return Err(LinkError::BufferTooSmall);
    }
    out[0] = 0;
    let last = out.len() - 1;
    let encoded = cobs_encode(&body[..body_len], &mut out[1..last])?;
    out[1 + encoded] = 0;
    Ok(encoded + 2)
}

/// Checks a decoded body and splits it into a [`Frame`].
pub fn parse_body(body: &[u8]) -> Result<Frame<'_>, LinkError> {
    if body.len() < OVERHEAD {
        return Err(LinkError::TooShort);
    }
    let crc_at = body.len() - 4;
    let mut crc = [0u8; 4];
    crc.copy_from_slice(&body[crc_at..]);
    if crc32(&body[..crc_at]) != u32::from_le_bytes(crc) {
        return Err(LinkError::BadCrc);
    }
    if body[0] != PROTOCOL_VERSION {
        return Err(LinkError::BadVersion);
    }
    Ok(Frame {
        kind: body[1],
        seq: body[2],
        payload: &body[3..crc_at],
    })
}

/// What the stream decoder produced for one delimiter.
#[derive(Debug, Eq, PartialEq)]
pub enum Event<'a> {
    Frame(Frame<'a>),
    /// A chunk that is not a valid frame; the decoder has resynchronised.
    Invalid(LinkError),
}

/// Byte-at-a-time receiver. Collects COBS bytes until `0x00`, then decodes
/// in place.
pub struct Decoder {
    raw: [u8; MAX_WIRE],
    raw_len: usize,
    overflowed: bool,
}

impl Default for Decoder {
    fn default() -> Self {
        Self::new()
    }
}

impl Decoder {
    pub const fn new() -> Self {
        Self {
            raw: [0; MAX_WIRE],
            raw_len: 0,
            overflowed: false,
        }
    }

    /// Feeds one byte. Returns an event when a delimiter ends a non-empty chunk.
    pub fn push(&mut self, byte: u8) -> Option<Event<'_>> {
        if byte != 0 {
            if self.raw_len < self.raw.len() {
                self.raw[self.raw_len] = byte;
                self.raw_len += 1;
            } else {
                self.overflowed = true;
            }
            return None;
        }
        let len = core::mem::replace(&mut self.raw_len, 0);
        if core::mem::replace(&mut self.overflowed, false) {
            return Some(Event::Invalid(LinkError::Overflow));
        }
        if len == 0 {
            return None;
        }
        let decoded = match cobs_decode_in_place(&mut self.raw[..len]) {
            Ok(decoded) => decoded,
            Err(error) => return Some(Event::Invalid(error)),
        };
        if decoded > MAX_BODY {
            return Some(Event::Invalid(LinkError::Overflow));
        }
        Some(match parse_body(&self.raw[..decoded]) {
            Ok(frame) => Event::Frame(frame),
            Err(error) => Event::Invalid(error),
        })
    }
}

/// STATUS reply payload: the kernel's view of time and tasks.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct Status {
    pub uptime_ns: u64,
    pub ticks: u64,
    pub tick_hz: u32,
    pub core_hz: u32,
    /// Bytes the UART receive FIFO dropped because it was full.
    pub rx_dropped: u32,
    pub tasks_alive: u8,
    pub tasks_total: u8,
    pub clock_regressions: u16,
}

impl Status {
    pub const BYTES: usize = 32;

    pub fn encode(&self) -> [u8; Self::BYTES] {
        let mut out = [0u8; Self::BYTES];
        out[0..8].copy_from_slice(&self.uptime_ns.to_le_bytes());
        out[8..16].copy_from_slice(&self.ticks.to_le_bytes());
        out[16..20].copy_from_slice(&self.tick_hz.to_le_bytes());
        out[20..24].copy_from_slice(&self.core_hz.to_le_bytes());
        out[24..28].copy_from_slice(&self.rx_dropped.to_le_bytes());
        out[28] = self.tasks_alive;
        out[29] = self.tasks_total;
        out[30..32].copy_from_slice(&self.clock_regressions.to_le_bytes());
        out
    }

    pub fn decode(bytes: &[u8]) -> Option<Self> {
        if bytes.len() != Self::BYTES {
            return None;
        }
        let u64_at = |i: usize| {
            let mut b = [0u8; 8];
            b.copy_from_slice(&bytes[i..i + 8]);
            u64::from_le_bytes(b)
        };
        let u32_at = |i: usize| {
            let mut b = [0u8; 4];
            b.copy_from_slice(&bytes[i..i + 4]);
            u32::from_le_bytes(b)
        };
        Some(Self {
            uptime_ns: u64_at(0),
            ticks: u64_at(8),
            tick_hz: u32_at(16),
            core_hz: u32_at(20),
            rx_dropped: u32_at(24),
            tasks_alive: bytes[28],
            tasks_total: bytes[29],
            clock_regressions: u16::from_le_bytes([bytes[30], bytes[31]]),
        })
    }
}

/// INFO and HELLO payload: `[version, name_len, name.., kernel_len, kernel..]`.
pub fn encode_info(board: &str, kernel_version: &str, out: &mut [u8]) -> Result<usize, LinkError> {
    let (b, k) = (board.as_bytes(), kernel_version.as_bytes());
    if b.len() > 64 || k.len() > 32 {
        return Err(LinkError::PayloadTooLong);
    }
    let len = 3 + b.len() + k.len();
    if out.len() < len {
        return Err(LinkError::BufferTooSmall);
    }
    out[0] = PROTOCOL_VERSION;
    out[1] = b.len() as u8;
    out[2..2 + b.len()].copy_from_slice(b);
    out[2 + b.len()] = k.len() as u8;
    out[3 + b.len()..len].copy_from_slice(k);
    Ok(len)
}

/// Splits an INFO payload into (protocol version, board, kernel version).
pub fn decode_info(payload: &[u8]) -> Option<(u8, &str, &str)> {
    let version = *payload.first()?;
    let board_len = *payload.get(1)? as usize;
    let board = payload.get(2..2 + board_len)?;
    let kernel_len = *payload.get(2 + board_len)? as usize;
    let kernel = payload.get(3 + board_len..3 + board_len + kernel_len)?;
    if payload.len() != 3 + board_len + kernel_len {
        return None;
    }
    Some((
        version,
        core::str::from_utf8(board).ok()?,
        core::str::from_utf8(kernel).ok()?,
    ))
}

/// Answers one request. `status`, `telemetry` and the info strings come from
/// the kernel; the function only formats. Returns the reply kind and payload
/// length written to `payload_out`.
pub fn answer(
    request: &Frame<'_>,
    board: &str,
    kernel_version: &str,
    status: Option<&Status>,
    telemetry: Option<&[u8]>,
    payload_out: &mut [u8; MAX_PAYLOAD],
) -> (u8, usize) {
    let error = |out: &mut [u8; MAX_PAYLOAD], code: u8| {
        out[0] = code;
        out[1] = request.kind;
        (kind::ERROR, 2)
    };
    match request.kind {
        kind::PING => {
            if request.payload.len() > MAX_PING {
                return error(payload_out, error_code::BAD_LENGTH);
            }
            let n = request.payload.len();
            payload_out[..n].copy_from_slice(request.payload);
            (kind::PONG, n)
        }
        kind::STATUS | kind::TELEMETRY | kind::INFO if !request.payload.is_empty() => {
            error(payload_out, error_code::BAD_LENGTH)
        }
        kind::STATUS => match status {
            Some(status) => {
                payload_out[..Status::BYTES].copy_from_slice(&status.encode());
                (kind::STATUS_REPLY, Status::BYTES)
            }
            None => error(payload_out, error_code::UNAVAILABLE),
        },
        kind::TELEMETRY => match telemetry {
            Some(frame) if frame.len() <= MAX_PAYLOAD => {
                payload_out[..frame.len()].copy_from_slice(frame);
                (kind::TELEMETRY_REPLY, frame.len())
            }
            _ => error(payload_out, error_code::UNAVAILABLE),
        },
        kind::INFO => match encode_info(board, kernel_version, payload_out) {
            Ok(n) => (kind::INFO_REPLY, n),
            Err(_) => error(payload_out, error_code::UNAVAILABLE),
        },
        _ => error(payload_out, error_code::UNKNOWN_KIND),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    type Decoded = Result<(u8, u8, Vec<u8>), LinkError>;

    fn feed(decoder: &mut Decoder, bytes: &[u8]) -> Vec<Decoded> {
        let mut events = Vec::new();
        for &b in bytes {
            if let Some(event) = decoder.push(b) {
                events.push(match event {
                    Event::Frame(f) => Ok((f.kind, f.seq, f.payload.to_vec())),
                    Event::Invalid(e) => Err(e),
                });
            }
        }
        events
    }

    #[test]
    fn crc32_matches_zlib_check_value() {
        assert_eq!(crc32(b"123456789"), 0xCBF4_3926);
        assert_eq!(crc32(b""), 0);
    }

    #[test]
    fn cobs_round_trips_edge_cases() {
        let mut long = [0x11u8; 600];
        long[300] = 0;
        let cases: [&[u8]; 8] = [
            b"",
            &[0],
            &[0, 0],
            &[1, 2, 3],
            &[1, 0, 2, 0],
            &[0xFF; 254],
            &[0xFF; 255],
            &long,
        ];
        for case in cases {
            let mut enc = [0u8; 700];
            let n = cobs_encode(case, &mut enc).unwrap();
            assert!(
                !enc[..n].contains(&0),
                "no zero in encoded {:?}",
                case.len()
            );
            let mut dec = [0u8; 700];
            let m = cobs_decode(&enc[..n], &mut dec).unwrap();
            assert_eq!(&dec[..m], case);
        }
    }

    #[test]
    fn in_place_decode_matches_copying_decode() {
        let mut long = [0x22u8; 400];
        long[10] = 0;
        long[399] = 0;
        for case in [&b""[..], &[0, 0, 1][..], &[0xFF; 300][..], &long[..]] {
            let mut enc = [0u8; 600];
            let n = cobs_encode(case, &mut enc).unwrap();
            let m = cobs_decode_in_place(&mut enc[..n]).unwrap();
            assert_eq!(&enc[..m], case);
        }
    }

    #[test]
    fn cobs_known_vectors() {
        let mut out = [0u8; 16];
        let n = cobs_encode(&[0x11, 0x22, 0x00, 0x33], &mut out).unwrap();
        assert_eq!(&out[..n], &[0x03, 0x11, 0x22, 0x02, 0x33]);
        let n = cobs_encode(&[0x00], &mut out).unwrap();
        assert_eq!(&out[..n], &[0x01, 0x01]);
    }

    #[test]
    fn cobs_rejects_bad_input() {
        let mut out = [0u8; 16];
        assert_eq!(
            cobs_decode(&[0x05, 1, 2], &mut out),
            Err(LinkError::BadCobs)
        );
        assert_eq!(
            cobs_decode(&[0x03, 1, 0], &mut out),
            Err(LinkError::BadCobs)
        );
        assert_eq!(cobs_decode(&[0x00], &mut out), Err(LinkError::BadCobs));
    }

    #[test]
    fn frame_round_trip_through_decoder() {
        let mut wire = [0u8; MAX_WIRE];
        let n = encode_frame(kind::PING, 7, b"hello\0world", &mut wire).unwrap();
        assert_eq!(wire[0], 0);
        assert_eq!(wire[n - 1], 0);
        let mut d = Decoder::new();
        let events = feed(&mut d, &wire[..n]);
        assert_eq!(events, vec![Ok((kind::PING, 7, b"hello\0world".to_vec()))]);
    }

    #[test]
    fn max_payload_fits_max_wire() {
        let payload = [0xA5u8; MAX_PAYLOAD];
        let mut wire = [0u8; MAX_WIRE];
        let n = encode_frame(kind::PONG, 1, &payload, &mut wire).unwrap();
        assert!(n <= MAX_WIRE);
        assert!(n <= 256, "one UART syscall carries a whole frame");
        let mut d = Decoder::new();
        assert_eq!(feed(&mut d, &wire[..n]).len(), 1);
        assert_eq!(
            encode_frame(kind::PONG, 1, &[0u8; MAX_PAYLOAD + 1], &mut wire),
            Err(LinkError::PayloadTooLong)
        );
    }

    #[test]
    fn noise_before_a_frame_is_isolated() {
        let mut wire = [0u8; MAX_WIRE];
        let n = encode_frame(kind::STATUS, 3, &[], &mut wire).unwrap();
        let mut stream = b"task 3: some log text\r\n".to_vec();
        stream.extend_from_slice(&wire[..n]);
        let mut d = Decoder::new();
        let events = feed(&mut d, &stream);
        assert_eq!(events.len(), 2);
        assert!(events[0].is_err());
        assert_eq!(events[1], Ok((kind::STATUS, 3, vec![])));
    }

    #[test]
    fn corrupted_byte_fails_crc_then_next_frame_decodes() {
        let mut wire = [0u8; MAX_WIRE];
        let n = encode_frame(kind::PING, 1, b"abc", &mut wire).unwrap();
        let mut stream = wire[..n].to_vec();
        stream[5] ^= 0x40; // a payload byte; stays non-zero
        stream.extend_from_slice(&wire[..n]);
        let mut d = Decoder::new();
        let events = feed(&mut d, &stream);
        assert_eq!(events[0], Err(LinkError::BadCrc));
        assert_eq!(events[1], Ok((kind::PING, 1, b"abc".to_vec())));
    }

    #[test]
    fn overlong_chunk_reports_overflow_and_recovers() {
        let mut stream = vec![0x42u8; MAX_WIRE + 50];
        stream.push(0);
        let mut wire = [0u8; MAX_WIRE];
        let n = encode_frame(kind::INFO, 9, &[], &mut wire).unwrap();
        stream.extend_from_slice(&wire[..n]);
        let mut d = Decoder::new();
        let events = feed(&mut d, &stream);
        assert_eq!(events[0], Err(LinkError::Overflow));
        assert_eq!(events[1], Ok((kind::INFO, 9, vec![])));
    }

    #[test]
    fn wrong_version_is_rejected() {
        let mut body = [2u8, kind::PING, 0, 0, 0, 0, 0];
        let crc = crc32(&body[..3]);
        body[3..].copy_from_slice(&crc.to_le_bytes());
        assert_eq!(parse_body(&body), Err(LinkError::BadVersion));
        assert_eq!(parse_body(&body[..5]), Err(LinkError::TooShort));
    }

    #[test]
    fn status_round_trips() {
        let s = Status {
            uptime_ns: 1_234_567_890_123,
            ticks: 1_234_567,
            tick_hz: 1000,
            core_hz: 168_000_000,
            rx_dropped: 3,
            tasks_alive: 4,
            tasks_total: 6,
            clock_regressions: 0,
        };
        assert_eq!(Status::decode(&s.encode()), Some(s));
        assert_eq!(Status::decode(&[0; 31]), None);
    }

    #[test]
    fn info_round_trips_and_rejects_truncation() {
        let mut out = [0u8; MAX_PAYLOAD];
        let n = encode_info("stm32f411", "0.1.0-alpha.1", &mut out).unwrap();
        assert_eq!(
            decode_info(&out[..n]),
            Some((1, "stm32f411", "0.1.0-alpha.1"))
        );
        assert_eq!(decode_info(&out[..n - 1]), None);
    }

    #[test]
    fn answer_covers_every_request() {
        let status = Status {
            tick_hz: 1000,
            ..Status::default()
        };
        let telemetry = [7u8; 40];
        let mut out = [0u8; MAX_PAYLOAD];
        let req = |kind, payload| Frame {
            kind,
            seq: 5,
            payload,
        };

        assert_eq!(
            answer(&req(kind::PING, b"hi"), "b", "v", None, None, &mut out),
            (kind::PONG, 2)
        );
        assert_eq!(&out[..2], b"hi");
        assert_eq!(
            answer(
                &req(kind::PING, &[1; MAX_PING + 1]),
                "b",
                "v",
                None,
                None,
                &mut out
            ),
            (kind::ERROR, 2)
        );
        assert_eq!(out[..2], [error_code::BAD_LENGTH, kind::PING]);
        assert_eq!(
            answer(
                &req(kind::STATUS, b""),
                "b",
                "v",
                Some(&status),
                None,
                &mut out
            ),
            (kind::STATUS_REPLY, Status::BYTES)
        );
        assert_eq!(Status::decode(&out[..Status::BYTES]), Some(status));
        assert_eq!(
            answer(&req(kind::STATUS, b""), "b", "v", None, None, &mut out),
            (kind::ERROR, 2)
        );
        assert_eq!(out[0], error_code::UNAVAILABLE);
        assert_eq!(
            answer(
                &req(kind::TELEMETRY, b""),
                "b",
                "v",
                None,
                Some(&telemetry),
                &mut out
            ),
            (kind::TELEMETRY_REPLY, 40)
        );
        assert_eq!(
            answer(&req(kind::INFO, b""), "brd", "1.0", None, None, &mut out).0,
            kind::INFO_REPLY
        );
        assert_eq!(
            answer(&req(kind::INFO, b"x"), "brd", "1.0", None, None, &mut out),
            (kind::ERROR, 2)
        );
        assert_eq!(
            answer(&req(0x7E, b""), "b", "v", None, None, &mut out),
            (kind::ERROR, 2)
        );
        assert_eq!(out[..2], [error_code::UNKNOWN_KIND, 0x7E]);
    }
}
