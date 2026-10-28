//! Board-selected kernel output.
//!
//! Callers use the same `kprint!` and `kprintln!` macros on both boards. The
//! QEMU writes through semihosting; STM32F411 writes through USART2.

#[cfg(feature = "board-qemu-f405")]
#[allow(unused_imports)]
pub use cortex_m_semihosting::{hprint as kprint, hprintln as kprintln};

#[cfg(all(feature = "board-f411", not(feature = "board-qemu-f405")))]
#[macro_export]
macro_rules! kprint {
    ($($arg:tt)*) => {{
        let _ = $crate::drivers::uart::write_fmt(core::format_args!($($arg)*));
    }};
}

#[cfg(all(feature = "board-f411", not(feature = "board-qemu-f405")))]
#[macro_export]
macro_rules! kprintln {
    () => { $crate::kprint!("\n") };
    ($($arg:tt)*) => {{
        $crate::kprint!("{}\n", core::format_args!($($arg)*));
    }};
}

#[cfg(all(feature = "board-f411", not(feature = "board-qemu-f405")))]
pub use crate::{kprint, kprintln};
