//! The run-time capsule area: one flash erase unit that holds the capsule
//! installed over the host channel.
//!
//! ```text
//! area:  [entry][entry]...[0xFF ...]
//! entry: "MCIN" | length u32 | commit u32 | removed u32 | image (padded to 4)
//! ```
//!
//! - An install appends an entry: its header first (commit and removed still
//!   erased), then the image in chunks, then, once the kernel has checked
//!   the image, the commit word (`0`). Each word is programmed once, from
//!   erased, so a power cut at any point leaves either the previous capsule
//!   or the new one installed.
//! - The newest committed entry that is not removed is the installed one.
//!   Committing a new one marks the previous one removed. An entry that was
//!   begun but never committed (refused, interrupted) is skipped, so a
//!   refused install leaves the previous capsule in place.
//! - When an install does not fit after the last entry, the area is
//!   compacted: the installed image is copied to RAM, the area erased, and
//!   the image written back first. A power cut inside that window loses the
//!   installed capsule (never half of it).

use crate::{Flash, StoreError};

/// Largest image the area accepts (an MCAP image: header, payload,
/// signature).
pub const MAX_IMAGE: usize = 4096;
pub const ENTRY_HEADER: u32 = 16;
const MAGIC: [u8; 4] = *b"MCIN";
const ERASED_WORD: [u8; 4] = [0xFF; 4];
const SET_WORD: [u8; 4] = [0; 4];

const fn padded(len: u32) -> u32 {
    (len + 3) & !3
}

/// Bytes an entry for an image of `len` bytes takes.
pub const fn entry_bytes(len: u32) -> u32 {
    ENTRY_HEADER + padded(len)
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
struct Entry {
    at: u32,
    len: u32,
}

pub struct InstallArea<F: Flash> {
    flash: F,
    /// First free offset.
    end: u32,
    active: Option<Entry>,
    pending: Option<Entry>,
}

impl<F: Flash> InstallArea<F> {
    /// Reads the area (bank 0 of `flash`) and finds the installed capsule.
    pub fn mount(mut flash: F) -> Result<Self, StoreError> {
        let size = flash.bank_size();
        let mut at = 0;
        let mut active = None;
        let end = loop {
            if at + ENTRY_HEADER > size {
                break size;
            }
            let mut header = [0u8; ENTRY_HEADER as usize];
            flash.read(0, at, &mut header)?;
            if header == [0xFF; ENTRY_HEADER as usize] {
                break at;
            }
            let len = u32::from_le_bytes([header[4], header[5], header[6], header[7]]);
            if header[..4] != MAGIC
                || len == 0
                || len as usize > MAX_IMAGE
                || at + entry_bytes(len) > size
            {
                // Damaged: nothing past here is used; the next install
                // compacts the area.
                break size;
            }
            if header[8..12] == SET_WORD && header[12..16] == ERASED_WORD {
                active = Some(Entry { at, len });
            }
            at += entry_bytes(len);
        };
        Ok(Self {
            flash,
            end,
            active,
            pending: None,
        })
    }

    /// Length of the installed image, if there is one.
    pub fn installed_len(&self) -> Option<usize> {
        self.active.map(|e| e.len as usize)
    }

    /// Copies the installed image into `out`; returns its length.
    pub fn read_installed(&mut self, out: &mut [u8]) -> Result<Option<usize>, StoreError> {
        let Some(entry) = self.active else {
            return Ok(None);
        };
        let len = entry.len as usize;
        if out.len() < len {
            return Err(StoreError::TooLong);
        }
        self.flash
            .read(0, entry.at + ENTRY_HEADER, &mut out[..len])?;
        Ok(Some(len))
    }

    /// Starts an install of an image of `len` bytes. `scratch` (at least
    /// [`MAX_IMAGE`] bytes) holds the installed image if the area has to be
    /// compacted first.
    pub fn begin(&mut self, len: usize, scratch: &mut [u8]) -> Result<(), StoreError> {
        if len == 0 || len > MAX_IMAGE {
            return Err(StoreError::TooLong);
        }
        self.abandon()?;
        let need = entry_bytes(len as u32);
        let size = self.flash.bank_size();
        if self.end + need > size {
            self.compact(scratch)?;
            if self.end + need > size {
                return Err(StoreError::Full);
            }
        }
        let at = self.end;
        let mut header = [0xFFu8; 8];
        header[..4].copy_from_slice(&MAGIC);
        header[4..8].copy_from_slice(&(len as u32).to_le_bytes());
        // Reserve the space before writing: a failed write is never reused.
        self.end += need;
        self.flash.program(0, at, &header)?;
        self.pending = Some(Entry {
            at,
            len: len as u32,
        });
        Ok(())
    }

    /// Writes part of the image being installed.
    pub fn write(&mut self, offset: usize, data: &[u8]) -> Result<(), StoreError> {
        let entry = self.pending.ok_or(StoreError::BadKey)?;
        let end = offset.checked_add(data.len()).ok_or(StoreError::TooLong)?;
        if end > entry.len as usize {
            return Err(StoreError::TooLong);
        }
        self.flash
            .program(0, entry.at + ENTRY_HEADER + offset as u32, data)?;
        Ok(())
    }

    /// Copies the image being installed into `out`, for checking before
    /// [`Self::commit`].
    pub fn read_pending(&mut self, out: &mut [u8]) -> Result<usize, StoreError> {
        let entry = self.pending.ok_or(StoreError::BadKey)?;
        let len = entry.len as usize;
        if out.len() < len {
            return Err(StoreError::TooLong);
        }
        self.flash
            .read(0, entry.at + ENTRY_HEADER, &mut out[..len])?;
        Ok(len)
    }

    /// Makes the image being installed the installed one.
    pub fn commit(&mut self) -> Result<(), StoreError> {
        let entry = self.pending.take().ok_or(StoreError::BadKey)?;
        self.flash.program(0, entry.at + 8, &SET_WORD)?;
        if let Some(old) = self.active.replace(entry) {
            self.flash.program(0, old.at + 12, &SET_WORD)?;
        }
        Ok(())
    }

    /// Drops the image being installed, if any; the installed one stays.
    pub fn abandon(&mut self) -> Result<(), StoreError> {
        if let Some(entry) = self.pending.take() {
            self.flash.program(0, entry.at + 12, &SET_WORD)?;
        }
        Ok(())
    }

    /// Removes the installed capsule.
    pub fn remove(&mut self) -> Result<bool, StoreError> {
        self.abandon()?;
        match self.active.take() {
            Some(entry) => {
                self.flash.program(0, entry.at + 12, &SET_WORD)?;
                Ok(true)
            }
            None => Ok(false),
        }
    }

    fn compact(&mut self, scratch: &mut [u8]) -> Result<(), StoreError> {
        let kept = self.read_installed(scratch)?;
        self.flash.erase(0)?;
        self.end = 0;
        self.active = None;
        if let Some(len) = kept {
            let mut header = [0xFFu8; 8];
            header[..4].copy_from_slice(&MAGIC);
            header[4..8].copy_from_slice(&(len as u32).to_le_bytes());
            self.flash.program(0, 0, &header)?;
            self.flash.program(0, ENTRY_HEADER, &scratch[..len])?;
            self.flash.program(0, 8, &SET_WORD)?;
            self.active = Some(Entry {
                at: 0,
                len: len as u32,
            });
            self.end = entry_bytes(len as u32);
        }
        Ok(())
    }

    /// The underlying flash, for tests.
    pub fn into_flash(self) -> F {
        self.flash
    }
}
