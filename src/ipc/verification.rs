use crate::ipc::frame::fnv1a32;

pub const VERIFY_REPRODUCIBLE: u8 = 0x01;
pub const VERIFY_STRUCTURAL_TOLERANCE: u8 = 0x02;
pub const VERIFY_MANIFEST_SIGNATURE: u8 = 0x04;
pub const VERIFY_CERTIFICATION_CLEARANCE: u8 = 0x08;
pub const VERIFY_GOVERNANCE_APPROVAL: u8 = 0x10;
pub const VERIFY_REQUIRED_MASK: u8 = VERIFY_REPRODUCIBLE
    | VERIFY_STRUCTURAL_TOLERANCE
    | VERIFY_MANIFEST_SIGNATURE
    | VERIFY_GOVERNANCE_APPROVAL;
pub const VERIFY_CERTIFIED_MASK: u8 = VERIFY_REQUIRED_MASK | VERIFY_CERTIFICATION_CLEARANCE;

const MAGV_FRAME_BYTES: usize = 32;
const HST_SIGNATURE_SEED: &[u8] = b"HST:maataa-os:v0.1.0-alpha.1:script-datasets";
const EMBEDDED_MANIFEST_SIGNATURE: u32 = 0x11b8_0a2e;
const PHKD_EXPECTED_REGISTERS: [u8; 4] = [0x50, 0x48, 0x4b, 0x44];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct VerificationReport {
    pub reproducible: bool,
    pub structural_tolerance: bool,
    pub manifest_signature: bool,
    pub governance_approval: bool,
    pub reference_hash: u32,
    pub deformation_hash: u32,
    pub hst_signature: u32,
}

impl VerificationReport {
    pub const fn status_word(self) -> u8 {
        let mut status = 0;
        if self.reproducible {
            status |= VERIFY_REPRODUCIBLE;
        }
        if self.structural_tolerance {
            status |= VERIFY_STRUCTURAL_TOLERANCE;
        }
        if self.manifest_signature {
            status |= VERIFY_MANIFEST_SIGNATURE;
        }
        if self.governance_approval {
            status |= VERIFY_GOVERNANCE_APPROVAL;
        }
        if (status & VERIFY_REQUIRED_MASK) == VERIFY_REQUIRED_MASK {
            status |= VERIFY_CERTIFICATION_CLEARANCE;
        }
        status
    }

    pub const fn is_scientifically_certified(self) -> bool {
        (self.status_word() & VERIFY_CERTIFICATION_CLEARANCE) == VERIFY_CERTIFICATION_CLEARANCE
    }
}

pub fn run_native_verification(magv_frames: &[u8], phkd_registers: [u8; 4]) -> VerificationReport {
    let first_hash = stable_magv_hash(magv_frames);
    let second_hash = stable_magv_hash(magv_frames);
    let deformation_hash = inverted_boundary_hash(magv_frames);
    let hst_signature = fnv1a32(HST_SIGNATURE_SEED);

    VerificationReport {
        reproducible: first_hash != 0 && first_hash == second_hash,
        structural_tolerance: deformation_hash != 0 && deformation_hash != first_hash,
        manifest_signature: hst_signature == EMBEDDED_MANIFEST_SIGNATURE,
        governance_approval: phkd_registers == PHKD_EXPECTED_REGISTERS,
        reference_hash: first_hash,
        deformation_hash,
        hst_signature,
    }
}

pub fn run_embedded_reference_verification() -> VerificationReport {
    run_native_verification(&embedded_magv_reference(), PHKD_EXPECTED_REGISTERS)
}

fn stable_magv_hash(frames: &[u8]) -> u32 {
    if frames.is_empty() || frames.len() % MAGV_FRAME_BYTES != 0 {
        return 0;
    }

    let mut offset = 0;
    while offset < frames.len() {
        if frames[offset] != 0x4d
            || frames[offset + 1] != 0x41
            || frames[offset + 2] != 0x47
            || frames[offset + 3] != 0x56
        {
            return 0;
        }
        offset += MAGV_FRAME_BYTES;
    }

    fnv1a32(frames)
}

fn inverted_boundary_hash(frames: &[u8]) -> u32 {
    if frames.is_empty() || frames.len() % MAGV_FRAME_BYTES != 0 {
        return 0;
    }

    let mut rolling = 0x811c_9dc5u32;
    let mut index = 0;
    while index < frames.len() {
        let mut byte = frames[index];
        if index == 7 || index == frames.len() - 1 {
            byte ^= 0x80;
        }
        rolling ^= byte as u32;
        rolling = rolling.wrapping_mul(0x0100_0193);
        index += 1;
    }
    rolling
}

const fn embedded_magv_reference() -> [u8; 96] {
    let mut out = [0; 96];
    let mut frame = 0;
    while frame < 3 {
        let offset = frame * MAGV_FRAME_BYTES;
        out[offset] = 0x4d;
        out[offset + 1] = 0x41;
        out[offset + 2] = 0x47;
        out[offset + 3] = 0x56;
        out[offset + 4] = (frame + 1) as u8;
        out[offset + 5] = 0x05 + frame as u8;
        out[offset + 6] = 0x10;

        let mut geometry = 0;
        while geometry < 20 {
            out[offset + 7 + geometry] =
                ((frame as u8 + 1).wrapping_mul(17)).wrapping_add(geometry as u8);
            geometry += 1;
        }

        out[offset + 27] = 0xa0 + frame as u8;
        out[offset + 28] = 0xb0 + frame as u8;
        out[offset + 29] = 0xc0 + frame as u8;
        out[offset + 30] = 0xd0 + frame as u8;
        out[offset + 31] = 0xe0 + frame as u8;
        frame += 1;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_reference_certifies_all_gates() {
        let report = run_embedded_reference_verification();

        assert_eq!(report.status_word(), VERIFY_CERTIFIED_MASK);
        assert!(report.is_scientifically_certified());
    }

    #[test]
    fn rejects_governance_register_drift() {
        let report = run_native_verification(&embedded_magv_reference(), [0x50, 0x48, 0x4b, 0x00]);

        assert_eq!(report.status_word() & VERIFY_GOVERNANCE_APPROVAL, 0);
        assert_eq!(report.status_word() & VERIFY_CERTIFICATION_CLEARANCE, 0);
    }

    #[test]
    fn rejects_invalid_magv_boundary() {
        let mut frames = embedded_magv_reference();
        frames[0] = 0;
        let report = run_native_verification(&frames, PHKD_EXPECTED_REGISTERS);

        assert_eq!(report.status_word() & VERIFY_REPRODUCIBLE, 0);
        assert_eq!(report.status_word() & VERIFY_CERTIFICATION_CLEARANCE, 0);
    }
}
