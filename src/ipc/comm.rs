use crate::ipc::frame::fnv1a32;

pub const COMM_FRAME_BYTES: usize = 44;
pub const COMM_SIGNED_BYTES: usize = 40;
pub const COMM_PAYLOAD_BYTES: usize = 24;

#[repr(C, packed)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SecludedCommFrame {
    pub sender_id: [u8; 8],
    pub timestamp: u64,
    pub data_payload: [u8; COMM_PAYLOAD_BYTES],
    pub checksum: u32,
}

impl SecludedCommFrame {
    pub fn new(sender: [u8; 8], timestamp: u64, message: &[u8; COMM_PAYLOAD_BYTES]) -> Self {
        let mut frame = Self {
            sender_id: sender,
            timestamp,
            data_payload: *message,
            checksum: 0,
        };
        frame.sign();
        frame
    }

    pub fn sign(&mut self) {
        self.checksum = fnv1a32(&self.bytes_without_checksum());
    }

    pub fn validate(&self) -> bool {
        self.checksum == fnv1a32(&self.bytes_without_checksum())
    }

    pub fn serialize_into(&self, out: &mut [u8]) -> Result<(), CommError> {
        if out.len() < COMM_FRAME_BYTES {
            clear(out);
            return Err(CommError::BufferTooSmall);
        }

        out[0..8].copy_from_slice(&self.sender_id);
        out[8..16].copy_from_slice(&self.timestamp.to_le_bytes());
        out[16..40].copy_from_slice(&self.data_payload);
        out[40..44].copy_from_slice(&self.checksum.to_le_bytes());
        Ok(())
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CommError> {
        if bytes.len() < COMM_FRAME_BYTES {
            return Err(CommError::BufferTooSmall);
        }

        let mut sender_id = [0; 8];
        sender_id.copy_from_slice(&bytes[0..8]);
        let timestamp = read_u64_le(&bytes[8..16]);
        let mut data_payload = [0; COMM_PAYLOAD_BYTES];
        data_payload.copy_from_slice(&bytes[16..40]);
        let checksum = read_u32_le(&bytes[40..44]);
        let frame = Self {
            sender_id,
            timestamp,
            data_payload,
            checksum,
        };

        if !frame.validate() {
            return Err(CommError::ChecksumMismatch);
        }

        Ok(frame)
    }

    fn bytes_without_checksum(&self) -> [u8; COMM_SIGNED_BYTES] {
        let mut out = [0; COMM_SIGNED_BYTES];
        out[0..8].copy_from_slice(&self.sender_id);
        out[8..16].copy_from_slice(&self.timestamp.to_le_bytes());
        out[16..40].copy_from_slice(&self.data_payload);
        out
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CommError {
    BufferTooSmall,
    ChecksumMismatch,
}

fn read_u32_le(bytes: &[u8]) -> u32 {
    (bytes[0] as u32)
        | ((bytes[1] as u32) << 8)
        | ((bytes[2] as u32) << 16)
        | ((bytes[3] as u32) << 24)
}

fn read_u64_le(bytes: &[u8]) -> u64 {
    (bytes[0] as u64)
        | ((bytes[1] as u64) << 8)
        | ((bytes[2] as u64) << 16)
        | ((bytes[3] as u64) << 24)
        | ((bytes[4] as u64) << 32)
        | ((bytes[5] as u64) << 40)
        | ((bytes[6] as u64) << 48)
        | ((bytes[7] as u64) << 56)
}

fn clear(out: &mut [u8]) {
    for byte in out.iter_mut() {
        *byte = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signs_and_round_trips_comm_frame() {
        let frame = SecludedCommFrame::new(*b"MSAR0001", 42, b"offline-local-message-01");
        let mut out = [0u8; COMM_FRAME_BYTES];

        assert_eq!(frame.serialize_into(&mut out), Ok(()));
        assert_eq!(SecludedCommFrame::from_bytes(&out), Ok(frame));
    }

    #[test]
    fn rejects_tampered_comm_frame() {
        let frame = SecludedCommFrame::new(*b"MSAR0001", 42, b"offline-local-message-01");
        let mut out = [0u8; COMM_FRAME_BYTES];
        frame.serialize_into(&mut out).unwrap();
        out[20] ^= 0x40;

        assert_eq!(SecludedCommFrame::from_bytes(&out), Err(CommError::ChecksumMismatch));
    }
}
