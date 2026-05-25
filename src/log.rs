#[macro_export]
macro_rules! boot_log {
    ($($arg:tt)*) => {{
        #[cfg(target_arch = "arm")]
        {
            cortex_m_semihosting::hprintln!($($arg)*);
        }

        #[cfg(not(target_arch = "arm"))]
        {
            let _ = core::format_args!($($arg)*);
        }
    }};
}
