//! USART2 byte I/O for the STM32F411 Nucleo (ST-LINK virtual COM port).
//!
//! PA2 is TX and PA3 is RX at 115200 8-N-1. The HAL configures the peripheral
//! once during board bring-up; these bounded methods use its registers without
//! allocating. Reads are nonblocking and return zero when RX is empty.

use super::DriverError;
use core::fmt;
use core::sync::atomic::{AtomicBool, Ordering};

static READY: AtomicBool = AtomicBool::new(false);

/// Called only after board bring-up configures USART2 and PA2/PA3 through HAL.
#[cfg(all(
    target_arch = "arm",
    feature = "board-f411",
    not(feature = "board-qemu-f405")
))]
pub fn mark_initialized() {
    READY.store(true, Ordering::Release);
}

#[cfg(not(all(
    target_arch = "arm",
    feature = "board-f411",
    not(feature = "board-qemu-f405")
)))]
pub fn mark_initialized() {}

/// Writes every byte to USART2. This waits for TXE for each byte, so it is
/// suitable for short kernel log/syscall messages, not bulk transfers.
pub fn write(data: &[u8]) -> Result<usize, DriverError> {
    if !READY.load(Ordering::Acquire) {
        return Err(DriverError::NotSupported);
    }
    #[cfg(all(
        target_arch = "arm",
        feature = "board-f411",
        not(feature = "board-qemu-f405")
    ))]
    {
        // SAFETY: USART2 is configured once at boot; all accesses are in the
        // privileged kernel/SVC path and no other module touches its registers.
        let usart = unsafe { &*stm32f4xx_hal::pac::USART2::ptr() };
        for &byte in data {
            while !usart.sr().read().txe().bit_is_set() {}
            usart.dr().write(|w| unsafe { w.bits(byte as u16) });
        }
        Ok(data.len())
    }
    #[cfg(not(all(
        target_arch = "arm",
        feature = "board-f411",
        not(feature = "board-qemu-f405")
    )))]
    {
        let _ = data;
        Err(DriverError::NotSupported)
    }
}

/// Reads up to `buffer.len()` bytes already present in USART2's RX register.
/// Returns zero immediately when no byte is waiting.
pub fn read(buffer: &mut [u8]) -> Result<usize, DriverError> {
    if !READY.load(Ordering::Acquire) {
        return Err(DriverError::NotSupported);
    }
    #[cfg(all(
        target_arch = "arm",
        feature = "board-f411",
        not(feature = "board-qemu-f405")
    ))]
    {
        // SAFETY: same single-owner USART2 register access as `write`.
        let usart = unsafe { &*stm32f4xx_hal::pac::USART2::ptr() };
        let mut count = 0;
        for slot in buffer {
            if !usart.sr().read().rxne().bit_is_set() {
                break;
            }
            *slot = usart.dr().read().bits() as u8;
            count += 1;
        }
        Ok(count)
    }
    #[cfg(not(all(
        target_arch = "arm",
        feature = "board-f411",
        not(feature = "board-qemu-f405")
    )))]
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
    fn hardware_uart_is_unavailable_before_board_initialization() {
        assert_eq!(write(b"x"), Err(DriverError::NotSupported));
        assert_eq!(read(&mut [0]), Err(DriverError::NotSupported));
    }
}
