//! A small key-value store on two flash banks that survives power loss, with
//! every value encrypted and authenticated.
//!
//! Each bank is an erase unit: on the STM32F411, a 128 KiB sector.
//!
//! ```text
//! bank:   [header 32 B][record][record]...[0xFF...]
//! header: "MKV2" | generation u32 | key id u32 | 0xFFFF_FFFF | tag (16 B)
//! record: key u8 | length u8 | 0xFF 0xFF | sealed value (padded to 4) | tag (16 B)
//! ```
//!
//! - **Sealing.** Values are encrypted with ChaCha20-Poly1305 under the
//!   store key the caller gives [`Store::mount`]. The nonce is the bank's
//!   generation and the record's offset, so it is never reused while the
//!   generation keeps rising. The record's first four bytes are authenticated
//!   with it, and the header has a tag of its own. Someone who can rewrite
//!   the flash but does not have the key can neither read a value nor change
//!   one, move it to another key or offset, or make a forged bank win.
//! - **Not freshness.** That person can still put back an older copy of the
//!   flash, or cut records off the end of the log (mount treats that like a
//!   power cut). Detecting rollback needs a counter they cannot reset.
//! - **Key id.** The header carries 4 bytes derived from the key. A store
//!   sealed with a different key is refused with [`StoreError::WrongKey`],
//!   rather than formatted over.
//! - Writes append a record. The newest record for a key wins, and length 0
//!   deletes the key.
//! - The tag is written last. A record cut short by power loss fails its tag;
//!   mount stops reading there and moves the live data to the other bank.
//! - When a bank is full, the live records are copied to the other bank,
//!   which was erased first. Its header, with the next generation number, is
//!   written last. If power fails before the header is written, the old bank
//!   is still the newest valid one.
//! - Mount picks the valid header with the highest generation. If neither
//!   bank has one, mount formats bank 0.
//! - **Migration.** A store in the earlier, unsealed format (`MKV1`, CRC
//!   only) is read once and sealed into the other bank; the old bank is then
//!   erased. Only when no bank holds a sealed header: a sealed store never
//!   goes back to reading unsealed data.
//!
//! Keys are `0..KEYS`, and values are at most [`MAX_VALUE`] bytes. An index
//! of each key's newest record is kept in RAM (`4 * KEYS` bytes), so reads do
//! not scan the bank.

#![cfg_attr(not(test), no_std)]

use chacha20poly1305::aead::{AeadInPlace, KeyInit};
use chacha20poly1305::{ChaCha20Poly1305, Key, Nonce, Tag};

pub const KEYS: usize = 64;
pub const MAX_VALUE: usize = 64;
/// Header of a sealed bank.
pub const HEADER_BYTES: u32 = 32;
/// Header of an unsealed (`MKV1`) bank, read only to migrate it.
const V1_HEADER_BYTES: u32 = 16;
const MAGIC: [u8; 4] = *b"MKV2";
const V1_MAGIC: [u8; 4] = *b"MKV1";
const TAG_BYTES: usize = 16;
const ERASED: u8 = 0xFF;

/// A 256-bit store key.
pub type StoreKey = [u8; 32];

/// Derives a per-device store key from a master key and the device's unique
/// id, so a flash image copied to another board does not open there.
/// (ChaCha20 keystream under the master key, with the id as nonce.)
pub fn derive_device_key(master: &StoreKey, device_id: &[u8; 12]) -> StoreKey {
    let cipher = ChaCha20Poly1305::new(Key::from_slice(master));
    let mut key = [0u8; 32];
    // Encrypting zeros yields the keystream; the tag is not needed.
    let _ = cipher.encrypt_in_place_detached(
        Nonce::from_slice(device_id),
        b"maataa-store device key",
        &mut key,
    );
    key
}

/// The 4-byte id of a key that sealed headers carry (not secret).
pub fn key_id(key: &StoreKey) -> u32 {
    let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
    let tag = cipher
        .encrypt_in_place_detached(
            Nonce::from_slice(&[0xFF; 12]),
            b"maataa-store key id",
            &mut [],
        )
        .unwrap_or_default();
    u32::from_le_bytes([tag[0], tag[1], tag[2], tag[3]])
}

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
    /// The store was sealed with a different key; it was left untouched.
    WrongKey,
    /// A sealed value failed its check when it was read.
    Corrupt,
    /// The newest bank is older than the rollback counter allows: an older
    /// copy of the flash was put back. The flash was left untouched.
    RolledBack,
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
            Self::WrongKey => "sealed with a different key",
            Self::Corrupt => "a sealed value failed its check",
            Self::RolledBack => "rolled back to an older copy",
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
    (4 + padded(len) + TAG_BYTES) as u32
}

const fn v1_record_bytes(len: usize) -> u32 {
    (4 + padded(len) + 4) as u32
}

/// Nonce for the record at `offset` in a bank of `generation` (offset 0 is
/// the header).
fn nonce(generation: u32, offset: u32) -> [u8; 12] {
    let mut n = [0u8; 12];
    n[..4].copy_from_slice(&generation.to_le_bytes());
    n[4..8].copy_from_slice(&offset.to_le_bytes());
    n[8..].copy_from_slice(&MAGIC);
    n
}

/// What [`Store::mount`] found and did.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct MountReport {
    /// Neither bank had a valid header; bank 0 was formatted.
    pub formatted: bool,
    /// A torn or corrupt record was found; live data was moved to the other
    /// bank.
    pub recovered: bool,
    /// The store was in the unsealed `MKV1` format and was sealed.
    pub migrated: bool,
    /// The rollback counter is full: from here on, rollback is not detected.
    pub counter_full: bool,
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct Stats {
    pub bank: u8,
    pub generation: u32,
    pub live_keys: u32,
    pub used_bytes: u32,
    pub bank_bytes: u32,
}

/// Which format the active bank is in. Only `Sealed` is ever written.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Format {
    Sealed,
    Unsealed,
}

/// What a bank's header says.
enum Header {
    None,
    Sealed(u32),
    /// A sealed header for a different key.
    Foreign,
    Unsealed(u32),
}

pub struct Store<F: Flash, C: RollbackCounter = NoCounter> {
    flash: F,
    counter: C,
    cipher: ChaCha20Poly1305,
    key_id: u32,
    format: Format,
    active: u8,
    generation: u32,
    /// First free offset in the active bank.
    end: u32,
    /// Offset of each key's newest record; 0 means absent or deleted.
    index: [u32; KEYS],
}

impl<F: Flash> Store<F> {
    /// Opens the store with `key`, without rollback protection.
    pub fn mount(flash: F, key: &StoreKey) -> Result<(Self, MountReport), StoreError> {
        Store::mount_with_counter(flash, key, NoCounter)
    }
}

impl<F: Flash, C: RollbackCounter> Store<F, C> {
    /// Opens the store with `key`, choosing the newest valid bank, formatting
    /// blank flash, migrating an unsealed store and recovering from a torn
    /// write. `counter` gives rollback protection ([`rollback`]).
    pub fn mount_with_counter(
        mut flash: F,
        key: &StoreKey,
        mut counter: C,
    ) -> Result<(Self, MountReport), StoreError> {
        let size = flash.bank_size();
        assert!(size.is_multiple_of(4) && size >= 256, "bank size");
        let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
        let key_id = key_id(key);
        let mut sealed: Option<(u8, u32)> = None;
        let mut unsealed: Option<(u8, u32)> = None;
        let mut foreign = false;
        for bank in 0..2u8 {
            match read_header(&mut flash, &cipher, key_id, bank)? {
                Header::Sealed(generation) => {
                    if sealed.is_none_or(|(_, g)| generation > g) {
                        sealed = Some((bank, generation));
                    }
                }
                Header::Unsealed(generation) => {
                    if unsealed.is_none_or(|(_, g)| generation > g) {
                        unsealed = Some((bank, generation));
                    }
                }
                Header::Foreign => foreign = true,
                Header::None => {}
            }
        }
        let floor = counter.value()?;
        if let Some((_, generation)) = sealed {
            if generation < floor {
                return Err(StoreError::RolledBack);
            }
        }
        let mut report = MountReport::default();
        let mut store = Store {
            flash,
            counter,
            cipher,
            key_id,
            format: Format::Sealed,
            active: 0,
            generation: 0,
            end: HEADER_BYTES,
            index: [0; KEYS],
        };
        match (sealed, unsealed) {
            (Some((bank, generation)), _) => {
                store.active = bank;
                store.generation = generation;
                if !store.scan()? {
                    store.compact()?;
                    report.recovered = true;
                }
            }
            // A sealed header for another key and nothing for ours: leave the
            // flash alone.
            (None, _) if foreign => return Err(StoreError::WrongKey),
            (None, Some((bank, generation))) => {
                store.format = Format::Unsealed;
                store.active = bank;
                store.generation = generation;
                report.recovered = !store.scan()?;
                // Sealed generations continue at the counter at least.
                store.generation = generation.max(floor);
                // Seal the live data into the other bank, then erase the
                // unsealed one so it can never be read again.
                store.compact()?;
                store.flash.erase(bank)?;
                report.migrated = true;
            }
            (None, None) => {
                // Blank (or erased) flash starts at the counter's generation,
                // so an erase cannot reset the counter's meaning, and nonces
                // do not repeat those of the erased data.
                let generation = floor.max(1);
                store.flash.erase(0)?;
                store.write_header(0, generation)?;
                store.generation = generation;
                report.formatted = true;
            }
        }
        store.counter.raise_to(store.generation)?;
        report.counter_full = store.generation > store.counter.capacity();
        Ok((store, report))
    }

    /// Bytes from the start of the active bank to its first record.
    fn header_bytes(&self) -> u32 {
        match self.format {
            Format::Sealed => HEADER_BYTES,
            Format::Unsealed => V1_HEADER_BYTES,
        }
    }

    fn record_bytes(&self, len: usize) -> u32 {
        match self.format {
            Format::Sealed => record_bytes(len),
            Format::Unsealed => v1_record_bytes(len),
        }
    }

    /// Reads and checks the record at `at` in the active bank whose first
    /// bytes are `head`, and decrypts its value into `out`.
    fn open_record(&mut self, at: u32, head: [u8; 4], out: &mut [u8]) -> Result<bool, StoreError> {
        let len = head[1] as usize;
        self.flash.read(self.active, at + 4, &mut out[..len])?;
        match self.format {
            Format::Sealed => {
                // Padding is not sealed, so it must still be erased.
                let mut pad = [0u8; 3];
                let pad = &mut pad[..padded(len) - len];
                if !pad.is_empty() {
                    self.flash.read(self.active, at + 4 + len as u32, pad)?;
                }
                if pad.iter().any(|&b| b != ERASED) {
                    return Ok(false);
                }
                let mut tag = [0u8; TAG_BYTES];
                self.flash
                    .read(self.active, at + 4 + padded(len) as u32, &mut tag)?;
                Ok(self
                    .cipher
                    .decrypt_in_place_detached(
                        Nonce::from_slice(&nonce(self.generation, at)),
                        &head,
                        &mut out[..len],
                        Tag::from_slice(&tag),
                    )
                    .is_ok())
            }
            Format::Unsealed => {
                let mut crc = [0u8; 4];
                self.flash
                    .read(self.active, at + 4 + padded(len) as u32, &mut crc)?;
                Ok(crc32_update(crc32_update(0, &head), &out[..len]) == u32::from_le_bytes(crc))
            }
        }
    }

    /// Reads the active bank's records into the index. Returns `false` if it
    /// stopped at a damaged record rather than at erased flash.
    fn scan(&mut self) -> Result<bool, StoreError> {
        let size = self.flash.bank_size();
        self.index = [0; KEYS];
        let mut at = self.header_bytes();
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
                || at + self.record_bytes(len) > size
            {
                self.end = at;
                return Ok(false);
            }
            let mut value = [0u8; MAX_VALUE];
            if !self.open_record(at, head, &mut value)? {
                self.end = at;
                return Ok(false);
            }
            self.index[key] = if len == 0 { 0 } else { at };
            at += self.record_bytes(len);
        }
    }

    fn write_header(&mut self, bank: u8, generation: u32) -> Result<(), StoreError> {
        let header = seal_header(&self.cipher, self.key_id, generation);
        self.flash.program(bank, 0, &header)?;
        Ok(())
    }

    /// Writes one sealed record into `bank` (of `generation`) at `at`. The
    /// tag is written last.
    fn write_record(
        &mut self,
        bank: u8,
        generation: u32,
        at: u32,
        key: u8,
        value: &[u8],
    ) -> Result<(), StoreError> {
        let head = [key, value.len() as u8, ERASED, ERASED];
        let mut body = [ERASED; 4 + MAX_VALUE];
        body[..4].copy_from_slice(&head);
        body[4..4 + value.len()].copy_from_slice(value);
        let tag = self
            .cipher
            .encrypt_in_place_detached(
                Nonce::from_slice(&nonce(generation, at)),
                &head,
                &mut body[4..4 + value.len()],
            )
            .map_err(|_| StoreError::TooLong)?;
        self.flash.program(bank, at, &body[..4 + value.len()])?;
        self.flash
            .program(bank, at + 4 + padded(value.len()) as u32, &tag)?;
        Ok(())
    }

    /// Copies the live records to the other bank and makes it active.
    fn compact(&mut self) -> Result<(), StoreError> {
        let target = 1 - self.active;
        let size = self.flash.bank_size();
        let generation = self.generation.wrapping_add(1);
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
            self.write_record(target, generation, at, key as u8, &value[..len])?;
            *slot = at;
            at += record_bytes(len);
        }
        self.write_header(target, generation)?;
        self.format = Format::Sealed;
        self.active = target;
        self.generation = generation;
        self.end = at;
        self.index = new_index;
        // After the header: a power cut before this leaves the counter one
        // behind, and the next mount raises it.
        self.counter.raise_to(generation)?;
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
        if len > MAX_VALUE {
            return Err(StoreError::Corrupt);
        }
        if out.len() < len {
            return Err(StoreError::TooLong);
        }
        // Checked again on every read: the flash may have changed since mount.
        if !self.open_record(at, head, out)? {
            out[..len].fill(0);
            return Err(StoreError::Corrupt);
        }
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
        self.write_record(self.active, self.generation, at, key, value)?;
        self.index[key as usize] = if value.is_empty() { 0 } else { at };
        Ok(())
    }

    pub fn delete(&mut self, key: u8) -> Result<(), StoreError> {
        self.put(key, &[])
    }

    /// The id of the key this store is sealed with (not secret).
    pub fn key_id(&self) -> u32 {
        self.key_id
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

    /// The flash and the counter, for tests.
    pub fn into_parts(self) -> (F, C) {
        (self.flash, self.counter)
    }
}

fn seal_header(cipher: &ChaCha20Poly1305, key_id: u32, generation: u32) -> [u8; 32] {
    let mut header = [0xFFu8; HEADER_BYTES as usize];
    header[..4].copy_from_slice(&MAGIC);
    header[4..8].copy_from_slice(&generation.to_le_bytes());
    header[8..12].copy_from_slice(&key_id.to_le_bytes());
    let (aad, tag) = header.split_at_mut(16);
    let sealed = cipher
        .encrypt_in_place_detached(Nonce::from_slice(&nonce(generation, 0)), aad, &mut [])
        .unwrap_or_default();
    tag.copy_from_slice(&sealed);
    header
}

fn read_header<F: Flash>(
    flash: &mut F,
    cipher: &ChaCha20Poly1305,
    key_id: u32,
    bank: u8,
) -> Result<Header, StoreError> {
    let mut header = [0u8; HEADER_BYTES as usize];
    flash.read(bank, 0, &mut header)?;
    let word =
        |i: usize| u32::from_le_bytes([header[i], header[i + 1], header[i + 2], header[i + 3]]);
    if header[..4] == V1_MAGIC {
        return Ok(if crc32_update(0, &header[..12]) == word(12) {
            Header::Unsealed(word(4))
        } else {
            Header::None
        });
    }
    if header[..4] != MAGIC {
        return Ok(Header::None);
    }
    if word(8) != key_id {
        return Ok(Header::Foreign);
    }
    let generation = word(4);
    let (aad, tag) = header.split_at_mut(16);
    let ok = cipher
        .decrypt_in_place_detached(
            Nonce::from_slice(&nonce(generation, 0)),
            aad,
            &mut [],
            Tag::from_slice(tag),
        )
        .is_ok();
    Ok(if ok {
        Header::Sealed(generation)
    } else {
        Header::None
    })
}

pub mod area;
pub mod rollback;

pub use rollback::{NoCounter, RollbackCounter};

#[cfg(test)]
mod tests;
