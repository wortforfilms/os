use crate::capsule::CapsuleManager;

pub const MOSF_FRAME_BYTES: usize = 40;
pub const MOSF_SIGNED_BYTES: usize = 36;
pub const MOSF_MAGIC: [u8; 4] = [0x4d, 0x4f, 0x53, 0x46];
pub const MOSR_FRAME_BYTES: usize = 16;
pub const MOSR_SIGNED_BYTES: usize = 12;
pub const MOSR_MAGIC: [u8; 4] = [0x4d, 0x4f, 0x53, 0x52];
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
    pub verification_status: u8,
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

#[repr(u32)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RescueFaultCode {
    VfsCorruption = 0x01,
    ChecksumMismatch = 0x02,
    PeripheralDriverTimeout = 0x03,
    BufferConstraintViolation = 0x04,
    MemoryConstraintViolation = 0x05,
}

#[repr(C, packed)]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct MosrRescueFrame {
    pub magic: [u8; 4],
    pub fault_code: u32,
    pub last_valid_uptime: u32,
    pub crc32: u32,
}

impl TelemetryError {
    pub const fn rescue_fault_code(self) -> RescueFaultCode {
        match self {
            Self::BufferTooSmall => RescueFaultCode::BufferConstraintViolation,
            Self::AllocatedMemoryOutOfBounds => RescueFaultCode::MemoryConstraintViolation,
            Self::ActiveTasksOutOfBounds
            | Self::HardwareCoresOutOfBounds
            | Self::CapsuleCountOutOfBounds => RescueFaultCode::PeripheralDriverTimeout,
            Self::ChecksumMismatch => RescueFaultCode::ChecksumMismatch,
            Self::MagicMismatch => RescueFaultCode::VfsCorruption,
        }
    }
}

impl SchedulerTelemetrySnapshot {
    #[allow(dead_code)]
    pub fn from_scheduler(
        capsules: &CapsuleManager,
        uptime_ticks: u32,
        hardware_cores: u16,
        ai_batch_status: u32,
    ) -> Result<Self, TelemetryError> {
        Self::from_scheduler_with_verification(
            capsules,
            uptime_ticks,
            hardware_cores,
            ai_batch_status,
            0,
        )
    }

    pub fn from_scheduler_with_verification(
        capsules: &CapsuleManager,
        uptime_ticks: u32,
        hardware_cores: u16,
        ai_batch_status: u32,
        verification_status: u8,
    ) -> Result<Self, TelemetryError> {
        let capsule_count = capsules.count();
        let active_tasks = KERNEL_TASK_COUNT
            .saturating_add(DRIVER_POLL_TASK_COUNT)
            .saturating_add(capsule_count as u32);

        Self::new_with_verification(
            uptime_ticks,
            capsules.used_bytes() as u64,
            active_tasks,
            hardware_cores,
            capsule_count,
            ai_batch_status,
            verification_status,
        )
    }

    #[allow(dead_code)]
    pub const fn new(
        uptime_ticks: u32,
        allocated_memory_bytes: u64,
        active_tasks: u32,
        hardware_cores: u16,
        capsule_count: usize,
        ai_batch_status: u32,
    ) -> Result<Self, TelemetryError> {
        Self::new_with_verification(
            uptime_ticks,
            allocated_memory_bytes,
            active_tasks,
            hardware_cores,
            capsule_count,
            ai_batch_status,
            0,
        )
    }

    pub const fn new_with_verification(
        uptime_ticks: u32,
        allocated_memory_bytes: u64,
        active_tasks: u32,
        hardware_cores: u16,
        capsule_count: usize,
        ai_batch_status: u32,
        verification_status: u8,
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
            verification_status,
        })
    }
}

impl MosrRescueFrame {
    pub fn new(fault_code: RescueFaultCode, last_valid_uptime: u32) -> Self {
        let mut frame = Self {
            magic: MOSR_MAGIC,
            fault_code: fault_code as u32,
            last_valid_uptime,
            crc32: 0,
        };
        frame.crc32 = crc32(&frame.bytes_without_crc());
        frame
    }

    #[allow(dead_code)]
    pub fn serialize(self) -> [u8; MOSR_FRAME_BYTES] {
        let mut out = [0; MOSR_FRAME_BYTES];
        self.write_unchecked(&mut out);
        out
    }

    pub fn serialize_into(self, out: &mut [u8]) -> Result<(), TelemetryError> {
        if out.len() < MOSR_FRAME_BYTES {
            clear_buffer(out);
            return Err(TelemetryError::BufferTooSmall);
        }

        self.write_unchecked(&mut out[..MOSR_FRAME_BYTES]);
        Ok(())
    }

    pub fn validate_bytes(bytes: &[u8]) -> Result<(), TelemetryError> {
        if bytes.len() < MOSR_FRAME_BYTES {
            return Err(TelemetryError::BufferTooSmall);
        }

        if bytes[0..4] != MOSR_MAGIC {
            return Err(TelemetryError::MagicMismatch);
        }

        let actual = read_u32_le(&bytes[12..16]);
        let expected = crc32(&bytes[..MOSR_SIGNED_BYTES]);
        if actual != expected {
            return Err(TelemetryError::ChecksumMismatch);
        }

        Ok(())
    }

    const fn bytes_without_crc(&self) -> [u8; MOSR_SIGNED_BYTES] {
        let mut out = [0; MOSR_SIGNED_BYTES];
        out[0] = self.magic[0];
        out[1] = self.magic[1];
        out[2] = self.magic[2];
        out[3] = self.magic[3];
        put_u32_le_const(&mut out, 4, self.fault_code);
        put_u32_le_const(&mut out, 8, self.last_valid_uptime);
        out
    }

    fn write_unchecked(self, out: &mut [u8]) {
        out[..MOSR_SIGNED_BYTES].copy_from_slice(&self.bytes_without_crc());
        put_u32_le(out, 12, self.crc32);
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
            reserved: [0, 0, snapshot.verification_status, 0, 0, 0, 0, 0],
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

pub fn write_rescue_frame(error: TelemetryError, last_valid_uptime: u32, out: &mut [u8]) {
    clear_buffer(out);

    let _ = MosrRescueFrame::new(error.rescue_fault_code(), last_valid_uptime).serialize_into(out);
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
pub const fn crc32(bytes: &[u8]) -> u32 {
    let mut crc = 0xffff_ffff;
    let mut index = 0;

    while index < bytes.len() {
        crc ^= bytes[index] as u32;
        let mut bit = 0;
        while bit < 8 {
            let mask = 0u32.wrapping_sub(crc & 1);
            crc = (crc >> 1) ^ (0xedb8_8320 & mask);
            bit += 1;
        }
        index += 1;
    }

    !crc
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

    #[test]
    fn serializes_exact_mosr_layout() {
        let frame = MosrRescueFrame::new(RescueFaultCode::ChecksumMismatch, 42);
        let bytes = frame.serialize();

        assert_eq!(bytes.len(), MOSR_FRAME_BYTES);
        assert_eq!(&bytes[0..4], &MOSR_MAGIC);
        assert_eq!(
            &bytes[4..8],
            &(RescueFaultCode::ChecksumMismatch as u32).to_le_bytes()
        );
        assert_eq!(&bytes[8..12], &42u32.to_le_bytes());
        assert_eq!(read_u32_le(&bytes[12..16]), crc32(&bytes[..12]));
        assert_eq!(MosrRescueFrame::validate_bytes(&bytes), Ok(()));
    }

    #[test]
    fn writes_mosr_rescue_frame() {
        let mut out = [0xaa; MOSR_FRAME_BYTES];
        write_rescue_frame(TelemetryError::ChecksumMismatch, 9, &mut out);

        assert_eq!(&out[0..4], &MOSR_MAGIC);
        assert_eq!(
            &out[4..8],
            &(RescueFaultCode::ChecksumMismatch as u32).to_le_bytes()
        );
        assert_eq!(&out[8..12], &9u32.to_le_bytes());
        assert_eq!(MosrRescueFrame::validate_bytes(&out), Ok(()));
    }
}
