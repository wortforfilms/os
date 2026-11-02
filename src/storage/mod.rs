//! Persistent storage: the sealed key-value store on flash sectors 6–7
//! (F411) or a host file (QEMU). See `persist` and docs/persistence.md.

pub mod persist;
