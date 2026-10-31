//! Signed capsule images (MCAP, format version 1) and the capability bits
//! they grant.
//!
//! | Offset | Size | Field |
//! | --- | --- | --- |
//! | 0 | 4 | magic `MCAP` |
//! | 4 | 1 | format version, `1` |
//! | 5 | 1 | name length, 1..=16 |
//! | 6 | 2 | reserved, must be 0 |
//! | 8 | 4 | capabilities granted (bit *n* allows syscall *n*), little-endian |
//! | 12 | 4 | payload length *L*, little-endian |
//! | 16 | 16 | name, UTF-8, zero-padded |
//! | 32 | *L* | payload |
//! | 32 + *L* | 64 | ed25519 signature over bytes `0..32 + L` |
//!
//! The signature covers the header, so the capability word cannot be changed
//! without the signer's key. The kernel holds only the public key.

#![cfg_attr(not(any(test, feature = "cli")), no_std)]

use ed25519_compact::{PublicKey, Signature};

pub const MAGIC: [u8; 4] = *b"MCAP";
pub const FORMAT_VERSION: u8 = 1;
pub const HEADER_BYTES: usize = 32;
pub const SIGNATURE_BYTES: usize = 64;
pub const MAX_NAME: usize = 16;
/// Largest payload accepted (the kernel's capsule budget is 64 KiB).
pub const MAX_PAYLOAD: usize = 64 * 1024;

/// Seed of the development signing key. It is public on purpose: images
/// signed with it prove integrity, not who signed them. Release builds embed
/// another public key (`MAATAA_CAPSULE_PUBKEY`) and reject dev-signed images.
pub const DEV_SEED: [u8; 32] = *b"maataa-os-dev-capsule-NOT-SECRET";

/// Capability bits. Bit *n* allows supervisor call *n* (src/syscall.rs).
pub mod cap {
    pub const WRITE: u32 = 1 << 1;
    pub const LED: u32 = 1 << 2;
    pub const DEMO_DONE: u32 = 1 << 3;
    pub const TEST: u32 = 1 << 4;
    pub const SEND: u32 = 1 << 5;
    pub const RECV: u32 = 1 << 6;
    pub const SLEEP: u32 = 1 << 7;
    /// Lock and unlock (calls 8 and 9).
    pub const MUTEX: u32 = (1 << 8) | (1 << 9);
    /// Wait and post (calls 10 and 11).
    pub const SEMAPHORE: u32 = (1 << 10) | (1 << 11);
    pub const UART_WRITE: u32 = 1 << 12;
    pub const UART_READ: u32 = 1 << 13;
    pub const HOST_STATUS: u32 = 1 << 14;
    /// Every call defined today.
    pub const ALL: u32 = WRITE
        | LED
        | DEMO_DONE
        | TEST
        | SEND
        | RECV
        | SLEEP
        | MUTEX
        | SEMAPHORE
        | UART_WRITE
        | UART_READ
        | HOST_STATUS;

    /// Whether `mask` allows supervisor call `number`.
    pub const fn allows(mask: u32, number: u8) -> bool {
        number < 32 && mask & (1 << number) != 0
    }

    /// Short names in bit order, for logs and the host tool.
    pub const NAMES: [(u32, &str); 12] = [
        (WRITE, "write"),
        (LED, "led"),
        (DEMO_DONE, "demo_done"),
        (TEST, "test"),
        (SEND, "send"),
        (RECV, "recv"),
        (SLEEP, "sleep"),
        (MUTEX, "mutex"),
        (SEMAPHORE, "semaphore"),
        (UART_WRITE, "uart_write"),
        (UART_READ, "uart_read"),
        (HOST_STATUS, "host_status"),
    ];
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CapsuleError {
    TooShort,
    BadMagic,
    BadVersion,
    BadName,
    ReservedNotZero,
    /// Bits set that no syscall uses.
    UnknownCapability,
    PayloadTooLong,
    /// The length field does not match the image size.
    LengthMismatch,
    BadSignature,
    BufferTooSmall,
}

impl CapsuleError {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::TooShort => "image too short",
            Self::BadMagic => "not an MCAP image",
            Self::BadVersion => "unsupported format version",
            Self::BadName => "bad name",
            Self::ReservedNotZero => "reserved bytes not zero",
            Self::UnknownCapability => "unknown capability bits",
            Self::PayloadTooLong => "payload too long",
            Self::LengthMismatch => "length does not match image",
            Self::BadSignature => "bad signature",
            Self::BufferTooSmall => "output buffer too small",
        }
    }
}

/// A verified capsule, borrowing from the image.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Capsule<'a> {
    pub name: &'a str,
    pub capabilities: u32,
    pub payload: &'a [u8],
}

/// Checks the layout, then the signature, and returns the capsule. Nothing in
/// the image is trusted until both pass.
pub fn verify<'a>(image: &'a [u8], public_key: &[u8; 32]) -> Result<Capsule<'a>, CapsuleError> {
    let (name, capabilities, payload_len) = parse_header(image)?;
    let signed_len = HEADER_BYTES + payload_len;
    if image.len() != signed_len + SIGNATURE_BYTES {
        return Err(CapsuleError::LengthMismatch);
    }
    let key = PublicKey::new(*public_key);
    let signature =
        Signature::from_slice(&image[signed_len..]).map_err(|_| CapsuleError::BadSignature)?;
    key.verify(&image[..signed_len], &signature)
        .map_err(|_| CapsuleError::BadSignature)?;
    Ok(Capsule {
        name,
        capabilities,
        payload: &image[HEADER_BYTES..signed_len],
    })
}

fn parse_header(image: &[u8]) -> Result<(&str, u32, usize), CapsuleError> {
    if image.len() < HEADER_BYTES + SIGNATURE_BYTES {
        return Err(CapsuleError::TooShort);
    }
    let header = &image[..HEADER_BYTES];
    if header[0..4] != MAGIC {
        return Err(CapsuleError::BadMagic);
    }
    if header[4] != FORMAT_VERSION {
        return Err(CapsuleError::BadVersion);
    }
    if header[6] != 0 || header[7] != 0 {
        return Err(CapsuleError::ReservedNotZero);
    }
    let name_len = header[5] as usize;
    if name_len == 0 || name_len > MAX_NAME {
        return Err(CapsuleError::BadName);
    }
    let name_field = &header[16..32];
    if name_field[name_len..].iter().any(|&b| b != 0) {
        return Err(CapsuleError::BadName);
    }
    let name = core::str::from_utf8(&name_field[..name_len]).map_err(|_| CapsuleError::BadName)?;
    let capabilities = u32::from_le_bytes([header[8], header[9], header[10], header[11]]);
    if capabilities & !cap::ALL != 0 {
        return Err(CapsuleError::UnknownCapability);
    }
    let payload_len = u32::from_le_bytes([header[12], header[13], header[14], header[15]]) as usize;
    if payload_len > MAX_PAYLOAD {
        return Err(CapsuleError::PayloadTooLong);
    }
    Ok((name, capabilities, payload_len))
}

/// Writes the unsigned part (header and payload) of an image into `out` and
/// returns its length; the signer appends 64 signature bytes.
pub fn write_unsigned(
    name: &str,
    capabilities: u32,
    payload: &[u8],
    out: &mut [u8],
) -> Result<usize, CapsuleError> {
    let name_bytes = name.as_bytes();
    if name_bytes.is_empty() || name_bytes.len() > MAX_NAME || name_bytes.contains(&0) {
        return Err(CapsuleError::BadName);
    }
    if capabilities & !cap::ALL != 0 {
        return Err(CapsuleError::UnknownCapability);
    }
    if payload.len() > MAX_PAYLOAD {
        return Err(CapsuleError::PayloadTooLong);
    }
    let len = HEADER_BYTES + payload.len();
    if out.len() < len {
        return Err(CapsuleError::BufferTooSmall);
    }
    out[..HEADER_BYTES].fill(0);
    out[0..4].copy_from_slice(&MAGIC);
    out[4] = FORMAT_VERSION;
    out[5] = name_bytes.len() as u8;
    out[8..12].copy_from_slice(&capabilities.to_le_bytes());
    out[12..16].copy_from_slice(&(payload.len() as u32).to_le_bytes());
    out[16..16 + name_bytes.len()].copy_from_slice(name_bytes);
    out[HEADER_BYTES..len].copy_from_slice(payload);
    Ok(len)
}

/// Host side: a complete signed image.
#[cfg(any(test, feature = "cli"))]
pub fn sign(
    name: &str,
    capabilities: u32,
    payload: &[u8],
    seed: &[u8; 32],
) -> Result<Vec<u8>, CapsuleError> {
    let key_pair = ed25519_compact::KeyPair::from_seed(ed25519_compact::Seed::new(*seed));
    let mut image = vec![0u8; HEADER_BYTES + payload.len() + SIGNATURE_BYTES];
    let len = write_unsigned(name, capabilities, payload, &mut image)?;
    let signature = key_pair.sk.sign(&image[..len], None);
    image[len..].copy_from_slice(signature.as_ref());
    Ok(image)
}

/// Host side: the public key for a seed.
#[cfg(any(test, feature = "cli"))]
pub fn public_key(seed: &[u8; 32]) -> [u8; 32] {
    *ed25519_compact::KeyPair::from_seed(ed25519_compact::Seed::new(*seed)).pk
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dev_key() -> [u8; 32] {
        public_key(&DEV_SEED)
    }

    #[test]
    fn signed_image_verifies_and_exposes_fields() {
        let image = sign(
            "telemetry",
            cap::WRITE | cap::SLEEP,
            b"\0asm-payload",
            &DEV_SEED,
        )
        .unwrap();
        let capsule = verify(&image, &dev_key()).unwrap();
        assert_eq!(capsule.name, "telemetry");
        assert_eq!(capsule.capabilities, cap::WRITE | cap::SLEEP);
        assert_eq!(capsule.payload, b"\0asm-payload");
    }

    #[test]
    fn any_flipped_bit_is_rejected() {
        let image = sign("ctl", cap::SEND, b"payload", &DEV_SEED).unwrap();
        let key = dev_key();
        for byte in 0..image.len() {
            let mut bad = image.clone();
            bad[byte] ^= 0x01;
            assert!(verify(&bad, &key).is_err(), "flip at byte {byte} accepted");
        }
    }

    #[test]
    fn raising_capabilities_breaks_the_signature() {
        let image = sign("hostlink", cap::UART_WRITE, b"", &DEV_SEED).unwrap();
        let mut forged = image.clone();
        forged[8..12].copy_from_slice(&(cap::UART_WRITE | cap::LED).to_le_bytes());
        assert_eq!(verify(&forged, &dev_key()), Err(CapsuleError::BadSignature));
    }

    #[test]
    fn another_key_is_rejected() {
        let image = sign("x", 0, b"p", &DEV_SEED).unwrap();
        let other = public_key(&[7u8; 32]);
        assert_eq!(verify(&image, &other), Err(CapsuleError::BadSignature));
    }

    #[test]
    fn layout_errors_are_reported_before_signature_work() {
        let key = dev_key();
        let image = sign("x", 0, b"p", &DEV_SEED).unwrap();
        assert_eq!(verify(&image[..40], &key), Err(CapsuleError::TooShort));
        let mut longer = image.clone();
        longer.push(0);
        assert_eq!(verify(&longer, &key), Err(CapsuleError::LengthMismatch));
        let mut magic = image.clone();
        magic[0] = b'X';
        assert_eq!(verify(&magic, &key), Err(CapsuleError::BadMagic));
        let mut unknown = image.clone();
        unknown[11] = 0x80;
        assert_eq!(verify(&unknown, &key), Err(CapsuleError::UnknownCapability));
    }

    #[test]
    fn writer_rejects_bad_inputs() {
        let mut out = [0u8; 64];
        assert_eq!(
            write_unsigned("", 0, b"", &mut out),
            Err(CapsuleError::BadName)
        );
        assert_eq!(
            write_unsigned("seventeen-chars!!", 0, b"", &mut out),
            Err(CapsuleError::BadName)
        );
        assert_eq!(
            write_unsigned("x", 1 << 30, b"", &mut out),
            Err(CapsuleError::UnknownCapability)
        );
        assert_eq!(
            write_unsigned("x", 0, &[0; 40], &mut out),
            Err(CapsuleError::BufferTooSmall)
        );
    }

    #[test]
    fn capability_bits_match_syscall_numbers() {
        assert!(cap::allows(cap::WRITE, 1));
        assert!(cap::allows(cap::MUTEX, 8) && cap::allows(cap::MUTEX, 9));
        assert!(cap::allows(cap::SEMAPHORE, 10) && cap::allows(cap::SEMAPHORE, 11));
        assert!(cap::allows(cap::HOST_STATUS, 14));
        assert!(!cap::allows(cap::ALL, 0));
        assert!(!cap::allows(cap::ALL, 15));
        assert!(!cap::allows(u32::MAX, 40));
    }

    #[test]
    fn committed_dev_key_matches_the_seed() {
        let hex: String = dev_key().iter().map(|b| format!("{b:02x}")).collect();
        let committed = include_str!("../../../keys/capsule-dev.pub").trim();
        assert_eq!(
            committed, hex,
            "keys/capsule-dev.pub is not the DEV_SEED public key"
        );
    }

    #[test]
    fn committed_capsules_verify_with_the_dev_key() {
        for (file, image) in [
            (
                "telemetry",
                &include_bytes!("../../../assets/capsules/telemetry.mcap")[..],
            ),
            (
                "control",
                &include_bytes!("../../../assets/capsules/control.mcap")[..],
            ),
            (
                "hostlink",
                &include_bytes!("../../../assets/capsules/hostlink.mcap")[..],
            ),
        ] {
            let capsule =
                verify(image, &dev_key()).unwrap_or_else(|e| panic!("{file}: {}", e.as_str()));
            assert_eq!(capsule.name, file);
        }
    }
}
