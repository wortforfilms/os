pub const RADIO_HARDWARE_CHANNEL_LOCK: u8 = 0x7a;
pub const RADIO_STATE_BYTES: usize = 26;

#[repr(C, packed)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RadioAutomationState {
    pub current_track_hash: [u8; 16],
    pub current_slot_timestamp: u64,
    pub is_streaming: u8,
    pub hardware_channel_lock: u8,
}

impl RadioAutomationState {
    pub const fn new() -> Self {
        Self {
            current_track_hash: [0; 16],
            current_slot_timestamp: 0,
            is_streaming: 0,
            hardware_channel_lock: 0,
        }
    }

    pub fn trigger_next_slot(&mut self, next_track: [u8; 16], target_time: u64) {
        self.current_track_hash = next_track;
        self.current_slot_timestamp = target_time;
        self.is_streaming = 1;
        self.hardware_channel_lock = RADIO_HARDWARE_CHANNEL_LOCK;
    }

    pub fn stop(&mut self) {
        self.is_streaming = 0;
        self.hardware_channel_lock = 0;
    }

    pub fn serialize_into(&self, out: &mut [u8]) -> Result<(), RadioError> {
        if out.len() < RADIO_STATE_BYTES {
            clear(out);
            return Err(RadioError::BufferTooSmall);
        }

        out[0..16].copy_from_slice(&self.current_track_hash);
        out[16..24].copy_from_slice(&self.current_slot_timestamp.to_le_bytes());
        out[24] = self.is_streaming;
        out[25] = self.hardware_channel_lock;
        Ok(())
    }
}

impl Default for RadioAutomationState {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RadioError {
    BufferTooSmall,
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
    fn triggers_and_serializes_radio_slot() {
        let mut state = RadioAutomationState::new();
        state.trigger_next_slot([0x11; 16], 9001);

        let mut out = [0u8; RADIO_STATE_BYTES];
        assert_eq!(state.serialize_into(&mut out), Ok(()));
        assert_eq!(&out[0..16], &[0x11; 16]);
        assert_eq!(&out[16..24], &9001u64.to_le_bytes());
        assert_eq!(out[24], 1);
        assert_eq!(out[25], RADIO_HARDWARE_CHANNEL_LOCK);
    }
}
