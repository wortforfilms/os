//! RS-485 port for Modbus RTU, step 3 of the drivers plan (first part).
//!
//! The kernel does one thing for RS-485: send a request and return the
//! reply, or report why not. Everything Modbus-specific (addresses, function
//! codes, CRC, register maps) belongs to the `modbus` capsule.
//!
//! This part has no hardware access and no syscall. It holds:
//!
//! - [`LineConfig`]: baud rate, parity and stop bits, the USART register
//!   bits for them, and the Modbus timing (character time, 3.5-character gap);
//! - [`Reply`]: decides when a reply is complete (line quiet for the gap after
//!   the first byte, buffer full), timed out, or broken by a line error;
//! - [`transfer`]: one request/reply exchange over any [`Port`]: wait for a
//!   quiet line, raise DE, send, wait for transmission complete (not just an
//!   empty buffer), drop DE at once, collect the reply.
//!
//! Host tests drive [`transfer`] over a simulated port. The USART1 + PA8
//! port for the F446, with the receive interrupt and the blocking call, come
//! with the board (step 3, second part) and the device syscalls (step 4).

// Used by the host tests now and by the USART1 port and DEV_IO later.
#![cfg_attr(not(test), allow(dead_code))]

/// Parity of the 8 data bits. Modbus RTU uses even parity by default, or
/// none with two stop bits; odd parity is not offered.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Parity {
    None,
    Even,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StopBits {
    One,
    Two,
}

/// Why a transfer or a setting failed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Rs485Error {
    /// Baud rate outside 1,200-115,200.
    BadBaud,
    /// The baud rate cannot be reached from this peripheral clock.
    BaudUnreachable,
    /// The request is empty or longer than the buffer.
    BadLength,
    /// The line never went quiet for the gap before the timeout.
    LineBusy,
    /// The transmitter did not take or finish a byte in time.
    SendTimeout,
    /// No reply byte before the timeout.
    Timeout,
    Framing,
    Parity,
    Noise,
    Overrun,
}

impl Rs485Error {
    pub const fn as_str(self) -> &'static str {
        match self {
            Rs485Error::BadBaud => "baud rate outside 1200-115200",
            Rs485Error::BaudUnreachable => "baud rate not reachable from this clock",
            Rs485Error::BadLength => "request empty or longer than the buffer",
            Rs485Error::LineBusy => "line never quiet",
            Rs485Error::SendTimeout => "transmitter stuck",
            Rs485Error::Timeout => "no reply",
            Rs485Error::Framing => "framing error",
            Rs485Error::Parity => "parity error",
            Rs485Error::Noise => "noise error",
            Rs485Error::Overrun => "overrun",
        }
    }
}

/// USART CR1 bits (RM0390, USART).
const CR1_M: u32 = 1 << 12; // 9-bit word: 8 data bits + parity
const CR1_PCE: u32 = 1 << 10; // parity on; PS (bit 9) = 0 is even
const CR1_TE: u32 = 1 << 3;
const CR1_RE: u32 = 1 << 2;
/// USART CR2 STOP field: 0b00 one stop bit, 0b10 two.
const CR2_STOP_TWO: u32 = 0b10 << 12;

/// Modbus fixes the inter-frame gap at 1,750 µs above 19,200 baud.
const FAST_GAP_US: u32 = 1_750;

/// Line settings of the port.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct LineConfig {
    baud: u32,
    parity: Parity,
    stop: StopBits,
}

impl LineConfig {
    pub const MIN_BAUD: u32 = 1_200;
    pub const MAX_BAUD: u32 = 115_200;

    pub const fn new(baud: u32, parity: Parity, stop: StopBits) -> Result<Self, Rs485Error> {
        if baud < Self::MIN_BAUD || baud > Self::MAX_BAUD {
            return Err(Rs485Error::BadBaud);
        }
        Ok(Self { baud, parity, stop })
    }

    pub const fn baud(&self) -> u32 {
        self.baud
    }

    /// Bits on the wire per character: start, 8 data, parity, stop.
    pub const fn char_bits(&self) -> u32 {
        let parity = match self.parity {
            Parity::None => 0,
            Parity::Even => 1,
        };
        let stop = match self.stop {
            StopBits::One => 1,
            StopBits::Two => 2,
        };
        1 + 8 + parity + stop
    }

    /// One character time in µs, rounded up.
    pub const fn char_us(&self) -> u32 {
        (self.char_bits() * 1_000_000).div_ceil(self.baud)
    }

    /// The Modbus inter-frame gap (3.5 characters, or 1,750 µs above
    /// 19,200 baud) in µs, rounded up. A reply ends after this much quiet.
    pub const fn gap_us(&self) -> u32 {
        if self.baud > 19_200 {
            FAST_GAP_US
        } else {
            (35 * self.char_bits() * 1_000_000).div_ceil(10 * self.baud)
        }
    }

    /// BRR value for 16x oversampling from the USART's bus clock: the
    /// rounded divider pclk / baud, which is mantissa (12 bits) and fraction
    /// (4 bits) together. Refused if the divider does not fit or the rate
    /// would be off by more than 1%.
    pub const fn brr(&self, pclk_hz: u32) -> Result<u32, Rs485Error> {
        let div = (pclk_hz + self.baud / 2) / self.baud;
        if div < 16 || div > 0xFFFF {
            return Err(Rs485Error::BaudUnreachable);
        }
        let actual = pclk_hz / div;
        let error = actual.abs_diff(self.baud);
        if error * 100 > self.baud {
            return Err(Rs485Error::BaudUnreachable);
        }
        Ok(div)
    }

    /// CR1 bits for word length and parity, with TE and RE (not UE).
    pub const fn cr1(&self) -> u32 {
        let parity = match self.parity {
            Parity::None => 0,
            Parity::Even => CR1_M | CR1_PCE,
        };
        parity | CR1_TE | CR1_RE
    }

    /// CR2 STOP field.
    pub const fn cr2(&self) -> u32 {
        match self.stop {
            StopBits::One => 0,
            StopBits::Two => CR2_STOP_TWO,
        }
    }
}

/// Collects one reply into the caller's buffer and decides when it ends.
/// Times are µs from a free-running counter that may wrap.
pub struct Reply {
    len: usize,
    start_us: u32,
    last_us: u32,
    timeout_us: u32,
    gap_us: u32,
    error: Option<Rs485Error>,
}

impl Reply {
    pub const fn new(start_us: u32, timeout_us: u32, gap_us: u32) -> Self {
        Self {
            len: 0,
            start_us,
            last_us: start_us,
            timeout_us,
            gap_us,
            error: None,
        }
    }

    /// A received byte. Bytes past the end of the buffer are dropped; the
    /// reply is complete by then anyway.
    pub fn on_byte(&mut self, buf: &mut [u8], byte: u8, now_us: u32) {
        if self.error.is_none() && self.len < buf.len() {
            buf[self.len] = byte;
            self.len += 1;
        }
        self.last_us = now_us;
    }

    /// A line error: the transfer ends with it, and the bytes are not data.
    pub fn on_error(&mut self, error: Rs485Error, now_us: u32) {
        if self.error.is_none() {
            self.error = Some(error);
        }
        self.last_us = now_us;
    }

    /// The result once the reply is over: a line error, the buffer full,
    /// the gap after the last byte, or no first byte before the timeout.
    pub fn poll(&self, buf_len: usize, now_us: u32) -> Option<Result<usize, Rs485Error>> {
        if let Some(error) = self.error {
            return Some(Err(error));
        }
        if self.len > 0 && self.len == buf_len {
            return Some(Ok(self.len));
        }
        if self.len > 0 && now_us.wrapping_sub(self.last_us) >= self.gap_us {
            return Some(Ok(self.len));
        }
        if self.len == 0 && now_us.wrapping_sub(self.start_us) >= self.timeout_us {
            return Some(Err(Rs485Error::Timeout));
        }
        None
    }
}

/// What [`transfer`] needs from a port. The F446 port is USART1 with the
/// driver enable (DE and /RE tied) on PA8.
pub trait Port {
    /// A free-running µs counter (may wrap).
    fn now_us(&mut self) -> u32;
    /// When the line last carried a byte or an error, in [`Port::now_us`] time.
    fn last_activity_us(&mut self) -> u32;
    /// Driver enable: true sends (and, with /RE tied, turns the receiver off).
    fn set_driver(&mut self, on: bool);
    /// The transmit data register is empty (TXE).
    fn can_write(&mut self) -> bool;
    fn write(&mut self, byte: u8);
    /// The last byte has left the shift register (TC).
    fn sent(&mut self) -> bool;
    /// The next received byte or line error, if any.
    fn read(&mut self) -> Option<Result<u8, Rs485Error>>;
}

/// One request/reply exchange. `buf` holds the request in its first
/// `request_len` bytes; the reply overwrites `buf` from the start. Returns
/// the reply length. DE is low again whatever the result.
pub fn transfer<P: Port>(
    port: &mut P,
    line: &LineConfig,
    buf: &mut [u8],
    request_len: usize,
    timeout_us: u32,
) -> Result<usize, Rs485Error> {
    if request_len == 0 || request_len > buf.len() {
        return Err(Rs485Error::BadLength);
    }
    let gap = line.gap_us();
    // 1. A quiet line for the gap, so the request is a frame of its own.
    let start = port.now_us();
    loop {
        while let Some(_stale) = port.read() {}
        let now = port.now_us();
        if now.wrapping_sub(port.last_activity_us()) >= gap {
            break;
        }
        if now.wrapping_sub(start) >= timeout_us {
            return Err(Rs485Error::LineBusy);
        }
    }
    // 2-3. DE up, send, wait for transmission complete, DE down at once.
    port.set_driver(true);
    let sent = send(port, line, &buf[..request_len]);
    port.set_driver(false);
    sent?;
    // 4. The reply, until the gap after it, a full buffer, an error or the
    // timeout.
    let mut reply = Reply::new(port.now_us(), timeout_us, gap);
    loop {
        while let Some(event) = port.read() {
            let now = port.now_us();
            match event {
                Ok(byte) => reply.on_byte(buf, byte, now),
                Err(error) => reply.on_error(error, now),
            }
        }
        if let Some(result) = reply.poll(buf.len(), port.now_us()) {
            return result;
        }
    }
}

/// Sends `bytes` and waits for TC. Each wait is bounded by four character
/// times, so a stuck transmitter cannot hold DE high.
fn send<P: Port>(port: &mut P, line: &LineConfig, bytes: &[u8]) -> Result<(), Rs485Error> {
    let limit = 4 * line.char_us();
    for &byte in bytes {
        wait(port, limit, |p| p.can_write())?;
        port.write(byte);
    }
    wait(port, limit, |p| p.sent())
}

fn wait<P: Port>(
    port: &mut P,
    limit_us: u32,
    mut ready: impl FnMut(&mut P) -> bool,
) -> Result<(), Rs485Error> {
    let start = port.now_us();
    while !ready(port) {
        if port.now_us().wrapping_sub(start) >= limit_us {
            return Err(Rs485Error::SendTimeout);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::vec::Vec;

    fn line_9600_8e1() -> LineConfig {
        LineConfig::new(9_600, Parity::Even, StopBits::One).unwrap()
    }

    #[test]
    fn timing_follows_modbus() {
        let line = line_9600_8e1();
        assert_eq!(line.char_bits(), 11);
        assert_eq!(line.char_us(), 1_146); // 11 / 9600 s
        assert_eq!(line.gap_us(), 4_011); // "about 4.0 ms at 9,600 baud"
        let n2 = LineConfig::new(9_600, Parity::None, StopBits::Two).unwrap();
        assert_eq!(n2.char_bits(), 11);
        let n1 = LineConfig::new(19_200, Parity::None, StopBits::One).unwrap();
        assert_eq!(n1.char_bits(), 10);
        assert_eq!(n1.gap_us(), 1_823);
        for baud in [38_400, 57_600, 115_200] {
            assert_eq!(
                LineConfig::new(baud, Parity::Even, StopBits::One)
                    .unwrap()
                    .gap_us(),
                1_750
            );
        }
    }

    #[test]
    fn baud_range_and_divider() {
        assert_eq!(
            LineConfig::new(1_199, Parity::Even, StopBits::One),
            Err(Rs485Error::BadBaud)
        );
        assert_eq!(
            LineConfig::new(115_201, Parity::Even, StopBits::One),
            Err(Rs485Error::BadBaud)
        );
        let at = |baud| LineConfig::new(baud, Parity::Even, StopBits::One).unwrap();
        // USART1 sits on APB2: 84 MHz on the F446 build.
        assert_eq!(at(9_600).brr(84_000_000), Ok(8_750));
        assert_eq!(at(115_200).brr(84_000_000), Ok(729));
        assert_eq!(at(19_200).brr(84_000_000), Ok(4_375));
        // 1,200 baud needs a divider of 70,000: more than 16 bits at 84 MHz.
        // It works with APB2 at 42 MHz.
        assert_eq!(at(1_200).brr(84_000_000), Err(Rs485Error::BaudUnreachable));
        assert_eq!(at(1_200).brr(42_000_000), Ok(35_000));
        // Every rate from 1,282 baud up is reachable at 84 MHz within 1%.
        for baud in [1_300, 2_400, 4_800, 38_400, 57_600] {
            assert!(at(baud).brr(84_000_000).is_ok(), "{baud}");
        }
    }

    #[test]
    fn register_bits() {
        let e1 = line_9600_8e1();
        assert_eq!(e1.cr1(), CR1_M | CR1_PCE | CR1_TE | CR1_RE);
        assert_eq!(e1.cr2(), 0);
        let n2 = LineConfig::new(9_600, Parity::None, StopBits::Two).unwrap();
        assert_eq!(n2.cr1(), CR1_TE | CR1_RE);
        assert_eq!(n2.cr2(), 0b10 << 12);
    }

    /// A simulated half-duplex port. Each `now_us` call moves time on by
    /// `step` µs. A byte takes `char_us` on the wire; the receiver is off
    /// while DE is high (/RE tied to DE), so nothing heard then is kept.
    struct Sim {
        now: u32,
        step: u32,
        char_us: u32,
        last_activity: u32,
        de: bool,
        /// When the byte in the shift register is done (TC after that).
        busy_until: u32,
        /// (time, DE level) at each change.
        de_log: Vec<(u32, bool)>,
        /// (time written, byte).
        written: Vec<(u32, u8)>,
        /// Bytes the other side sends: (time, byte or error).
        incoming: Vec<(u32, Result<u8, Rs485Error>)>,
        /// Time the last byte left the wire.
        tx_done: u32,
        /// Called with every byte: a slave that answers after a delay.
        answer: Option<(u32, Vec<u8>)>,
    }

    impl Sim {
        fn new(line: &LineConfig) -> Self {
            Self {
                now: 100_000,
                step: 10,
                char_us: line.char_us(),
                last_activity: 0,
                de: false,
                busy_until: 0,
                de_log: Vec::new(),
                written: Vec::new(),
                incoming: Vec::new(),
                tx_done: 0,
                answer: None,
            }
        }

        /// The slave starts answering `delay` µs after the request is on
        /// the wire, one byte per character time.
        fn answers(mut self, delay: u32, reply: &[u8]) -> Self {
            self.answer = Some((delay, reply.to_vec()));
            self
        }
    }

    impl Port for Sim {
        fn now_us(&mut self) -> u32 {
            self.now = self.now.wrapping_add(self.step);
            self.now
        }
        fn last_activity_us(&mut self) -> u32 {
            self.last_activity
        }
        fn set_driver(&mut self, on: bool) {
            if self.de != on {
                self.de = on;
                self.de_log.push((self.now, on));
            }
        }
        fn can_write(&mut self) -> bool {
            // TXE: the data register empties as the shift register takes it.
            self.now
                .wrapping_sub(self.busy_until.wrapping_sub(self.char_us))
                < u32::MAX / 2
        }
        fn write(&mut self, byte: u8) {
            assert!(self.de, "a byte written with DE low");
            let start = if self.now.wrapping_sub(self.busy_until) < u32::MAX / 2 {
                self.now
            } else {
                self.busy_until
            };
            self.busy_until = start + self.char_us;
            self.tx_done = self.busy_until;
            self.written.push((self.now, byte));
            if let Some((delay, reply)) = &self.answer {
                // Re-plan the answer after each byte: it follows the last one.
                let first = self.tx_done + delay;
                self.incoming = reply
                    .iter()
                    .enumerate()
                    .map(|(i, &b)| (first + (i as u32 + 1) * self.char_us, Ok(b)))
                    .collect();
            }
        }
        fn sent(&mut self) -> bool {
            self.now.wrapping_sub(self.busy_until) < u32::MAX / 2
        }
        fn read(&mut self) -> Option<Result<u8, Rs485Error>> {
            let now = self.now;
            let index = self.incoming.iter().position(|(at, _)| *at <= now)?;
            let (at, event) = self.incoming.remove(index);
            self.last_activity = at;
            if self.de {
                return None; // receiver off while we drive the line
            }
            Some(event)
        }
    }

    const REQUEST: [u8; 8] = [0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xC4, 0x0B];
    /// Reply bytes (the kernel does not check Modbus CRCs; the capsule does).
    const REPLY: [u8; 9] = [0x01, 0x03, 0x04, 0x43, 0x66, 0x00, 0x00, 0x8E, 0x6C];

    fn request_buf() -> [u8; 32] {
        let mut buf = [0u8; 32];
        buf[..REQUEST.len()].copy_from_slice(&REQUEST);
        buf
    }

    #[test]
    fn a_request_goes_out_with_de_and_the_reply_comes_back() {
        let line = line_9600_8e1();
        let mut port = Sim::new(&line).answers(2_000, &REPLY);
        let mut buf = request_buf();
        let n = transfer(&mut port, &line, &mut buf, REQUEST.len(), 500_000).unwrap();
        assert_eq!(&buf[..n], &REPLY);
        let bytes: Vec<u8> = port.written.iter().map(|(_, b)| *b).collect();
        assert_eq!(bytes, REQUEST);
        // DE up before the first byte, down only after the last one left
        // the wire (TC), and within one poll of it.
        let (up_at, up) = port.de_log[0];
        let (down_at, down) = port.de_log[1];
        assert!(up && !down && port.de_log.len() == 2);
        assert!(up_at <= port.written[0].0);
        assert!(down_at >= port.tx_done, "DE dropped before TC");
        assert!(down_at - port.tx_done <= 2 * port.step, "DE held too long");
        // The request took 8 character times back to back.
        assert!(port.tx_done - port.written[0].0 <= 8 * port.char_us + port.step);
    }

    #[test]
    fn the_request_waits_for_a_quiet_line() {
        let line = line_9600_8e1();
        let mut port = Sim::new(&line).answers(2_000, &REPLY);
        port.last_activity = port.now; // a byte just went by
        let quiet_from = port.now + line.gap_us();
        let mut buf = request_buf();
        transfer(&mut port, &line, &mut buf, REQUEST.len(), 500_000).unwrap();
        assert!(port.written[0].0 >= quiet_from);
    }

    #[test]
    fn a_line_that_never_goes_quiet_is_reported() {
        let line = line_9600_8e1();
        struct Chatter(Sim);
        impl Port for Chatter {
            fn now_us(&mut self) -> u32 {
                self.0.now_us()
            }
            fn last_activity_us(&mut self) -> u32 {
                self.0.now // someone talks all the time
            }
            fn set_driver(&mut self, on: bool) {
                self.0.set_driver(on)
            }
            fn can_write(&mut self) -> bool {
                self.0.can_write()
            }
            fn write(&mut self, byte: u8) {
                self.0.write(byte)
            }
            fn sent(&mut self) -> bool {
                self.0.sent()
            }
            fn read(&mut self) -> Option<Result<u8, Rs485Error>> {
                None
            }
        }
        let mut port = Chatter(Sim::new(&line));
        let mut buf = request_buf();
        assert_eq!(
            transfer(&mut port, &line, &mut buf, REQUEST.len(), 50_000),
            Err(Rs485Error::LineBusy)
        );
        assert!(port.0.written.is_empty() && !port.0.de);
    }

    #[test]
    fn no_reply_times_out_with_de_low() {
        let line = line_9600_8e1();
        let mut port = Sim::new(&line);
        let mut buf = request_buf();
        assert_eq!(
            transfer(&mut port, &line, &mut buf, REQUEST.len(), 100_000),
            Err(Rs485Error::Timeout)
        );
        assert!(!port.de);
    }

    #[test]
    fn the_reply_ends_at_the_gap_and_a_later_frame_is_not_part_of_it() {
        let line = line_9600_8e1();
        let mut port = Sim::new(&line).answers(2_000, &REPLY[..5]);
        let mut buf = request_buf();
        // A second frame starts 20 character times after the first ends.
        let after = 20 * port.char_us;
        assert_eq!(
            transfer_with_extra(&mut port, &line, &mut buf, after),
            Ok(5)
        );
        assert_eq!(&buf[..5], &REPLY[..5]);
    }

    /// Like `transfer`, but a second burst of 4 bytes arrives `after` µs
    /// past the first reply.
    fn transfer_with_extra(
        port: &mut Sim,
        line: &LineConfig,
        buf: &mut [u8; 32],
        after: u32,
    ) -> Result<usize, Rs485Error> {
        struct Extra<'a>(&'a mut Sim, u32, bool);
        impl Port for Extra<'_> {
            fn now_us(&mut self) -> u32 {
                self.0.now_us()
            }
            fn last_activity_us(&mut self) -> u32 {
                self.0.last_activity_us()
            }
            fn set_driver(&mut self, on: bool) {
                self.0.set_driver(on)
            }
            fn can_write(&mut self) -> bool {
                self.0.can_write()
            }
            fn write(&mut self, byte: u8) {
                self.0.write(byte)
            }
            fn sent(&mut self) -> bool {
                self.0.sent()
            }
            fn read(&mut self) -> Option<Result<u8, Rs485Error>> {
                if !self.2 && !self.0.incoming.is_empty() {
                    let last = self.0.incoming.last().map(|(at, _)| *at).unwrap_or(0);
                    for i in 0..4u32 {
                        self.0
                            .incoming
                            .push((last + self.1 + i * self.0.char_us, Ok(0xEE)));
                    }
                    self.2 = true;
                }
                self.0.read()
            }
        }
        transfer(
            &mut Extra(port, after, false),
            line,
            buf,
            REQUEST.len(),
            500_000,
        )
    }

    #[test]
    fn a_line_error_ends_the_transfer_and_no_data_is_returned() {
        let line = line_9600_8e1();
        let mut port = Sim::new(&line).answers(2_000, &REPLY);
        let mut buf = request_buf();
        struct Bad<'a>(&'a mut Sim, usize);
        impl Port for Bad<'_> {
            fn now_us(&mut self) -> u32 {
                self.0.now_us()
            }
            fn last_activity_us(&mut self) -> u32 {
                self.0.last_activity_us()
            }
            fn set_driver(&mut self, on: bool) {
                self.0.set_driver(on)
            }
            fn can_write(&mut self) -> bool {
                self.0.can_write()
            }
            fn write(&mut self, byte: u8) {
                self.0.write(byte)
            }
            fn sent(&mut self) -> bool {
                self.0.sent()
            }
            fn read(&mut self) -> Option<Result<u8, Rs485Error>> {
                let event = self.0.read()?;
                self.1 += 1;
                Some(if self.1 == 3 {
                    Err(Rs485Error::Parity)
                } else {
                    event
                })
            }
        }
        assert_eq!(
            transfer(
                &mut Bad(&mut port, 0),
                &line,
                &mut buf,
                REQUEST.len(),
                500_000
            ),
            Err(Rs485Error::Parity)
        );
        assert!(!port.de);
    }

    #[test]
    fn a_full_buffer_ends_the_reply() {
        let line = line_9600_8e1();
        let mut port = Sim::new(&line).answers(2_000, &REPLY);
        let mut buf = [0u8; 8];
        buf.copy_from_slice(&REQUEST);
        assert_eq!(transfer(&mut port, &line, &mut buf, 8, 500_000), Ok(8));
        assert_eq!(buf, REPLY[..8]);
    }

    #[test]
    fn bad_lengths_are_refused_before_de_goes_up() {
        let line = line_9600_8e1();
        let mut port = Sim::new(&line);
        let mut buf = [0u8; 4];
        assert_eq!(
            transfer(&mut port, &line, &mut buf, 0, 1_000),
            Err(Rs485Error::BadLength)
        );
        assert_eq!(
            transfer(&mut port, &line, &mut buf, 5, 1_000),
            Err(Rs485Error::BadLength)
        );
        assert!(port.de_log.is_empty());
    }

    #[test]
    fn a_stuck_transmitter_cannot_hold_de_high() {
        let line = line_9600_8e1();
        struct Stuck(Sim);
        impl Port for Stuck {
            fn now_us(&mut self) -> u32 {
                self.0.now_us()
            }
            fn last_activity_us(&mut self) -> u32 {
                0
            }
            fn set_driver(&mut self, on: bool) {
                self.0.set_driver(on)
            }
            fn can_write(&mut self) -> bool {
                true
            }
            fn write(&mut self, byte: u8) {
                self.0.write(byte)
            }
            fn sent(&mut self) -> bool {
                false // TC never comes
            }
            fn read(&mut self) -> Option<Result<u8, Rs485Error>> {
                None
            }
        }
        let mut port = Stuck(Sim::new(&line));
        let mut buf = request_buf();
        assert_eq!(
            transfer(&mut port, &line, &mut buf, REQUEST.len(), 500_000),
            Err(Rs485Error::SendTimeout)
        );
        assert!(!port.0.de);
    }

    #[test]
    fn reply_timing_survives_counter_wrap() {
        let mut reply = Reply::new(u32::MAX - 100, 1_000, 400);
        let mut buf = [0u8; 4];
        assert_eq!(reply.poll(4, u32::MAX - 50), None);
        reply.on_byte(&mut buf, 7, u32::MAX - 10);
        assert_eq!(reply.poll(4, 200), None); // 211 µs after the byte
        assert_eq!(reply.poll(4, 390), Some(Ok(1))); // 401 µs: gap passed
        let silent = Reply::new(u32::MAX - 100, 1_000, 400);
        assert_eq!(silent.poll(4, 899), Some(Err(Rs485Error::Timeout)));
    }
}
