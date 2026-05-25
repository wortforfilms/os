use crate::boot_log;

const DRIVER_COUNT: usize = 5;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HealthState {
    Nominal,
    Degraded,
}

#[derive(Clone, Copy)]
struct DriverSlot {
    name: &'static str,
    ready: bool,
    polls: u32,
}

impl DriverSlot {
    const fn new(name: &'static str) -> Self {
        Self {
            name,
            ready: false,
            polls: 0,
        }
    }
}

pub struct DriverRegistry {
    slots: [DriverSlot; DRIVER_COUNT],
}

impl DriverRegistry {
    pub const fn new() -> Self {
        Self {
            slots: [
                DriverSlot::new("uart"),
                DriverSlot::new("gpio"),
                DriverSlot::new("spi"),
                DriverSlot::new("i2c"),
                DriverSlot::new("power"),
            ],
        }
    }

    pub fn init_all(&mut self) {
        boot_log!("initializing driver registry...");
        for slot in self.slots.iter_mut() {
            slot.ready = true;
            boot_log!("  driver {} ready", slot.name);
        }
    }

    pub fn poll(&mut self, tick: u32) {
        for slot in self.slots.iter_mut() {
            if slot.ready {
                slot.polls += 1;
            }
        }

        if tick == 3 {
            boot_log!("  drivers sampled virtual GPIO and power rails");
        }
    }

    pub fn ready_count(&self) -> usize {
        self.slots.iter().filter(|slot| slot.ready).count()
    }

    pub const fn total_count(&self) -> usize {
        DRIVER_COUNT
    }

    pub fn health(&self) -> HealthState {
        if self.ready_count() == self.total_count() {
            HealthState::Nominal
        } else {
            HealthState::Degraded
        }
    }

    #[cfg(test)]
    pub fn poll_count(&self, name: &str) -> Option<u32> {
        self.slots
            .iter()
            .find(|slot| slot.name == name)
            .map(|slot| slot.polls)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_degraded_until_drivers_are_initialized() {
        let registry = DriverRegistry::new();

        assert_eq!(registry.ready_count(), 0);
        assert_eq!(registry.total_count(), 5);
        assert_eq!(registry.health(), HealthState::Degraded);
    }

    #[test]
    fn init_marks_all_virtual_drivers_ready() {
        let mut registry = DriverRegistry::new();

        registry.init_all();

        assert_eq!(registry.ready_count(), registry.total_count());
        assert_eq!(registry.health(), HealthState::Nominal);
    }

    #[test]
    fn poll_increments_ready_driver_counters() {
        let mut registry = DriverRegistry::new();

        registry.poll(1);
        assert_eq!(registry.poll_count("uart"), Some(0));

        registry.init_all();
        registry.poll(2);
        registry.poll(3);

        assert_eq!(registry.poll_count("uart"), Some(2));
        assert_eq!(registry.poll_count("power"), Some(2));
        assert_eq!(registry.poll_count("missing"), None);
    }
}
