#![cfg_attr(not(test), no_std)]

pub mod board;
#[path = "capsule/mod.rs"]
pub mod capsule;
pub mod capsule_task;
pub mod clock;
pub mod crash;
pub mod drivers;
pub mod hostlink;
pub mod ipc;
pub mod log;
pub mod logging;
pub mod mpu;
pub mod sched;
#[path = "storage/mod.rs"]
pub mod storage;
pub mod syscall;
pub mod watchdog;
