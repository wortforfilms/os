//! Rollback protection: a counter that only goes up, kept where whoever can
//! rewrite the store's flash cannot reset it (the STM32F411's one-time
//! programmable area).
//!
//! The store's generation rises by one with every compaction. The counter
//! holds the lowest generation the store may have: mount refuses a store
//! whose newest bank is older ([`crate::StoreError::RolledBack`]), and each
//! compaction raises the counter to the new generation, after the new bank's
//! header is written. A power cut between the two leaves the counter one
//! behind, which the next mount repairs.
//!
//! What it catches: an older copy of the flash put back, or the newest bank
//! erased so that mount would fall back to the older one. What it does not:
//! records cut off the end of the newest bank (same generation), and a store
//! erased completely (it is formatted again, empty, at the counter's
//! generation, so its nonces do not repeat either).

use crate::FlashError;

/// A counter that can only be raised.
pub trait RollbackCounter {
    /// The current value.
    fn value(&mut self) -> Result<u32, FlashError>;
    /// Raises the counter to `value` (no-op if it is already there or above;
    /// stops at [`Self::capacity`]).
    fn raise_to(&mut self, value: u32) -> Result<(), FlashError>;
    /// The highest value the counter can hold.
    fn capacity(&self) -> u32;
}

/// No counter: rollback is not detected.
#[derive(Clone, Copy, Debug, Default)]
pub struct NoCounter;

impl RollbackCounter for NoCounter {
    fn value(&mut self) -> Result<u32, FlashError> {
        Ok(0)
    }
    fn raise_to(&mut self, _: u32) -> Result<(), FlashError> {
        Ok(())
    }
    fn capacity(&self) -> u32 {
        u32::MAX
    }
}

/// Bytes that can each be programmed once, from 0xFF, and never erased.
pub trait OneTimeBytes {
    fn len(&self) -> usize;
    fn is_empty(&self) -> bool {
        self.len() == 0
    }
    fn read(&mut self, offset: usize) -> Result<u8, FlashError>;
    /// Programs the byte at `offset` (currently 0xFF) to `value`.
    fn program(&mut self, offset: usize, value: u8) -> Result<(), FlashError>;
}

/// A counter over one-time-programmable bytes: its value is the number of
/// bytes programmed to 0x00, which are used in order. Each step programs one
/// byte, once, so it never relies on programming a byte twice. A byte holding
/// anything but 0x00 or 0xFF (a torn write) is not counted and is skipped.
pub struct OtpCounter<O: OneTimeBytes> {
    otp: O,
}

impl<O: OneTimeBytes> OtpCounter<O> {
    pub fn new(otp: O) -> Self {
        Self { otp }
    }

    /// The value, and the first byte still erased.
    fn used(&mut self) -> Result<(u32, usize), FlashError> {
        let mut value = 0;
        for at in 0..self.otp.len() {
            match self.otp.read(at)? {
                0x00 => value += 1,
                0xFF => return Ok((value, at)),
                // Torn: not counted, and skipped from now on.
                _ => {}
            }
        }
        Ok((value, self.otp.len()))
    }

    pub fn into_inner(self) -> O {
        self.otp
    }
}

impl<O: OneTimeBytes> RollbackCounter for OtpCounter<O> {
    fn value(&mut self) -> Result<u32, FlashError> {
        Ok(self.used()?.0)
    }

    fn raise_to(&mut self, target: u32) -> Result<(), FlashError> {
        let (mut value, mut next) = self.used()?;
        while value < target && next < self.otp.len() {
            self.otp.program(next, 0x00)?;
            value += 1;
            next += 1;
        }
        Ok(())
    }

    fn capacity(&self) -> u32 {
        self.otp.len() as u32
    }
}
