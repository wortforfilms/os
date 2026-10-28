//! Board selection: the one place that knows the core clock frequency.
//!
//! | Feature | Board | Core clock | How |
//! | --- | --- | --- | --- |
//! | `board-qemu-f405` (default) | QEMU `netduinoplus2` (STM32F405) | 168 MHz | fixed: QEMU models the SoC at 168 MHz and has no RCC model to configure; writing RCC and waiting for PLL lock would hang |
//! | `board-f411` | STM32F411 (Black Pill, Nucleo-F411RE) | 100 MHz | `stm32f4xx-hal` RCC: HSI 16 MHz through the PLL, read back from the frozen clocks |
//!
//! The F411 path uses the internal HSI oscillator on purpose: the Black Pill
//! has a 25 MHz crystal and the Nucleo feeds 8 MHz from its ST-LINK, so an HSE
//! setting that suits one board breaks the other. HSI is factory-trimmed to
//! about 1% at 25 °C, which is enough for a monotonic clock; measuring drift
//! needs the LSE crystal or an external reference (docs/kernel-clock.md).

#[cfg(all(feature = "board-qemu-f405", feature = "board-f411"))]
compile_error!("select exactly one board feature: board-qemu-f405 or board-f411");

#[cfg(all(
    target_arch = "arm",
    not(any(feature = "board-qemu-f405", feature = "board-f411"))
))]
compile_error!("select a board feature: board-qemu-f405 (default) or board-f411");

/// Short board name for the boot report.
#[cfg(feature = "board-qemu-f405")]
pub const NAME: &str = "qemu-netduinoplus2-stm32f405";
#[cfg(all(feature = "board-f411", not(feature = "board-qemu-f405")))]
pub const NAME: &str = "stm32f411";

/// How the core clock value was obtained, printed in the boot report.
#[cfg(feature = "board-qemu-f405")]
pub const CLOCK_SOURCE: &str = "board assumption";
#[cfg(all(feature = "board-f411", not(feature = "board-qemu-f405")))]
pub const CLOCK_SOURCE: &str = "rcc configured";

/// Whether the host answers semihosting time calls (`SYS_TIME`,
/// `SYS_ELAPSED`). QEMU does; a debug probe may not, so hardware builds do not
/// ask and report the Hemant anchor as unavailable.
#[allow(dead_code)]
pub const HOST_TIME_AVAILABLE: bool = cfg!(feature = "board-qemu-f405");

/// QEMU `netduinoplus2` system clock.
#[allow(dead_code)] // used by one board only
pub const QEMU_F405_CORE_HZ: u32 = 168_000_000;
/// F411 target: the chip's maximum, reachable from the 16 MHz HSI.
#[allow(dead_code)] // used by one board only
pub const F411_CORE_HZ: u32 = 100_000_000;

/// Initializes the selected board's output once, before the first log line.
#[cfg(all(
    target_arch = "arm",
    feature = "board-f411",
    not(feature = "board-qemu-f405")
))]
pub fn init_logging() {
    // USART2 is initialized in `init_core_clock`, after its APB clock is known.
}

/// QEMU semihosting needs no separate initialization.
#[cfg(all(target_arch = "arm", feature = "board-qemu-f405"))]
pub const fn init_logging() {}

/// Host-side unit tests do not initialize embedded output.
#[cfg(not(target_arch = "arm"))]
pub const fn init_logging() {}

/// Sets up the clock tree (on hardware) and returns the core clock in Hz,
/// which is what SysTick counts with `SystClkSource::Core`. Call once, first.
#[cfg(all(target_arch = "arm", feature = "board-qemu-f405"))]
pub fn init_core_clock() -> u32 {
    QEMU_F405_CORE_HZ
}

#[cfg(all(
    target_arch = "arm",
    feature = "board-f411",
    not(feature = "board-qemu-f405")
))]
pub fn init_core_clock() -> u32 {
    use stm32f4xx_hal::{pac, prelude::*, rcc::Config, serial::SerialExt};

    let dp = pac::Peripherals::take().expect("device peripherals are taken once");
    // Keep the debug port alive in sleep: the kernel sleeps with WFI between
    // ticks, and without these bits a probe reading RTT can lose the core at
    // the first WFI (it showed as "Firmware exited unexpectedly: Exception").
    dp.DBGMCU
        .cr()
        .modify(|_, w| w.dbg_sleep().set_bit().dbg_stop().set_bit().dbg_standby().set_bit());
    let mut rcc = dp.RCC.freeze(Config::hsi().sysclk(F411_CORE_HZ.Hz()));
    let gpioa = dp.GPIOA.split(&mut rcc);
    // Nucleo-F411RE's ST-LINK virtual COM port is connected to USART2 PA2/PA3.
    let _serial: stm32f4xx_hal::serial::Serial2 = dp
        .USART2
        .serial((gpioa.pa2, gpioa.pa3), 115_200_u32.bps(), &mut rcc)
        .expect("USART2 115200 baud configuration is valid");
    crate::drivers::uart::mark_initialized();
    // SysTick's core source is HCLK. With no AHB prescaler HCLK = SYSCLK; if
    // a later change adds one, the clock must follow HCLK, so use it directly.
    rcc.clocks.hclk().raw()
}

/// Green user LED LD2 on the Nucleo-F411RE (PA5). Black Pill boards have their
/// LED on PC13 instead, so on a Black Pill this drives PA5 and nothing lights.
#[cfg(all(target_arch = "arm", feature = "board-f411", not(feature = "board-qemu-f405")))]
pub fn led_init() {
    use stm32f4xx_hal::pac;
    // SAFETY: called once at boot before the tasks start; only the GPIOA clock
    // bit and PA5's mode bits are changed.
    unsafe {
        let rcc = &*pac::RCC::ptr();
        rcc.ahb1enr().modify(|_, w| w.gpioaen().set_bit());
        let _ = rcc.ahb1enr().read(); // let the clock settle before touching GPIOA
        (*pac::GPIOA::ptr()).moder().modify(|_, w| w.moder5().output());
    }
}

/// Turns LD2 on or off. BSRR writes are atomic, so any task may call this.
#[cfg(all(target_arch = "arm", feature = "board-f411", not(feature = "board-qemu-f405")))]
pub fn led_set(on: bool) {
    use stm32f4xx_hal::pac;
    // SAFETY: a write-only set/reset register; it touches PA5 alone.
    unsafe {
        (*pac::GPIOA::ptr()).bsrr().write(|w| if on { w.bs5().set_bit() } else { w.br5().set_bit() });
    }
}

/// QEMU and host builds have no LED.
#[cfg(not(all(target_arch = "arm", feature = "board-f411", not(feature = "board-qemu-f405"))))]
pub fn led_init() {}
#[cfg(not(all(target_arch = "arm", feature = "board-f411", not(feature = "board-qemu-f405"))))]
pub fn led_set(_on: bool) {}
