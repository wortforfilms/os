use crate::boot_log;
use maataa_capsule::CapsuleError;

include!(concat!(env!("OUT_DIR"), "/capsule_key.rs"));

/// Why a signed capsule was not loaded.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LoadError {
    /// The image failed its layout or signature check.
    Rejected(CapsuleError),
    /// Valid, but the table or the memory budget is full.
    NoRoom(&'static str),
}

impl LoadError {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Rejected(error) => error.as_str(),
            Self::NoRoom(reason) => reason,
        }
    }
}

const MAX_CAPSULES: usize = 8;
const CAPSULE_MEMORY_BYTES: usize = 64 * 1024;

#[derive(Clone, Copy)]
pub struct CapsuleInfo {
    pub id: usize,
    pub name: &'static str,
    pub size_bytes: usize,
    pub cycles: u32,
    /// Syscalls a task bound to this capsule may make (signed, from the image).
    pub capabilities: u32,
}

pub struct CapsuleManager {
    capsules: [Option<CapsuleInfo>; MAX_CAPSULES],
    used_bytes: usize,
}

impl CapsuleManager {
    pub const fn new() -> Self {
        Self {
            capsules: [None; MAX_CAPSULES],
            used_bytes: 0,
        }
    }

    /// Verifies a signed MCAP image against the build's capsule key and, only
    /// if it passes, records the capsule with the capabilities it was signed
    /// with. The payload is accounted for but not executed yet.
    pub fn load_signed(&mut self, image: &'static [u8]) -> Result<usize, LoadError> {
        self.load_signed_with_key(image, &CAPSULE_PUBLIC_KEY)
    }

    pub fn load_signed_with_key(
        &mut self,
        image: &'static [u8],
        public_key: &[u8; 32],
    ) -> Result<usize, LoadError> {
        let capsule = maataa_capsule::verify(image, public_key).map_err(LoadError::Rejected)?;
        self.insert(capsule.name, capsule.payload.len(), capsule.capabilities)
            .map_err(LoadError::NoRoom)
    }

    /// Capabilities of the loaded capsule called `name`, if any.
    pub fn capabilities_of(&self, name: &str) -> Option<u32> {
        self.capsules
            .iter()
            .flatten()
            .find(|c| c.name == name)
            .map(|c| c.capabilities)
    }

    /// Unsigned load with no capabilities; kept for the table tests.
    #[cfg(test)]
    pub fn load(&mut self, name: &'static str, image: &[u8]) -> Result<usize, &'static str> {
        self.insert(name, image.len(), 0)
    }

    fn insert(
        &mut self,
        name: &'static str,
        size_bytes: usize,
        capabilities: u32,
    ) -> Result<usize, &'static str> {
        let next = self.count();
        if next >= MAX_CAPSULES {
            return Err("capsule table full");
        }

        if self.used_bytes + size_bytes > CAPSULE_MEMORY_BYTES {
            return Err("capsule memory exhausted");
        }

        let info = CapsuleInfo {
            id: next,
            name,
            size_bytes,
            cycles: 0,
            capabilities,
        };

        self.capsules[next] = Some(info);
        self.used_bytes += size_bytes;
        boot_log!("capsule loaded: {} ({} bytes)", name, size_bytes);
        Ok(next)
    }

    pub fn run_cycle(&mut self, tick: u32) {
        for slot in self.capsules.iter_mut() {
            if let Some(capsule) = slot.as_mut() {
                capsule.cycles += 1;
                boot_log!(
                    "  capsule[{}] {} cycle {} at tick {} ({} bytes)",
                    capsule.id,
                    capsule.name,
                    capsule.cycles,
                    tick,
                    capsule.size_bytes
                );
            }
        }
    }

    pub fn count(&self) -> usize {
        self.capsules.iter().filter(|slot| slot.is_some()).count()
    }

    pub const fn used_bytes(&self) -> usize {
        self.used_bytes
    }

    pub const fn capacity_bytes(&self) -> usize {
        CAPSULE_MEMORY_BYTES
    }

    #[cfg(test)]
    pub fn capsule(&self, id: usize) -> Option<&CapsuleInfo> {
        self.capsules.get(id).and_then(|slot| slot.as_ref())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_capsules_and_tracks_memory() {
        let mut manager = CapsuleManager::new();

        assert_eq!(manager.load("telemetry", &[1, 2, 3]), Ok(0));
        assert_eq!(manager.load("control", &[4, 5]), Ok(1));

        assert_eq!(manager.count(), 2);
        assert_eq!(manager.used_bytes(), 5);
        assert_eq!(manager.capacity_bytes(), 64 * 1024);
        assert_eq!(manager.capsule(0).unwrap().name, "telemetry");
        assert_eq!(manager.capsule(1).unwrap().size_bytes, 2);
    }

    #[test]
    fn rejects_capsules_when_table_is_full() {
        let mut manager = CapsuleManager::new();

        for id in 0..MAX_CAPSULES {
            assert_eq!(manager.load("slot", &[id as u8]), Ok(id));
        }

        assert_eq!(manager.load("extra", &[9]), Err("capsule table full"));
        assert_eq!(manager.count(), MAX_CAPSULES);
    }

    #[test]
    fn rejects_capsules_when_memory_budget_is_exceeded() {
        let mut manager = CapsuleManager::new();
        let oversized = [0u8; CAPSULE_MEMORY_BYTES + 1];

        assert_eq!(
            manager.load("oversized", &oversized),
            Err("capsule memory exhausted")
        );
        assert_eq!(manager.count(), 0);
        assert_eq!(manager.used_bytes(), 0);
    }

    #[test]
    fn signed_capsules_load_with_their_capabilities() {
        use maataa_capsule::cap;
        let mut manager = CapsuleManager::new();
        let hostlink = include_bytes!("../../assets/capsules/hostlink.mcap");
        let id = manager.load_signed(hostlink).unwrap();
        assert_eq!(manager.capsule(id).unwrap().name, "hostlink");
        assert_eq!(
            manager.capabilities_of("hostlink"),
            Some(
                cap::WRITE
                    | cap::SLEEP
                    | cap::UART_WRITE
                    | cap::UART_READ
                    | cap::HOST_STATUS
                    | cap::STORE_GET
                    | cap::STORE_PUT
            )
        );
        assert_eq!(manager.capabilities_of("missing"), None);
    }

    #[test]
    fn tampered_or_foreign_capsules_are_not_loaded() {
        let mut manager = CapsuleManager::new();
        let image = include_bytes!("../../assets/capsules/control.mcap");
        let tampered: &'static mut [u8] = Box::leak(image.to_vec().into_boxed_slice());
        tampered[40] ^= 0x01;
        assert_eq!(manager.load_signed(tampered), Err(LoadError::Rejected(CapsuleError::BadSignature)));
        assert_eq!(manager.load_signed_with_key(image, &[9u8; 32]), Err(LoadError::Rejected(CapsuleError::BadSignature)));
        assert_eq!(manager.count(), 0);
        assert_eq!(manager.used_bytes(), 0);
    }

    #[test]
    fn this_build_trusts_the_development_key_by_default() {
        if std::env::var("MAATAA_CAPSULE_PUBKEY").is_err() {
            assert!(CAPSULE_KEY_KIND.starts_with("development"));
            assert_eq!(CAPSULE_KEY_ID, &include_str!("../../keys/capsule-dev.pub")[..8]);
        }
    }

    #[test]
    fn scheduler_cycle_increments_loaded_capsules_only() {
        let mut manager = CapsuleManager::new();
        manager.load("telemetry", &[1]).unwrap();

        manager.run_cycle(1);
        manager.run_cycle(2);

        assert_eq!(manager.capsule(0).unwrap().cycles, 2);
        assert!(manager.capsule(1).is_none());
    }
}
