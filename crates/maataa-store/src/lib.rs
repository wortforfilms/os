//! A small key-value store on two flash banks that survives power loss.
//!
//! Each bank is an erase unit: on the STM32F411, a 128 KiB sector.
//!
//! ```text
//! bank:   [header 16 B][record][record]...[0xFF...]
//! header: "MKV1" | generation u32 | 0xFFFF_FFFF | CRC-32 of bytes 0..12
//! record: key u8 | length u8 | 0xFF 0xFF | value (padded to 4) | CRC-32
//! ```
//!
//! - Writes append a record. The newest record for a key wins, and length 0
//!   deletes the key.
//! - A record's CRC covers its first four bytes and its value. A record cut
//!   short by power loss fails its CRC; mount stops reading there and moves
//!   the live data to the other bank.
//! - When a bank is full, the live records are copied to the other bank,
//!   which was erased first. Its header, with the next generation number, is
//!   written last. If power fails before the header is written, the old bank
//!   is still the newest valid one.
//! - Mount picks the valid header with the highest generation. If neither
//!   bank has one, mount formats bank 0.
//!
//! Keys are `0..KEYS`, and values are at most [`MAX_VALUE`] bytes. An index
//! of each key's newest record is kept in RAM (`4 * KEYS` bytes), so reads do
//! not scan the bank.

#![cfg_attr(not(test), no_std)]

pub const KEYS: usize = 64;
pub const MAX_VALUE: usize = 64;
pub const HEADER_BYTES: u32 = 16;
const MAGIC: [u8; 4] = *b"MKV1";
const ERASED: u8 = 0xFF;

/// Storage the store runs on: two equal banks, erased to 0xFF, where
/// programming can only clear bits.
pub trait Flash {
    /// Bytes per bank; a multiple of 4 and at least 256.
    fn bank_size(&self) -> u32;
    fn read(&mut self, bank: u8, offset: u32, buf: &mut [u8]) -> Result<(), FlashError>;
    /// Programs bytes that are currently erased.
    fn program(&mut self, bank: u8, offset: u32, data: &[u8]) -> Result<(), FlashError>;
    /// Sets the whole bank to 0xFF.
    fn erase(&mut self, bank: u8) -> Result<(), FlashError>;
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FlashError {
    /// The hardware or host reported a failure (a status code).
    Device(u32),
    OutOfRange,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StoreError {
    Flash(FlashError),
    BadKey,
    TooLong,
    /// The live data does not fit in one bank.
    Full,
}

impl From<FlashError> for StoreError {
    fn from(e: FlashError) -> Self {
        Self::Flash(e)
    }
}

impl StoreError {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Flash(FlashError::Device(_)) => "flash device error",
            Self::Flash(FlashError::OutOfRange) => "flash access out of range",
            Self::BadKey => "key out of range",
            Self::TooLong => "value too long",
            Self::Full => "store full",
        }
    }
}

/// CRC-32/ISO-HDLC, bitwise, continuing from `crc` (start with 0).
pub fn crc32_update(crc: u32, bytes: &[u8]) -> u32 {
    let mut c = !crc;
    for &b in bytes {
        c ^= b as u32;
        for _ in 0..8 {
            c = if c & 1 != 0 {
                (c >> 1) ^ 0xEDB8_8320
            } else {
                c >> 1
            };
        }
    }
    !c
}

const fn padded(len: usize) -> usize {
    (len + 3) & !3
}

const fn record_bytes(len: usize) -> u32 {
    (4 + padded(len) + 4) as u32
}

/// What [`Store::mount`] found and did.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct MountReport {
    /// Neither bank had a valid header; bank 0 was formatted.
    pub formatted: bool,
    /// A torn or corrupt record was found; live data was moved to the other
    /// bank.
    pub recovered: bool,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct Stats {
    pub bank: u8,
    pub generation: u32,
    pub live_keys: u32,
    pub used_bytes: u32,
    pub bank_bytes: u32,
}

pub struct Store<F: Flash> {
    flash: F,
    active: u8,
    generation: u32,
    /// First free offset in the active bank.
    end: u32,
    /// Offset of each key's newest record; 0 means absent or deleted.
    index: [u32; KEYS],
}

impl<F: Flash> Store<F> {
    /// Opens the store, choosing the newest valid bank, formatting if there
    /// is none and recovering from a torn write.
    pub fn mount(mut flash: F) -> Result<(Self, MountReport), StoreError> {
        let size = flash.bank_size();
        assert!(size.is_multiple_of(4) && size >= 256, "bank size");
        let mut best: Option<(u8, u32)> = None;
        for bank in 0..2u8 {
            if let Some(generation) = read_header(&mut flash, bank)? {
                if best.is_none_or(|(_, g)| generation > g) {
                    best = Some((bank, generation));
                }
            }
        }
        let mut report = MountReport::default();
        let mut store = Store {
            flash,
            active: 0,
            generation: 0,
            end: HEADER_BYTES,
            index: [0; KEYS],
        };
        match best {
            None => {
                store.flash.erase(0)?;
                store.write_header(0, 1)?;
                store.generation = 1;
                report.formatted = true;
            }
            Some((bank, generation)) => {
                store.active = bank;
                store.generation = generation;
                if !store.scan()? {
                    store.compact()?;
                    report.recovered = true;
                }
            }
        }
        Ok((store, report))
    }

    /// Reads the active bank's records into the index. Returns `false` if it
    /// stopped at a damaged record rather than at erased flash.
    fn scan(&mut self) -> Result<bool, StoreError> {
        let size = self.flash.bank_size();
        self.index = [0; KEYS];
        let mut at = HEADER_BYTES;
        loop {
            if at + 4 > size {
                self.end = size;
                return Ok(true);
            }
            let mut head = [0u8; 4];
            self.flash.read(self.active, at, &mut head)?;
            if head == [ERASED; 4] {
                self.end = at;
                return Ok(true);
            }
            let (key, len) = (head[0] as usize, head[1] as usize);
            if key >= KEYS
                || len > MAX_VALUE
                || head[2..] != [ERASED, ERASED]
                || at + record_bytes(len) > size
            {
                self.end = at;
                return Ok(false);
            }
            let mut value = [0u8; MAX_VALUE];
            self.flash
                .read(self.active, at + 4, &mut value[..padded(len)])?;
            let mut crc = [0u8; 4];
            self.flash
                .read(self.active, at + 4 + padded(len) as u32, &mut crc)?;
            if crc32_update(crc32_update(0, &head), &value[..len]) != u32::from_le_bytes(crc) {
                self.end = at;
                return Ok(false);
            }
            self.index[key] = if len == 0 { 0 } else { at };
            at += record_bytes(len);
        }
    }

    fn write_header(&mut self, bank: u8, generation: u32) -> Result<(), StoreError> {
        let mut header = [0xFFu8; HEADER_BYTES as usize];
        header[..4].copy_from_slice(&MAGIC);
        header[4..8].copy_from_slice(&generation.to_le_bytes());
        let crc = crc32_update(0, &header[..12]);
        header[12..].copy_from_slice(&crc.to_le_bytes());
        self.flash.program(bank, 0, &header)?;
        Ok(())
    }

    /// Writes one record into `bank` at `at`. The CRC is written last.
    fn write_record(&mut self, bank: u8, at: u32, key: u8, value: &[u8]) -> Result<(), StoreError> {
        let head = [key, value.len() as u8, ERASED, ERASED];
        let crc = crc32_update(crc32_update(0, &head), value);
        let mut body = [ERASED; 4 + MAX_VALUE];
        body[..4].copy_from_slice(&head);
        body[4..4 + value.len()].copy_from_slice(value);
        self.flash.program(bank, at, &body[..4 + value.len()])?;
        self.flash.program(
            bank,
            at + 4 + padded(value.len()) as u32,
            &crc.to_le_bytes(),
        )?;
        Ok(())
    }

    /// Copies the live records to the other bank and makes it active.
    fn compact(&mut self) -> Result<(), StoreError> {
        let target = 1 - self.active;
        let size = self.flash.bank_size();
        self.flash.erase(target)?;
        let mut at = HEADER_BYTES;
        let mut new_index = [0u32; KEYS];
        for (key, slot) in new_index.iter_mut().enumerate() {
            let mut value = [0u8; MAX_VALUE];
            let Some(len) = self.get(key as u8, &mut value)? else {
                continue;
            };
            if at + record_bytes(len) > size {
                return Err(StoreError::Full);
            }
            self.write_record(target, at, key as u8, &value[..len])?;
            *slot = at;
            at += record_bytes(len);
        }
        let generation = self.generation.wrapping_add(1);
        self.write_header(target, generation)?;
        self.active = target;
        self.generation = generation;
        self.end = at;
        self.index = new_index;
        Ok(())
    }

    /// Copies key's value into `out` and returns its length, or `None`.
    pub fn get(&mut self, key: u8, out: &mut [u8]) -> Result<Option<usize>, StoreError> {
        let key = key as usize;
        if key >= KEYS {
            return Err(StoreError::BadKey);
        }
        let at = self.index[key];
        if at == 0 {
            return Ok(None);
        }
        let mut head = [0u8; 4];
        self.flash.read(self.active, at, &mut head)?;
        let len = head[1] as usize;
        if out.len() < len {
            return Err(StoreError::TooLong);
        }
        self.flash.read(self.active, at + 4, &mut out[..len])?;
        Ok(Some(len))
    }

    /// Stores `value` under `key`; an empty value deletes the key.
    pub fn put(&mut self, key: u8, value: &[u8]) -> Result<(), StoreError> {
        if key as usize >= KEYS {
            return Err(StoreError::BadKey);
        }
        if value.len() > MAX_VALUE {
            return Err(StoreError::TooLong);
        }
        let need = record_bytes(value.len());
        if self.end + need > self.flash.bank_size() {
            self.compact()?;
            if self.end + need > self.flash.bank_size() {
                return Err(StoreError::Full);
            }
        }
        let at = self.end;
        // Reserve the space first: a failed write must not be overwritten.
        self.end += need;
        self.write_record(self.active, at, key, value)?;
        self.index[key as usize] = if value.is_empty() { 0 } else { at };
        Ok(())
    }

    pub fn delete(&mut self, key: u8) -> Result<(), StoreError> {
        self.put(key, &[])
    }

    pub fn stats(&self) -> Stats {
        Stats {
            bank: self.active,
            generation: self.generation,
            live_keys: self.index.iter().filter(|&&at| at != 0).count() as u32,
            used_bytes: self.end,
            bank_bytes: self.flash.bank_size(),
        }
    }

    /// The underlying flash, for tests.
    pub fn into_flash(self) -> F {
        self.flash
    }
}

fn read_header<F: Flash>(flash: &mut F, bank: u8) -> Result<Option<u32>, StoreError> {
    let mut header = [0u8; HEADER_BYTES as usize];
    flash.read(bank, 0, &mut header)?;
    if header[..4] != MAGIC {
        return Ok(None);
    }
    let crc = u32::from_le_bytes([header[12], header[13], header[14], header[15]]);
    if crc32_update(0, &header[..12]) != crc {
        return Ok(None);
    }
    Ok(Some(u32::from_le_bytes([
        header[4], header[5], header[6], header[7],
    ])))
}

#[cfg(test)]
mod tests;
