//! Signed host requests (docs/SECURITY_DESIGN.md, Part A).
//!
//! A host request that changes the board (remove the run-time capsule,
//! commit an install, write a store key the host does not own) carries an
//! ed25519 signature by the capsule key over the label, the current
//! challenge, the operation and its arguments
//! (`maataa_link::host_auth::message`). The board holds only the public key.
//!
//! The challenge is the chip id, the boot count (kernel key 0, which grows
//! every boot) and a sequence number that starts at 0 each boot and grows
//! by one each time a request is accepted. So a signature works once, on
//! one board, in one boot. Nothing is written to flash for a challenge.

use core::sync::atomic::{AtomicU32, Ordering};
use maataa_link::host_auth::{self, CHALLENGE_BYTES, MAX_MESSAGE};

/// The boot count before the store has counted this boot.
const UNKNOWN_BOOT: u32 = u32::MAX;

static BOOT_COUNT: AtomicU32 = AtomicU32::new(UNKNOWN_BOOT);
static SEQUENCE: AtomicU32 = AtomicU32::new(0);

/// Called by the kernel once the store has counted this boot. Without it
/// there is no challenge, and every signed request is refused.
pub fn set_boot_count(count: u32) {
    BOOT_COUNT.store(count, Ordering::SeqCst);
}

/// The current challenge, or `None` if the boot was not counted (no store).
pub fn challenge() -> Option<[u8; CHALLENGE_BYTES]> {
    let boot = BOOT_COUNT.load(Ordering::SeqCst);
    if boot == UNKNOWN_BOOT {
        return None;
    }
    Some(host_auth::challenge(
        &crate::storage::persist::device_id(),
        boot,
        SEQUENCE.load(Ordering::SeqCst),
    ))
}

/// Whether `signature` signs `operation` and `args` under `challenge` with
/// `public_key`.
pub fn signature_valid(
    challenge: &[u8; CHALLENGE_BYTES],
    operation: u8,
    args: &[u8],
    signature: &[u8; 64],
    public_key: &[u8; 32],
) -> bool {
    let mut message = [0u8; MAX_MESSAGE];
    match host_auth::message(challenge, operation, args, &mut message) {
        Some(len) => maataa_capsule::verify_detached(&message[..len], signature, public_key),
        None => false,
    }
}

/// Checks a request against the current challenge. If it is valid the
/// sequence number moves on, so the same signature is refused next time.
pub fn accept(operation: u8, args: &[u8], signature: &[u8; 64], public_key: &[u8; 32]) -> bool {
    let Some(challenge) = challenge() else {
        return false;
    };
    if !signature_valid(&challenge, operation, args, signature, public_key) {
        return false;
    }
    SEQUENCE.fetch_add(1, Ordering::SeqCst);
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use maataa_capsule::{public_key, sign_detached, DEV_SEED};
    use maataa_link::host_auth::op;

    fn sign(challenge: &[u8; CHALLENGE_BYTES], operation: u8, args: &[u8]) -> [u8; 64] {
        let mut message = [0u8; MAX_MESSAGE];
        let len = host_auth::message(challenge, operation, args, &mut message).unwrap();
        sign_detached(&message[..len], &DEV_SEED)
    }

    #[test]
    fn a_signature_covers_the_challenge_operation_and_arguments() {
        let key = public_key(&DEV_SEED);
        let c = host_auth::challenge(b"qemu-netduin", 5, 0);
        let s = sign(&c, op::REMOVE, b"panini");
        assert!(signature_valid(&c, op::REMOVE, b"panini", &s, &key));
        // Another boot, another sequence, another board, another operation,
        // other arguments, another key: all refused.
        assert!(!signature_valid(
            &host_auth::challenge(b"qemu-netduin", 6, 0),
            op::REMOVE,
            b"panini",
            &s,
            &key
        ));
        assert!(!signature_valid(
            &host_auth::challenge(b"qemu-netduin", 5, 1),
            op::REMOVE,
            b"panini",
            &s,
            &key
        ));
        assert!(!signature_valid(
            &host_auth::challenge(b"another-chip", 5, 0),
            op::REMOVE,
            b"panini",
            &s,
            &key
        ));
        assert!(!signature_valid(&c, op::COMMIT, b"panini", &s, &key));
        assert!(!signature_valid(&c, op::REMOVE, b"greeter", &s, &key));
        assert!(!signature_valid(
            &c,
            op::REMOVE,
            b"panini",
            &s,
            &public_key(&[9; 32])
        ));
    }

    #[test]
    fn an_accepted_signature_works_once_and_needs_a_counted_boot() {
        let key = public_key(&DEV_SEED);
        BOOT_COUNT.store(UNKNOWN_BOOT, Ordering::SeqCst);
        assert_eq!(challenge(), None);
        let c0 = host_auth::challenge(b"qemu-netduin", 3, 0);
        assert!(!accept(
            op::STORE_PUT,
            &[21],
            &sign(&c0, op::STORE_PUT, &[21]),
            &key
        ));

        set_boot_count(3);
        SEQUENCE.store(0, Ordering::SeqCst);
        let c = challenge().unwrap();
        assert_eq!(c, c0);
        let s = sign(&c, op::STORE_PUT, &[21]);
        assert!(accept(op::STORE_PUT, &[21], &s, &key));
        assert!(!accept(op::STORE_PUT, &[21], &s, &key), "replayed");
        // A refused request does not move the sequence on.
        let c1 = challenge().unwrap();
        assert!(!accept(op::STORE_PUT, &[21], &[0; 64], &key));
        assert_eq!(challenge().unwrap(), c1);
    }
}
