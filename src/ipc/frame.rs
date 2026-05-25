use crate::capsule::CapsuleManager;

pub const MOSF_FRAME_BYTES: usize = 40;
pub const MOSF_SIGNED_BYTES: usize = 36;
pub const MOSF_MAGIC: [u8; 4] = [0x4d, 0x4f, 0x53, 0x46];
pub const FNV1A32_OFFSET: u32 = 0x811c_9dc5;
pub const FNV1A32_PRIME: u32 = 0x0100_0193;
pub const MAX_ALLOCATED_MEMORY_BYTES: u64 = 128 * 1024;
pub const MAX_ACTIVE_TASKS: u32 = 64;
pub const MAX_HARDWARE_CORES: u16 = 64;

const RECOVERY_AI_STATUS: u32 = 0x8000_0001;
const KERNEL_TASK_COUNT: u32 = 1;
const DRIVER_POLL_TASK_COUNT: u32 = 1;

#[repr(C, packed)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct MosfTelemetryFrame {
    pub magic: [u8; 4],
    pub uptime_ticks: u32,
    pub allocated_memory_bytes: u64,
    pub active_tasks: u32,
    pub hardware_cores: u16,
    pub capsule_count: u16,
    pub ai_batch_status: u32,
    pub reserved: [u8; 8],
    pub checksum: u32,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SchedulerTelemetrySnapshot {
    pub uptime_ticks: u32,
    pub allocated_memory_bytes: u64,
    pub active_tasks: u32,
    pub hardware_cores: u16,
    pub capsule_count: u16,
    pub ai_batch_status: u32,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TelemetryError {
    BufferTooSmall,
    AllocatedMemoryOutOfBounds,
    ActiveTasksOutOfBounds,
    HardwareCoresOutOfBounds,
    CapsuleCountOutOfBounds,
    ChecksumMismatch,
    MagicMismatch,
}

impl SchedulerTelemetrySnapshot {
    pub fn from_scheduler(
        capsules: &CapsuleManager,
        uptime_ticks: u32,
        hardware_cores: u16,
        ai_batch_status: u32,
    ) -> Result<Self, TelemetryError> {
        let capsule_count = capsules.count();
        let active_tasks = KERNEL_TASK_COUNT
            .saturating_add(DRIVER_POLL_TASK_COUNT)
            .saturating_add(capsule_count as u32);

        Self::new(
            uptime_ticks,
            capsules.used_bytes() as u64,
            active_tasks,
            hardware_cores,
            capsule_count,
            ai_batch_status,
        )
    }

    pub const fn new(
        uptime_ticks: u32,
        allocated_memory_bytes: u64,
        active_tasks: u32,
        hardware_cores: u16,
        capsule_count: usize,
        ai_batch_status: u32,
    ) -> Result<Self, TelemetryError> {
        if allocated_memory_bytes > MAX_ALLOCATED_MEMORY_BYTES {
            return Err(TelemetryError::AllocatedMemoryOutOfBounds);
        }

        if active_tasks == 0 || active_tasks > MAX_ACTIVE_TASKS {
            return Err(TelemetryError::ActiveTasksOutOfBounds);
        }

        if hardware_cores == 0 || hardware_cores > MAX_HARDWARE_CORES {
            return Err(TelemetryError::HardwareCoresOutOfBounds);
        }

        if capsule_count > u16::MAX as usize {
            return Err(TelemetryError::CapsuleCountOutOfBounds);
        }

        Ok(Self {
            uptime_ticks,
            allocated_memory_bytes,
            active_tasks,
            hardware_cores,
            capsule_count: capsule_count as u16,
            ai_batch_status,
        })
    }
}

impl MosfTelemetryFrame {
    pub const fn recovery() -> Self {
        let mut frame = Self {
            magic: MOSF_MAGIC,
            uptime_ticks: 0,
            allocated_memory_bytes: 0,
            active_tasks: 1,
            hardware_cores: 1,
            capsule_count: 0,
            ai_batch_status: RECOVERY_AI_STATUS,
            reserved: [0; 8],
            checksum: 0,
        };
        frame.checksum = fnv1a32(&frame.bytes_without_checksum());
        frame
    }

    pub fn from_snapshot(snapshot: SchedulerTelemetrySnapshot) -> Self {
        let mut frame = Self {
            magic: MOSF_MAGIC,
            uptime_ticks: snapshot.uptime_ticks,
            allocated_memory_bytes: snapshot.allocated_memory_bytes,
            active_tasks: snapshot.active_tasks,
            hardware_cores: snapshot.hardware_cores,
            capsule_count: snapshot.capsule_count,
            ai_batch_status: snapshot.ai_batch_status,
            reserved: [0; 8],
            checksum: 0,
        };
        frame.checksum = fnv1a32(&frame.bytes_without_checksum());
        frame
    }

    #[allow(dead_code)]
    pub fn serialize(self) -> [u8; MOSF_FRAME_BYTES] {
        let mut out = [0; MOSF_FRAME_BYTES];
        self.write_unchecked(&mut out);
        out
    }

    pub fn serialize_into(self, out: &mut [u8]) -> Result<(), TelemetryError> {
        if out.len() < MOSF_FRAME_BYTES {
            clear_buffer(out);
            return Err(TelemetryError::BufferTooSmall);
        }

        self.write_unchecked(&mut out[..MOSF_FRAME_BYTES]);
        Ok(())
    }

    pub fn validate_bytes(bytes: &[u8]) -> Result<(), TelemetryError> {
        if bytes.len() < MOSF_FRAME_BYTES {
            return Err(TelemetryError::BufferTooSmall);
        }

        if bytes[0..4] != MOSF_MAGIC {
            return Err(TelemetryError::MagicMismatch);
        }

        let actual = read_u32_le(&bytes[36..40]);
        let expected = fnv1a32(&bytes[..MOSF_SIGNED_BYTES]);
        if actual != expected {
            return Err(TelemetryError::ChecksumMismatch);
        }

        Ok(())
    }

    const fn bytes_without_checksum(&self) -> [u8; MOSF_SIGNED_BYTES] {
        let mut out = [0; MOSF_SIGNED_BYTES];
        out[0] = self.magic[0];
        out[1] = self.magic[1];
        out[2] = self.magic[2];
        out[3] = self.magic[3];
        put_u32_le_const(&mut out, 4, self.uptime_ticks);
        put_u64_le_const(&mut out, 8, self.allocated_memory_bytes);
        put_u32_le_const(&mut out, 16, self.active_tasks);
        put_u16_le_const(&mut out, 20, self.hardware_cores);
        put_u16_le_const(&mut out, 22, self.capsule_count);
        put_u32_le_const(&mut out, 24, self.ai_batch_status);
        out[28] = self.reserved[0];
        out[29] = self.reserved[1];
        out[30] = self.reserved[2];
        out[31] = self.reserved[3];
        out[32] = self.reserved[4];
        out[33] = self.reserved[5];
        out[34] = self.reserved[6];
        out[35] = self.reserved[7];
        out
    }

    fn write_unchecked(self, out: &mut [u8]) {
        out[..MOSF_SIGNED_BYTES].copy_from_slice(&self.bytes_without_checksum());
        put_u32_le(out, 36, self.checksum);
    }
}

pub fn write_frame_or_recovery(
    snapshot: Result<SchedulerTelemetrySnapshot, TelemetryError>,
    out: &mut [u8],
) -> Result<(), TelemetryError> {
    match snapshot {
        Ok(snapshot) => {
            let frame = MosfTelemetryFrame::from_snapshot(snapshot);
            frame.serialize_into(out)
        }
        Err(error) => {
            write_recovery_frame(out);
            Err(error)
        }
    }
}

pub fn write_recovery_frame(out: &mut [u8]) {
    clear_buffer(out);

    if out.len() >= MOSF_FRAME_BYTES {
        MosfTelemetryFrame::recovery().write_unchecked(&mut out[..MOSF_FRAME_BYTES]);
    }
}

#[inline(always)]
pub const fn fnv1a32(bytes: &[u8]) -> u32 {
    let mut hash = FNV1A32_OFFSET;
    let mut index = 0;

    while index < bytes.len() {
        hash ^= bytes[index] as u32;
        hash = hash.wrapping_mul(FNV1A32_PRIME);
        index += 1;
    }

    hash
}

#[inline(always)]
fn clear_buffer(out: &mut [u8]) {
    for byte in out.iter_mut() {
        *byte = 0;
    }
}

#[inline(always)]
const fn put_u16_le_const(out: &mut [u8], offset: usize, value: u16) {
    out[offset] = value as u8;
    out[offset + 1] = (value >> 8) as u8;
}

#[inline(always)]
const fn put_u32_le_const(out: &mut [u8], offset: usize, value: u32) {
    out[offset] = value as u8;
    out[offset + 1] = (value >> 8) as u8;
    out[offset + 2] = (value >> 16) as u8;
    out[offset + 3] = (value >> 24) as u8;
}

#[inline(always)]
const fn put_u64_le_const(out: &mut [u8], offset: usize, value: u64) {
    out[offset] = value as u8;
    out[offset + 1] = (value >> 8) as u8;
    out[offset + 2] = (value >> 16) as u8;
    out[offset + 3] = (value >> 24) as u8;
    out[offset + 4] = (value >> 32) as u8;
    out[offset + 5] = (value >> 40) as u8;
    out[offset + 6] = (value >> 48) as u8;
    out[offset + 7] = (value >> 56) as u8;
}

#[inline(always)]
fn put_u32_le(out: &mut [u8], offset: usize, value: u32) {
    out[offset] = value as u8;
    out[offset + 1] = (value >> 8) as u8;
    out[offset + 2] = (value >> 16) as u8;
    out[offset + 3] = (value >> 24) as u8;
}

#[inline(always)]
fn read_u32_le(bytes: &[u8]) -> u32 {
    (bytes[0] as u32)
        | ((bytes[1] as u32) << 8)
        | ((bytes[2] as u32) << 16)
        | ((bytes[3] as u32) << 24)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_exact_mosf_layout() {
        let snapshot = SchedulerTelemetrySnapshot::new(6, 274, 4, 2, 2, 0x21).unwrap();
        let frame = MosfTelemetryFrame::from_snapshot(snapshot);
        let bytes = frame.serialize();

        assert_eq!(bytes.len(), MOSF_FRAME_BYTES);
        assert_eq!(&bytes[0..4], &MOSF_MAGIC);
        assert_eq!(&bytes[4..8], &6u32.to_le_bytes());
        assert_eq!(&bytes[8..16], &274u64.to_le_bytes());
        assert_eq!(&bytes[16..20], &4u32.to_le_bytes());
        assert_eq!(&bytes[20..22], &2u16.to_le_bytes());
        assert_eq!(&bytes[22..24], &2u16.to_le_bytes());
        assert_eq!(&bytes[24..28], &0x21u32.to_le_bytes());
        assert_eq!(&bytes[28..36], &[0; 8]);
        assert_eq!(read_u32_le(&bytes[36..40]), fnv1a32(&bytes[..36]));
        assert_eq!(MosfTelemetryFrame::validate_bytes(&bytes), Ok(()));
    }

    #[test]
    fn rejects_bad_checksum() {
        let snapshot = SchedulerTelemetrySnapshot::new(1, 1, 2, 1, 0, 0).unwrap();
        let frame = MosfTelemetryFrame::from_snapshot(snapshot);
        let mut bytes = frame.serialize();

        bytes[8] ^= 0x80;

        assert_eq!(
            MosfTelemetryFrame::validate_bytes(&bytes),
            Err(TelemetryError::ChecksumMismatch)
        );
    }

    #[test]
    fn writes_recovery_frame_when_snapshot_is_invalid() {
        let mut out = [0xaa; MOSF_FRAME_BYTES];
        let result = write_frame_or_recovery(
            SchedulerTelemetrySnapshot::new(1, MAX_ALLOCATED_MEMORY_BYTES + 1, 1, 1, 0, 0),
            &mut out,
        );

        assert_eq!(result, Err(TelemetryError::AllocatedMemoryOutOfBounds));
        assert_eq!(&out[0..4], &MOSF_MAGIC);
        assert_eq!(&out[24..28], &RECOVERY_AI_STATUS.to_le_bytes());
        assert_eq!(MosfTelemetryFrame::validate_bytes(&out), Ok(()));
    }

    #[test]
    fn clears_small_buffer_on_failure() {
        let snapshot = SchedulerTelemetrySnapshot::new(1, 1, 1, 1, 0, 0).unwrap();
        let mut out = [0xff; 8];
        let frame = MosfTelemetryFrame::from_snapshot(snapshot);

        assert_eq!(
            frame.serialize_into(&mut out),
            Err(TelemetryError::BufferTooSmall)
        );
        assert_eq!(out, [0; 8]);
    }
}
