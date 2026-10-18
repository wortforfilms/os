//! Board-selected kernel output.
//!
//! Callers use the same `kprint!` and `kprintln!` macros on both boards. The
//! QEMU board writes through semihosting; the F411 board writes through RTT.

#[cfg(feature = "board-qemu-f405")]
#[allow(unused_imports)]
pub use cortex_m_semihosting::{hprint as kprint, hprintln as kprintln};

#[cfg(all(feature = "board-f411", not(feature = "board-qemu-f405")))]
#[allow(unused_imports)]
pub use rtt_target::{rprint as kprint, rprintln as kprintln};
