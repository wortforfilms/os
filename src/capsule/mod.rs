use crate::boot_log;

const MAX_CAPSULES: usize = 4;
const CAPSULE_MEMORY_BYTES: usize = 64 * 1024;

#[derive(Clone, Copy)]
pub struct CapsuleInfo {
    pub id: usize,
    pub name: &'static str,
    pub size_bytes: usize,
    pub cycles: u32,
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

    pub fn load(&mut self, name: &'static str, image: &[u8]) -> Result<usize, &'static str> {
        let next = self.count();
        if next >= MAX_CAPSULES {
            return Err("capsule table full");
        }

        if self.used_bytes + image.len() > CAPSULE_MEMORY_BYTES {
            return Err("capsule memory exhausted");
        }

        let info = CapsuleInfo {
            id: next,
            name,
            size_bytes: image.len(),
            cycles: 0,
        };

        self.capsules[next] = Some(info);
        self.used_bytes += image.len();
        boot_log!("capsule loaded: {} ({} bytes)", name, image.len());
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
    fn scheduler_cycle_increments_loaded_capsules_only() {
        let mut manager = CapsuleManager::new();
        manager.load("telemetry", &[1]).unwrap();

        manager.run_cycle(1);
        manager.run_cycle(2);

        assert_eq!(manager.capsule(0).unwrap().cycles, 2);
        assert!(manager.capsule(1).is_none());
    }
}
