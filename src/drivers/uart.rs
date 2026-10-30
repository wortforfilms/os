//! USART2 byte I/O, shared by both boards.
//!
//! - STM32F411 Nucleo: the ST-LINK virtual COM port, PA2 TX and PA3 RX at
//!   115200 8-N-1. The HAL configures clocks and pins once during bring-up.
//! - QEMU `netduinoplus2` (STM32F405): QEMU's USART2 model, the second
//!   `-serial` device. [`init_qemu`] enables it; logs stay on semihosting.
//!
//! The register block is the same on both chips, so the driver uses it
//! directly. These bounded methods do not allocate. Task reads block until the
//! interrupt-fed FIFO has data.

use super::DriverError;
#[cfg(target_arch = "arm")]
use core::cell::RefCell;
use core::fmt;
use core::sync::atomic::{AtomicBool, Ordering};
use core::sync::atomic::{AtomicU32, Ordering as AtomicOrdering};

/// USART2 registers; the same layout on STM32F405 and STM32F411.
#[cfg(target_arch = "arm")]
mod regs {
    const BASE: usize = 0x4000_4400;
    pub const SR: *mut u32 = BASE as *mut u32;
    pub const DR: *mut u32 = (BASE + 0x04) as *mut u32;
    #[cfg(feature = "board-qemu-f405")]
    pub const BRR: *mut u32 = (BASE + 0x08) as *mut u32;
    pub const CR1: *mut u32 = (BASE + 0x0C) as *mut u32;

    pub const SR_PE: u32 = 1 << 0;
    pub const SR_FE: u32 = 1 << 1;
    pub const SR_NF: u32 = 1 << 2;
    pub const SR_ORE: u32 = 1 << 3;
    pub const SR_RXNE: u32 = 1 << 5;
    pub const SR_TC: u32 = 1 << 6;
    pub const SR_TXE: u32 = 1 << 7;
    #[cfg(feature = "board-qemu-f405")]
    pub const CR1_RE: u32 = 1 << 2;
    #[cfg(feature = "board-qemu-f405")]
    pub const CR1_TE: u32 = 1 << 3;
    pub const CR1_RXNEIE: u32 = 1 << 5;
    #[cfg(feature = "board-qemu-f405")]
    pub const CR1_UE: u32 = 1 << 13;

    pub fn read(reg: *mut u32) -> u32 {
        // SAFETY: a fixed, aligned USART2 register address on both chips.
        unsafe { reg.read_volatile() }
    }

    pub fn write(reg: *mut u32, value: u32) {
        // SAFETY: as above; callers own USART2 (boot code or the SVC/ISR path).
        unsafe { reg.write_volatile(value) }
    }
}

/// USART2's NVIC line: position 38 on STM32F405 and STM32F411.
#[cfg(target_arch = "arm")]
#[derive(Clone, Copy)]
struct Usart2Irq;

// SAFETY: 38 is a valid device interrupt number on both chips.
#[cfg(target_arch = "arm")]
unsafe impl cortex_m::interrupt::InterruptNumber for Usart2Irq {
    fn number(self) -> u16 {
        USART2_IRQ
    }
}

/// USART2's interrupt number, for the QEMU build's default handler dispatch.
pub const USART2_IRQ: u16 = 38;

#[cfg(any(test, target_arch = "arm"))]
const RX_CAPACITY: usize = 256;

/// Fixed-size FIFO shared by the USART2 interrupt and task-side SVC reads.
#[cfg(any(test, target_arch = "arm"))]
#[derive(Clone)]
struct RxRing {
    bytes: [u8; RX_CAPACITY],
    head: usize,
    tail: usize,
    len: usize,
}

#[cfg(any(test, target_arch = "arm"))]
impl RxRing {
    const fn new() -> Self {
        Self {
            bytes: [0; RX_CAPACITY],
            head: 0,
            tail: 0,
            len: 0,
        }
    }

    fn push(&mut self, byte: u8) -> Result<(), u8> {
        if self.len == RX_CAPACITY {
            return Err(byte);
        }
        self.bytes[self.head] = byte;
        self.head = (self.head + 1) % RX_CAPACITY;
        self.len += 1;
        Ok(())
    }

    fn pop(&mut self) -> Option<u8> {
        if self.len == 0 {
            return None;
        }
        let byte = self.bytes[self.tail];
        self.tail = (self.tail + 1) % RX_CAPACITY;
        self.len -= 1;
        Some(byte)
    }
}

/// Outcome of a task-side read attempt after checking the FIFO atomically.
pub enum ReadResult {
    Bytes(usize),
    Blocked,
}

static READY: AtomicBool = AtomicBool::new(false);
static RX_DROPPED: AtomicU32 = AtomicU32::new(0);

/// Probe-readable last USART2 TX result: bit 31 marks a TXE timeout, bit 30
/// marks complete transmission, low 16 bits retain the last USART status, and
/// bits 16..23 retain the byte that was in flight on timeout.
#[no_mangle]
pub static MAATAA_UART_TX_DIAG: AtomicU32 = AtomicU32::new(0);

#[cfg(target_arch = "arm")]
static RX_BUFFER: cortex_m::interrupt::Mutex<RefCell<RxRing>> =
    cortex_m::interrupt::Mutex::new(RefCell::new(RxRing::new()));

/// QEMU only: enables USART2 (no clocks or pins to set up in the model).
/// BRR assumes APB1 at 42 MHz; QEMU ignores it.
#[cfg(all(target_arch = "arm", feature = "board-qemu-f405"))]
pub fn init_qemu() {
    regs::write(regs::BRR, 42_000_000 / 115_200);
    regs::write(regs::CR1, regs::CR1_UE | regs::CR1_TE | regs::CR1_RE);
}

/// Called only after board bring-up has configured USART2.
#[cfg(target_arch = "arm")]
pub fn mark_initialized() {
    READY.store(true, Ordering::Release);
}

#[cfg(not(target_arch = "arm"))]
pub fn mark_initialized() {}

/// Enables USART2 RXNE interrupts after the ring and ISR are ready.
#[cfg(target_arch = "arm")]
pub fn enable_receive_interrupt() {
    cortex_m::interrupt::free(|cs| {
        *RX_BUFFER.borrow(cs).borrow_mut() = RxRing::new();
    });
    RX_DROPPED.store(0, AtomicOrdering::Relaxed);
    regs::write(regs::CR1, regs::read(regs::CR1) | regs::CR1_RXNEIE);
    // SAFETY: the ISR and RX_BUFFER are ready; this is the only code that
    // unmasks the USART2 line.
    unsafe { cortex_m::peripheral::NVIC::unmask(Usart2Irq) };
}

#[cfg(not(target_arch = "arm"))]
pub fn enable_receive_interrupt() {}

/// Drains USART2's receive register in interrupt context into the bounded FIFO.
#[cfg(target_arch = "arm")]
pub fn on_receive_interrupt() {
    // The board configures USART2 once; this ISR is its only RX register
    // reader, and SVC code consumes bytes only from RX_BUFFER.
    let status = regs::read(regs::SR);
    let has_byte = status & regs::SR_RXNE != 0;
    let has_error = status & (regs::SR_ORE | regs::SR_FE | regs::SR_NF | regs::SR_PE) != 0;

    // On STM32F4, reading SR followed by DR clears RXNE and the receive error
    // flags. Read DR even for an error-only interrupt to prevent an IRQ storm.
    if has_byte || has_error {
        let byte = regs::read(regs::DR) as u8;
        if has_byte {
            let queued = cortex_m::interrupt::free(|cs| {
                let queued = RX_BUFFER.borrow(cs).borrow_mut().push(byte).is_ok();
                if !queued {
                    RX_DROPPED.fetch_add(1, AtomicOrdering::Relaxed);
                }
                queued
            });
            if queued {
                crate::sched::wake_waiting_uart_reader();
            }
        }
    }
}

/// Number of bytes dropped because the bounded receive FIFO was full.
pub fn dropped_receive_bytes() -> u32 {
    RX_DROPPED.load(AtomicOrdering::Relaxed)
}

/// Writes every byte to USART2. This waits for TXE for each byte, so it is
/// suitable for short kernel log/syscall messages, not bulk transfers.
pub fn write(data: &[u8]) -> Result<usize, DriverError> {
    if !READY.load(Ordering::Acquire) {
        MAATAA_UART_TX_DIAG.store(0x2000_0000, Ordering::Release);
        return Err(DriverError::NotSupported);
    }
    #[cfg(target_arch = "arm")]
    {
        // USART2 is configured once at boot; all accesses are in the
        // privileged kernel/SVC path and no other module touches its registers.
        for &byte in data {
            let mut tx_ready = false;
            let mut last_status = 0;
            for _ in 0..100_000 {
                last_status = regs::read(regs::SR);
                if last_status & regs::SR_TXE != 0 {
                    tx_ready = true;
                    break;
                }
                cortex_m::asm::delay(1);
            }
            if !tx_ready {
                MAATAA_UART_TX_DIAG.store(
                    0x8000_0000 | ((byte as u32) << 16) | (last_status & 0xffff),
                    Ordering::Release,
                );
                return Err(DriverError::Timeout);
            }
            regs::write(regs::DR, byte as u32);
        }
        let mut tx_complete = false;
        let mut last_status = 0;
        for _ in 0..100_000 {
            last_status = regs::read(regs::SR);
            if last_status & regs::SR_TC != 0 {
                tx_complete = true;
                break;
            }
            cortex_m::asm::delay(1);
        }
        if !tx_complete {
            MAATAA_UART_TX_DIAG.store(0xc000_0000 | (last_status & 0xffff), Ordering::Release);
            return Err(DriverError::Timeout);
        }
        MAATAA_UART_TX_DIAG.store(0x4000_0000 | (last_status & 0xffff), Ordering::Release);
        Ok(data.len())
    }
    #[cfg(not(target_arch = "arm"))]
    {
        let _ = data;
        Err(DriverError::NotSupported)
    }
}

/// Reads available bytes or atomically parks the current task until USART2
/// receives a byte. Interrupts remain masked across the empty check and the
/// scheduler state change, so an arriving byte cannot be lost between them.
pub fn read_or_block(buffer: &mut [u8]) -> Result<ReadResult, DriverError> {
    if !READY.load(Ordering::Acquire) {
        return Err(DriverError::NotSupported);
    }
    if buffer.is_empty() {
        return Ok(ReadResult::Bytes(0));
    }
    #[cfg(target_arch = "arm")]
    {
        let outcome = cortex_m::interrupt::free(|cs| {
            let mut queue = RX_BUFFER.borrow(cs).borrow_mut();
            let mut count = 0;
            for slot in buffer.iter_mut() {
                match queue.pop() {
                    Some(byte) => {
                        *slot = byte;
                        count += 1;
                    }
                    None => break,
                }
            }
            if count > 0 {
                Ok(ReadResult::Bytes(count))
            } else if crate::sched::block_current_for_uart(cs) {
                Ok(ReadResult::Blocked)
            } else {
                Ok(ReadResult::Bytes(0))
            }
        });
        if matches!(&outcome, Ok(ReadResult::Blocked)) {
            crate::sched::pend_scheduler_switch();
        }
        outcome
    }
    #[cfg(not(target_arch = "arm"))]
    {
        let _ = buffer;
        Err(DriverError::NotSupported)
    }
}

/// Writes formatted kernel logs, translating LF to CRLF for serial terminals.
pub fn write_fmt(args: fmt::Arguments<'_>) -> fmt::Result {
    struct Writer;
    impl fmt::Write for Writer {
        fn write_str(&mut self, text: &str) -> fmt::Result {
            let mut start = 0;
            for (index, byte) in text.bytes().enumerate() {
                if byte == b'\n' {
                    write(&text.as_bytes()[start..index]).map_err(|_| fmt::Error)?;
                    write(b"\r\n").map_err(|_| fmt::Error)?;
                    start = index + 1;
                }
            }
            write(&text.as_bytes()[start..]).map_err(|_| fmt::Error)?;
            Ok(())
        }
    }
    fmt::write(&mut Writer, args)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn receive_ring_preserves_fifo_order_and_wraps() {
        let mut ring = RxRing::new();
        for byte in 0..RX_CAPACITY {
            ring.push(byte as u8).unwrap();
        }
        assert!(ring.push(0xff).is_err());
        for byte in 0..128u8 {
            assert_eq!(ring.pop(), Some(byte));
        }
        for byte in 0..128u8 {
            ring.push(byte.wrapping_add(1)).unwrap();
        }
        for byte in 128..RX_CAPACITY {
            assert_eq!(ring.pop(), Some(byte as u8));
        }
        for byte in 0..128u8 {
            assert_eq!(ring.pop(), Some(byte.wrapping_add(1)));
        }
        assert_eq!(ring.pop(), None);
    }

    #[test]
    fn hardware_uart_is_unavailable_before_board_initialization() {
        assert_eq!(write(b"x"), Err(DriverError::NotSupported));
        assert!(matches!(
            read_or_block(&mut [0]),
            Err(DriverError::NotSupported)
        ));
    }
}
