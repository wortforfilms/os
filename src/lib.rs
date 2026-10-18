#![cfg_attr(not(test), no_std)]

pub mod board;
#[path = "capsule/mod.rs"]
pub mod capsule;
pub mod clock;
pub mod drivers;
pub mod ipc;
pub mod log;
#[path = "storage/mod.rs"]
pub mod storage;
