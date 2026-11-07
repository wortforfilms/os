//! bxCAN1 on the STM32F446 (NUCLEO-F446RE): kernel-internal, step 2 of the
//! drivers plan. No syscall reaches it yet; the device syscalls (step 4) and
//! the receive interrupt come later.
//!
//! What runs today is a boot self-test in loopback + silent mode: the
//! controller hears its own frames and the TX pin stays recessive, so it
//! needs no transceiver and no bus. It checks the bit timing, the
//! transmit mailboxes, two hardware filters (one standard, one extended id)
//! and receive FIFO 0. Pins PA11/PA12 are not touched.
//!
//! The parts that do not touch hardware (bit timing, the frame layout, the
//! mailbox and filter encodings, the receive queue) are plain functions with
//! host tests below.

// Parts of this module are used by the host tests now and by the device
// syscalls (step 4) later; the F446 kernel uses only the self-test today.
#![cfg_attr(not(test), allow(dead_code))]

/// Time quanta per bit: sync 1 + segment 1 (11) + segment 2 (2).
pub const QUANTA_PER_BIT: u32 = 14;
const TS1: u32 = 11;
const TS2: u32 = 2;
const SJW: u32 = 1;

/// Bit 31 of a frame id: a 29-bit extended id.
pub const ID_EXTENDED: u32 = 1 << 31;
/// Bit 30 of a frame id: a remote frame (no data).
pub const ID_REMOTE: u32 = 1 << 30;
const STD_ID_MAX: u32 = 0x7FF;
const EXT_ID_MAX: u32 = 0x1FFF_FFFF;

/// Why the driver could not do what was asked.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CanError {
    /// The bit rate is not an exact divisor of APB1 / 14, or out of range.
    BitRate,
    /// An id, length or reserved bit is out of range.
    BadFrame,
    /// The controller did not enter initialization mode.
    EnterInit,
    /// The controller did not leave initialization mode.
    LeaveInit,
    /// No transmit mailbox finished in time.
    SendTimeout,
    /// A frame was sent but not acknowledged (in loopback: never expected).
    SendFailed,
    /// A frame that should have come back did not.
    ReceiveTimeout,
    /// A frame came back different from the one sent.
    Mismatch,
    /// A frame the filters should have blocked came through.
    FilterLeak,
}

impl CanError {
    pub const fn as_str(self) -> &'static str {
        match self {
            CanError::BitRate => "bit rate not reachable",
            CanError::BadFrame => "bad frame",
            CanError::EnterInit => "did not enter init mode",
            CanError::LeaveInit => "did not leave init mode",
            CanError::SendTimeout => "transmit mailbox timeout",
            CanError::SendFailed => "transmit not acknowledged",
            CanError::ReceiveTimeout => "frame did not come back",
            CanError::Mismatch => "frame came back changed",
            CanError::FilterLeak => "filtered frame came through",
        }
    }
}

/// BTR register value (without the mode bits) for `bitrate` from `apb1_hz`.
/// Only exact divisors are accepted: CAN tolerates about 0.5% error, and an
/// exact value leaves that margin to the oscillators.
pub fn bit_timing(apb1_hz: u32, bitrate: u32) -> Result<u32, CanError> {
    let per_bit = bitrate
        .checked_mul(QUANTA_PER_BIT)
        .ok_or(CanError::BitRate)?;
    if per_bit == 0 || !apb1_hz.is_multiple_of(per_bit) {
        return Err(CanError::BitRate);
    }
    let prescaler = apb1_hz / per_bit;
    if !(1..=1024).contains(&prescaler) {
        return Err(CanError::BitRate);
    }
    Ok(((SJW - 1) << 24) | ((TS2 - 1) << 20) | ((TS1 - 1) << 16) | (prescaler - 1))
}

/// One CAN 2.0 frame in the 16-byte layout of the design: a 32-bit id
/// (bit 31 extended, bit 30 remote), a length (0-8), 3 zero bytes, 8 data
/// bytes. Send, receive and the host tests all use it.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Frame {
    id: u32,
    len: u8,
    data: [u8; 8],
}

impl Frame {
    pub const BYTES: usize = 16;

    /// A data frame with an 11-bit id.
    pub fn standard(id: u32, data: &[u8]) -> Result<Self, CanError> {
        Self::build(id, STD_ID_MAX, 0, data)
    }

    /// A data frame with a 29-bit id.
    pub fn extended(id: u32, data: &[u8]) -> Result<Self, CanError> {
        Self::build(id, EXT_ID_MAX, ID_EXTENDED, data)
    }

    fn build(id: u32, max: u32, flags: u32, data: &[u8]) -> Result<Self, CanError> {
        if id > max || data.len() > 8 {
            return Err(CanError::BadFrame);
        }
        let mut bytes = [0; 8];
        bytes[..data.len()].copy_from_slice(data);
        Ok(Self {
            id: id | flags,
            len: data.len() as u8,
            data: bytes,
        })
    }

    pub const fn is_extended(&self) -> bool {
        self.id & ID_EXTENDED != 0
    }

    pub const fn is_remote(&self) -> bool {
        self.id & ID_REMOTE != 0
    }

    /// The 11- or 29-bit id without the flag bits.
    pub const fn raw_id(&self) -> u32 {
        self.id & EXT_ID_MAX
    }

    pub fn data(&self) -> &[u8] {
        &self.data[..usize::from(self.len)]
    }

    pub fn to_bytes(self) -> [u8; Self::BYTES] {
        let mut out = [0; Self::BYTES];
        out[..4].copy_from_slice(&self.id.to_le_bytes());
        out[4] = self.len;
        out[8..].copy_from_slice(&self.data);
        out
    }

    /// Reads the 16-byte layout; refuses reserved bits, padding, an id too
    /// large for its kind, and a length above 8.
    pub fn from_bytes(bytes: &[u8; Self::BYTES]) -> Result<Self, CanError> {
        let id = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
        let max = if id & ID_EXTENDED != 0 {
            EXT_ID_MAX
        } else {
            STD_ID_MAX
        };
        let len = bytes[4];
        if id & !(ID_EXTENDED | ID_REMOTE) > max || len > 8 || bytes[5..8] != [0; 3] {
            return Err(CanError::BadFrame);
        }
        let mut data = [0; 8];
        data.copy_from_slice(&bytes[8..]);
        Ok(Self { id, len, data })
    }

    /// The identifier register word (TIxR / RIxR / filter layout), without
    /// the transmit-request bit.
    pub const fn id_register(&self) -> u32 {
        let mut word = if self.is_extended() {
            (self.raw_id() << 3) | IR_IDE
        } else {
            self.raw_id() << 21
        };
        if self.is_remote() {
            word |= IR_RTR;
        }
        word
    }

    /// The two data register words (TDLxR, TDHxR).
    pub fn data_registers(&self) -> (u32, u32) {
        let d = &self.data;
        (
            u32::from_le_bytes([d[0], d[1], d[2], d[3]]),
            u32::from_le_bytes([d[4], d[5], d[6], d[7]]),
        )
    }

    /// A frame from receive mailbox registers RIxR, RDTxR, RDLxR, RDHxR.
    /// A DLC above 8 means 8 data bytes (CAN 2.0).
    pub fn from_registers(rir: u32, rdtr: u32, rdlr: u32, rdhr: u32) -> Self {
        let mut id = if rir & IR_IDE != 0 {
            ((rir >> 3) & EXT_ID_MAX) | ID_EXTENDED
        } else {
            (rir >> 21) & STD_ID_MAX
        };
        if rir & IR_RTR != 0 {
            id |= ID_REMOTE;
        }
        let len = ((rdtr & 0xF) as u8).min(8);
        let mut data = [0; 8];
        data[..4].copy_from_slice(&rdlr.to_le_bytes());
        data[4..].copy_from_slice(&rdhr.to_le_bytes());
        // Bytes past the length are not part of the frame.
        data[usize::from(len)..].fill(0);
        Self { id, len, data }
    }
}

/// Identifier register bits shared by TIxR, RIxR and the filter banks.
const IR_IDE: u32 = 1 << 2;
const IR_RTR: u32 = 1 << 1;

/// Filter bank words (FxR1 id, FxR2 mask) in 32-bit mask mode that pass
/// data frames with exactly this frame's id and id kind.
pub const fn exact_filter(frame: &Frame) -> (u32, u32) {
    let id_mask = if frame.is_extended() {
        EXT_ID_MAX << 3
    } else {
        STD_ID_MAX << 21
    };
    (frame.id_register() & !IR_RTR, id_mask | IR_IDE | IR_RTR)
}

/// Receive queue capacity in frames (16 x 16 bytes = 256 bytes of RAM).
pub const QUEUE_FRAMES: usize = 16;

/// Kernel receive queue. When full, the newest frame is dropped and
/// counted; queued frames are never overwritten.
pub struct RxQueue {
    frames: [Frame; QUEUE_FRAMES],
    head: usize,
    len: usize,
    dropped: u32,
}

impl RxQueue {
    pub const fn new() -> Self {
        Self {
            frames: [EMPTY_FRAME; QUEUE_FRAMES],
            head: 0,
            len: 0,
            dropped: 0,
        }
    }

    /// Queues a frame; returns false (and counts it) when the queue is full.
    pub fn push(&mut self, frame: Frame) -> bool {
        if self.len == QUEUE_FRAMES {
            self.dropped = self.dropped.saturating_add(1);
            return false;
        }
        self.frames[(self.head + self.len) % QUEUE_FRAMES] = frame;
        self.len += 1;
        true
    }

    pub fn pop(&mut self) -> Option<Frame> {
        if self.len == 0 {
            return None;
        }
        let frame = self.frames[self.head];
        self.head = (self.head + 1) % QUEUE_FRAMES;
        self.len -= 1;
        Some(frame)
    }

    pub const fn len(&self) -> usize {
        self.len
    }

    pub const fn is_empty(&self) -> bool {
        self.len == 0
    }

    pub const fn dropped(&self) -> u32 {
        self.dropped
    }
}

impl Default for RxQueue {
    fn default() -> Self {
        Self::new()
    }
}

/// The frames the self-test sends, in order, and whether each must come
/// back through the two filters (bank 0: standard 0x123, bank 1: extended
/// 0x1ABC_DE0F). The middle frame differs from the first by one id bit, so
/// it proves the filter compares the whole id.
pub fn self_test_frames() -> [(Frame, bool); 3] {
    // The ids and lengths are in range, so these cannot fail.
    let first = Frame::standard(0x123, &[1, 2, 3, 4, 5, 6, 7, 8]).unwrap_or(EMPTY_FRAME);
    let blocked = Frame::standard(0x124, &[0xEE]).unwrap_or(EMPTY_FRAME);
    let ext = Frame::extended(0x1ABC_DE0F, &[0xA5, 0x5A, 0xFF]).unwrap_or(EMPTY_FRAME);
    [(first, true), (blocked, false), (ext, true)]
}

const EMPTY_FRAME: Frame = Frame {
    id: 0,
    len: 0,
    data: [0; 8],
};

/// What the boot self-test saw.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SelfTest {
    pub bitrate: u32,
    pub sent: u32,
    pub received: u32,
    pub filtered: u32,
    /// Transmit and receive error counters and last error code (ESR).
    pub tec: u8,
    pub rec: u8,
    pub lec: u8,
}

/// Bit rate of the boot self-test.
pub const SELF_TEST_BITRATE: u32 = 500_000;

#[cfg(all(target_arch = "arm", feature = "board-f446"))]
mod hw {
    //! bxCAN1 registers (RM0390, section 30.9), used directly: the HAL's CAN
    //! support would pull in the `bxcan` crate for a few registers.
    use super::*;

    const CAN1: usize = 0x4000_6400;
    pub const MCR: usize = CAN1;
    pub const MSR: usize = CAN1 + 0x04;
    pub const TSR: usize = CAN1 + 0x08;
    pub const RF0R: usize = CAN1 + 0x0C;
    pub const ESR: usize = CAN1 + 0x18;
    pub const BTR: usize = CAN1 + 0x1C;
    const TX0: usize = CAN1 + 0x180; // TI0R, TDT0R, TDL0R, TDH0R
    const RX0: usize = CAN1 + 0x1B0; // RI0R, RDT0R, RDL0R, RDH0R
    pub const FMR: usize = CAN1 + 0x200;
    pub const FM1R: usize = CAN1 + 0x204;
    pub const FS1R: usize = CAN1 + 0x20C;
    pub const FFA1R: usize = CAN1 + 0x214;
    pub const FA1R: usize = CAN1 + 0x21C;
    const FILTER0: usize = CAN1 + 0x240; // F0R1, F0R2, F1R1, ...

    const RCC_APB1RSTR: usize = 0x4002_3820;
    const RCC_APB1ENR: usize = 0x4002_3840;
    const RCC_CAN1: u32 = 1 << 25;

    pub const MCR_INRQ: u32 = 1 << 0;
    pub const MCR_SLEEP: u32 = 1 << 1;
    pub const MCR_TXFP: u32 = 1 << 2;
    pub const MCR_ABOM: u32 = 1 << 6;
    pub const MSR_INAK: u32 = 1 << 0;
    pub const MSR_SLAK: u32 = 1 << 1;
    const TSR_RQCP0: u32 = 1 << 0;
    const TSR_TXOK0: u32 = 1 << 1;
    const TSR_TME0: u32 = 1 << 26;
    const RF0R_FMP0: u32 = 0b11;
    const RF0R_RFOM0: u32 = 1 << 5;
    pub const BTR_LBKM: u32 = 1 << 30;
    pub const BTR_SILM: u32 = 1 << 31;
    pub const FMR_FINIT: u32 = 1 << 0;
    const TIR_TXRQ: u32 = 1 << 0;

    /// Spin bound for one wait: each spin is at least one APB1 register read,
    /// so this is over 1.2 ms at 168 MHz, against about 0.3 ms for one frame
    /// at 500 kbit/s. The test waits this long once, for the frame the
    /// filters must block; the 8 s watchdog is far away.
    const SPINS: u32 = 200_000;

    pub fn read(addr: usize) -> u32 {
        // SAFETY: callers pass only the fixed, aligned RCC and CAN1 register
        // addresses above; the kernel owns CAN1 alone (no task can reach it).
        unsafe { (addr as *const u32).read_volatile() }
    }

    pub fn write(addr: usize, value: u32) {
        // SAFETY: as in `read`.
        unsafe { (addr as *mut u32).write_volatile(value) }
    }

    pub fn modify(addr: usize, clear: u32, set: u32) {
        write(addr, (read(addr) & !clear) | set);
    }

    /// Waits until `(read(addr) & mask) == want`; false on timeout.
    pub fn wait(addr: usize, mask: u32, want: u32) -> bool {
        (0..SPINS).any(|_| read(addr) & mask == want)
    }

    /// Clock on, then a peripheral reset, so the test starts from reset values.
    pub fn power_up() {
        modify(RCC_APB1ENR, 0, RCC_CAN1);
        let _ = read(RCC_APB1ENR); // let the clock settle
        modify(RCC_APB1RSTR, 0, RCC_CAN1);
        modify(RCC_APB1RSTR, RCC_CAN1, 0);
    }

    pub fn set_filter(bank: usize, words: (u32, u32)) {
        write(FILTER0 + bank * 8, words.0);
        write(FILTER0 + bank * 8 + 4, words.1);
    }

    /// Sends through mailbox 0 and waits for it to finish.
    pub fn send(frame: &Frame) -> Result<(), CanError> {
        if !wait(TSR, TSR_TME0, TSR_TME0) {
            return Err(CanError::SendTimeout);
        }
        let (low, high) = frame.data_registers();
        write(TX0 + 0x04, frame.data().len() as u32);
        write(TX0 + 0x08, low);
        write(TX0 + 0x0C, high);
        write(TX0, frame.id_register() | TIR_TXRQ);
        if !wait(TSR, TSR_RQCP0, TSR_RQCP0) {
            return Err(CanError::SendTimeout);
        }
        let ok = read(TSR) & TSR_TXOK0 != 0;
        write(TSR, TSR_RQCP0); // write 1 to clear the request-complete flags
        if ok {
            Ok(())
        } else {
            Err(CanError::SendFailed)
        }
    }

    /// Takes the oldest frame from FIFO 0, if one is pending.
    pub fn receive() -> Option<Frame> {
        if read(RF0R) & RF0R_FMP0 == 0 {
            return None;
        }
        let frame = Frame::from_registers(
            read(RX0),
            read(RX0 + 0x04),
            read(RX0 + 0x08),
            read(RX0 + 0x0C),
        );
        write(RF0R, RF0R_RFOM0); // release the mailbox
        Some(frame)
    }

    /// Waits for a frame in FIFO 0; None if none arrives within the bound.
    pub fn receive_wait() -> Option<Frame> {
        if (0..SPINS).any(|_| read(RF0R) & RF0R_FMP0 != 0) {
            receive()
        } else {
            None
        }
    }
}

/// Boot self-test of bxCAN1 in loopback + silent mode. Leaves the
/// controller in initialization mode, off the bus, whatever the result.
#[cfg(all(target_arch = "arm", feature = "board-f446"))]
pub fn self_test(apb1_hz: u32) -> Result<SelfTest, CanError> {
    let timing = bit_timing(apb1_hz, SELF_TEST_BITRATE)?;
    hw::power_up();
    let result = run_self_test(timing);
    // Back to initialization mode: the TX pin stays recessive until a
    // later step configures the port for a real bus.
    hw::modify(hw::MCR, 0, hw::MCR_INRQ);
    let _ = hw::wait(hw::MSR, hw::MSR_INAK, hw::MSR_INAK);
    result
}

#[cfg(all(target_arch = "arm", feature = "board-f446"))]
fn run_self_test(timing: u32) -> Result<SelfTest, CanError> {
    use hw::*;

    // Leave sleep, request initialization.
    modify(MCR, MCR_SLEEP, MCR_INRQ);
    if !wait(MSR, MSR_INAK | MSR_SLAK, MSR_INAK) {
        return Err(CanError::EnterInit);
    }
    // Automatic bus-off recovery; send in request order.
    modify(MCR, 0, MCR_ABOM | MCR_TXFP);
    write(BTR, timing | BTR_LBKM | BTR_SILM);

    // Banks 0 and 1: 32-bit mask mode, FIFO 0. CAN1 owns all filter banks.
    let frames = self_test_frames();
    modify(FMR, 0, FMR_FINIT);
    modify(FA1R, 0b11, 0);
    modify(FM1R, 0b11, 0);
    modify(FS1R, 0, 0b11);
    modify(FFA1R, 0b11, 0);
    set_filter(0, exact_filter(&frames[0].0));
    set_filter(1, exact_filter(&frames[2].0));
    modify(FA1R, 0, 0b11);
    modify(FMR, FMR_FINIT, 0);

    modify(MCR, MCR_INRQ, 0);
    if !wait(MSR, MSR_INAK, 0) {
        return Err(CanError::LeaveInit);
    }

    let mut report = SelfTest {
        bitrate: SELF_TEST_BITRATE,
        sent: 0,
        received: 0,
        filtered: 0,
        tec: 0,
        rec: 0,
        lec: 0,
    };
    for (frame, passes) in frames {
        send(&frame)?;
        report.sent += 1;
        if passes {
            match receive_wait() {
                Some(got) if got == frame => report.received += 1,
                Some(_) => return Err(CanError::Mismatch),
                None => return Err(CanError::ReceiveTimeout),
            }
        } else if receive_wait().is_some() {
            return Err(CanError::FilterLeak);
        } else {
            report.filtered += 1;
        }
    }
    let esr = read(ESR);
    report.lec = ((esr >> 4) & 0b111) as u8;
    report.tec = (esr >> 16) as u8;
    report.rec = (esr >> 24) as u8;
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;

    const APB1: u32 = 42_000_000;

    #[test]
    fn bit_timing_matches_the_design_table() {
        // Prescalers 24, 12, 6, 3 (design doc, CAN driver).
        for (rate, prescaler) in [(125_000, 24), (250_000, 12), (500_000, 6), (1_000_000, 3)] {
            let btr = bit_timing(APB1, rate).unwrap();
            assert_eq!(btr & 0x3FF, prescaler - 1, "{rate}");
            assert_eq!((btr >> 16) & 0xF, 10, "segment 1 = 11");
            assert_eq!((btr >> 20) & 0x7, 1, "segment 2 = 2");
            assert_eq!((btr >> 24) & 0x3, 0, "jump width 1");
        }
        assert_eq!(bit_timing(APB1, 500_000), Ok(0x001A_0005));
    }

    #[test]
    fn bit_timing_refuses_inexact_and_out_of_range_rates() {
        assert_eq!(bit_timing(APB1, 333_333), Err(CanError::BitRate));
        assert_eq!(bit_timing(APB1, 0), Err(CanError::BitRate));
        assert_eq!(bit_timing(APB1, 6_000_000), Err(CanError::BitRate)); // prescaler 0.5
        assert_eq!(bit_timing(APB1, u32::MAX), Err(CanError::BitRate));
        assert_eq!(bit_timing(14 * 1025, 1), Err(CanError::BitRate)); // prescaler 1025
        assert!(bit_timing(14 * 1024, 1).is_ok());
    }

    #[test]
    fn frame_layout_is_sixteen_bytes_and_round_trips() {
        let frame = Frame::extended(0x1ABC_DE0F, &[0xA5, 0x5A, 0xFF]).unwrap();
        let bytes = frame.to_bytes();
        assert_eq!(bytes.len(), 16);
        assert_eq!(&bytes[..4], &(0x1ABC_DE0F | ID_EXTENDED).to_le_bytes());
        assert_eq!(bytes[4], 3);
        assert_eq!(&bytes[5..8], &[0, 0, 0]);
        assert_eq!(&bytes[8..11], &[0xA5, 0x5A, 0xFF]);
        assert_eq!(Frame::from_bytes(&bytes), Ok(frame));
        assert_eq!(frame.data(), &[0xA5, 0x5A, 0xFF]);
        assert!(frame.is_extended() && !frame.is_remote());
    }

    #[test]
    fn frame_refuses_bad_ids_lengths_and_padding() {
        assert_eq!(Frame::standard(0x800, &[]), Err(CanError::BadFrame));
        assert_eq!(Frame::extended(0x2000_0000, &[]), Err(CanError::BadFrame));
        assert_eq!(Frame::standard(1, &[0; 9]), Err(CanError::BadFrame));
        let good = Frame::standard(0x7FF, &[1]).unwrap().to_bytes();
        for (index, value) in [(4, 9), (5, 1), (7, 1), (1, 0x08), (3, 0x20)] {
            let mut bad = good;
            bad[index] = value;
            assert_eq!(
                Frame::from_bytes(&bad),
                Err(CanError::BadFrame),
                "byte {index}"
            );
        }
    }

    #[test]
    fn mailbox_registers_round_trip_like_the_loopback() {
        for (frame, _) in self_test_frames() {
            let (low, high) = frame.data_registers();
            let back =
                Frame::from_registers(frame.id_register(), frame.data().len() as u32, low, high);
            assert_eq!(back, frame);
        }
        let std = Frame::standard(0x123, &[]).unwrap();
        assert_eq!(std.id_register(), 0x123 << 21);
        let ext = Frame::extended(0x1ABC_DE0F, &[]).unwrap();
        assert_eq!(ext.id_register(), (0x1ABC_DE0F << 3) | IR_IDE);
    }

    #[test]
    fn received_dlc_above_eight_means_eight_and_stray_bytes_are_cleared() {
        let frame = Frame::from_registers(0x55 << 21, 15, 0x0403_0201, 0x0807_0605);
        assert_eq!(frame.data(), &[1, 2, 3, 4, 5, 6, 7, 8]);
        let short = Frame::from_registers(0x55 << 21, 2, 0x0403_0201, 0x0807_0605);
        assert_eq!(short.to_bytes()[8..], [1, 2, 0, 0, 0, 0, 0, 0]);
        let remote = Frame::from_registers((0x55 << 21) | IR_RTR, 0, 0, 0);
        assert!(remote.is_remote());
    }

    /// The bxCAN mask rule: a frame passes when (RIR ^ FR1) & FR2 == 0.
    fn passes(filter: (u32, u32), frame: &Frame) -> bool {
        (frame.id_register() ^ filter.0) & filter.1 == 0
    }

    #[test]
    fn exact_filters_pass_only_their_own_frame() {
        let frames = self_test_frames();
        let banks = [exact_filter(&frames[0].0), exact_filter(&frames[2].0)];
        for (frame, should_pass) in frames {
            assert_eq!(banks.iter().any(|f| passes(*f, &frame)), should_pass);
        }
        // Same number, other id kind: blocked by the IDE bit.
        let std_as_ext = Frame::extended(0x123 << 18, &[]).unwrap();
        assert!(!passes(banks[0], &std_as_ext));
        // A remote frame with the right id: blocked by the RTR bit.
        let remote = Frame::from_registers((0x123 << 21) | IR_RTR, 0, 0, 0);
        assert!(!passes(banks[0], &remote));
    }

    #[test]
    fn queue_keeps_order_drops_the_newest_when_full_and_counts() {
        let mut queue = RxQueue::new();
        assert!(queue.is_empty());
        for i in 0..QUEUE_FRAMES as u32 {
            assert!(queue.push(Frame::standard(i, &[]).unwrap()));
        }
        assert!(!queue.push(Frame::standard(0x7FF, &[]).unwrap()));
        assert!(!queue.push(Frame::standard(0x7FE, &[]).unwrap()));
        assert_eq!(queue.dropped(), 2);
        assert_eq!(queue.len(), QUEUE_FRAMES);
        assert_eq!(queue.pop().unwrap().raw_id(), 0);
        assert!(queue.push(Frame::standard(0x100, &[]).unwrap())); // wraps
        for i in 1..QUEUE_FRAMES as u32 {
            assert_eq!(queue.pop().unwrap().raw_id(), i);
        }
        assert_eq!(queue.pop().unwrap().raw_id(), 0x100);
        assert_eq!(queue.pop(), None);
        assert_eq!(core::mem::size_of::<[Frame; QUEUE_FRAMES]>(), 16 * 16);
    }
}
