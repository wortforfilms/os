//! QEMU self-test for the kernel clock (`src/clock.rs`).
//!
//! Run: `./scripts/qemu-clock-test.sh`. Exits QEMU with status 0 when every
//! check passes, 1 otherwise. QEMU does not model cycles exactly, so rates are
//! checked as ranges against the host clock, never as exact counts.
#![no_std]
#![no_main]

use core::panic::PanicInfo;
use cortex_m::interrupt;
use cortex_m::peripheral::SCB;
use cortex_m_rt::{entry, exception};
use cortex_m_semihosting::{debug, hprintln, syscall};
use maataa_os::clock;

#[exception]
fn SysTick() {
    clock::on_systick();
}

#[panic_handler]
fn panic(info: &PanicInfo) -> ! {
    hprintln!("FAIL: {}", info);
    debug::exit(debug::EXIT_FAILURE);
    loop {
        cortex_m::asm::wfi();
    }
}

/// Host wall time in nanoseconds since QEMU started (semihosting SYS_ELAPSED
/// scaled by SYS_TICKFREQ). Not SYS_CLOCK: QEMU answers SYS_CLOCK with the
/// host *process CPU time*, which stands still while the guest sleeps in WFI.
fn host_nanos() -> u64 {
    let mut words = [0u32; 2];
    // SAFETY: SYS_ELAPSED writes two words (low, high) into the block we pass.
    let status = unsafe {
        cortex_m_semihosting::syscall1(
            cortex_m_semihosting::nr::ELAPSED,
            words.as_mut_ptr() as usize,
        )
    };
    assert_eq!(status, 0, "SYS_ELAPSED supported");
    // SAFETY: SYS_TICKFREQ takes no arguments.
    let freq =
        unsafe { cortex_m_semihosting::syscall1(cortex_m_semihosting::nr::TICKFREQ, 0) } as u64;
    assert!(
        freq > 0 && freq != u32::MAX as u64,
        "SYS_TICKFREQ supported"
    );
    let ticks = (words[1] as u64) << 32 | words[0] as u64;
    (ticks as u128 * 1_000_000_000 / freq as u128) as u64
}

#[entry]
fn main() -> ! {
    let mut core = cortex_m::Peripherals::take().unwrap();

    // 1. Before start: zero, and no ticks.
    assert_eq!(clock::now_nanos(), 0, "clock reads 0 before start");
    assert_eq!(clock::ticks(), 0, "no ticks before start");
    hprintln!("ok  starts at 0");

    clock::start(&mut core.SYST);

    // 2. Advances: after sleeping 50 ms, at least 50 whole ticks.
    clock::sleep_ms(50);
    let ticks = clock::ticks();
    assert!(ticks >= 50, "advanced past 50 ticks (got {})", ticks);
    assert!(clock::now_nanos() >= 50_000_000, "50 ms elapsed");
    hprintln!("ok  advanced {} ticks", ticks);

    // 3. Monotonic over many back-to-back reads, across tick boundaries.
    let mut last = clock::now_nanos();
    for _ in 0..200_000 {
        let now = clock::now_nanos();
        assert!(now >= last, "monotonic: {} after {}", now, last);
        last = now;
    }
    assert_eq!(clock::regressions(), 0, "no clamped readings");
    hprintln!("ok  monotonic over 200000 reads, reached {} ns", last);

    // 4. A wrap the ISR could not handle yet is still counted.
    let (before, inside) = interrupt::free(|_| {
        let before = clock::ticks();
        while !SCB::is_pendst_pending() {}
        (before, clock::now_nanos())
    });
    assert!(
        inside >= (before + 1) * clock::NANOS_PER_TICK,
        "pending wrap counted: {} ns with {} handled ticks",
        inside,
        before
    );
    assert!(
        clock::ticks() > before,
        "ISR ran once interrupts were unmasked"
    );
    assert!(
        clock::now_nanos() >= inside,
        "monotonic after the pending tick"
    );
    hprintln!("ok  pending wrap counted while interrupts were masked");

    // 5. Rate against the host clock, as a range: ~2 s of host time.
    let host_start = host_nanos();
    let kernel_start = clock::now_nanos();
    while host_nanos() - host_start < 2_000_000_000 {
        cortex_m::asm::wfi();
    }
    let host_ns = host_nanos() - host_start;
    let kernel_ns = clock::now_nanos() - kernel_start;
    let ratio_pct = kernel_ns * 100 / host_ns;
    hprintln!(
        "    kernel {} ns vs host {} ns ({}%)",
        kernel_ns,
        host_ns,
        ratio_pct
    );
    // Without -icount, QEMU drives SysTick from host timers, so the observed
    // rate depends on the host: 99% on a Linux host, 76% on a macOS host
    // (likely host timer slack: late callbacks). That is an
    // emulator property, not a kernel one. A wrong clock configuration is a
    // different order of error (12 MHz assumed at 168 MHz reads 14x off), so
    // only that fails; the wider band is reported.
    assert!(
        (50..=200).contains(&ratio_pct),
        "rate within 50..=200% of host ({}%): check CORE_CLOCK_HZ and RELOAD",
        ratio_pct
    );
    if (80..=125).contains(&ratio_pct) {
        hprintln!("ok  rate within 80..=125% of the host clock");
    } else {
        hprintln!(
            "ok  rate within 50..=200% of the host clock (outside 80..=125%: host timer accuracy under QEMU, see docs/kernel-clock.md)"
        );
    }

    // 6. Hemant time comes from an anchor plus uptime, never uptime alone.
    // SAFETY: SYS_TIME takes no arguments and only returns a value.
    let unix = unsafe { syscall!(TIME) } as u64;
    let anchor = clock::HostAnchor {
        unix_seconds: unix,
        uptime_nanos: clock::now_nanos(),
    };
    let a = anchor
        .hemant_elapsed_nanos(clock::now_nanos())
        .expect("host clock after 1979");
    clock::sleep_ms(20);
    let b = anchor.hemant_elapsed_nanos(clock::now_nanos()).unwrap();
    assert!(
        b >= a + 20_000_000,
        "Hemant time advances with the kernel clock"
    );
    hprintln!(
        "ok  hemant time = anchor + uptime ({})",
        clock::HostAnchor::BASIS
    );

    hprintln!("clock self-test passed");
    debug::exit(debug::EXIT_SUCCESS);
    loop {
        cortex_m::asm::wfi();
    }
}
