//! The capsule installed at run time, over the host channel
//! (docs/capsules.md, "Installing a capsule at run time").
//!
//! The image lives in the run-time capsule area (F411 flash sector 5, or a
//! host file in QEMU), managed by `maataa_store::area`. The kernel accepts an
//! image only if:
//!
//! - its signature verifies against the build's capsule key;
//! - its name is not one of the built-in capsules';
//! - its payload is a WebAssembly module the interpreter loads, with only
//!   known imports and a valid `maataa` manifest section;
//! - its manifest version is not lower than the last version installed under
//!   the same name (the version floors in kernel key 2).
//!
//! An accepted image runs from the next boot on, as task 9, with the
//! capabilities it was signed with.

use maataa_capsule::{CapsuleError, Schedule};

pub use maataa_store::area::MAX_IMAGE;

/// Names the built-in capsules use; an installed capsule may not take one.
pub const BUILT_IN_NAMES: [&str; 4] = ["telemetry", "heartbeat", "control", "hostlink"];

/// Why an image was not accepted.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Refusal {
    Image(CapsuleError),
    BuiltInName,
    NotWasm,
    Module(&'static str),
    Manifest(&'static str),
    /// Older than the version last installed under this name.
    Older {
        installed: u32,
    },
}

impl Refusal {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Image(error) => error.as_str(),
            Self::BuiltInName => "the name of a built-in capsule",
            Self::NotWasm => "payload is not WebAssembly",
            Self::Module(why) | Self::Manifest(why) => why,
            Self::Older { .. } => "older than the version already installed",
        }
    }
}

/// What the kernel knows about an accepted image.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Accepted<'a> {
    pub name: &'a str,
    pub capabilities: u32,
    pub schedule: Schedule,
}

/// The lowest version each of the last few installed names may come back
/// with. Kept in kernel key 2: up to [`VersionFloors::SLOTS`] entries of
/// `name length u8 | name, padded to 16 | version u32`.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct VersionFloors {
    entries: [Option<([u8; 16], u8, u32)>; Self::SLOTS],
}

impl VersionFloors {
    pub const SLOTS: usize = 3;
    const ENTRY: usize = 21;
    pub const BYTES: usize = Self::SLOTS * Self::ENTRY;

    pub fn decode(bytes: &[u8]) -> Self {
        let mut floors = Self::default();
        for (slot, chunk) in floors.entries.iter_mut().zip(bytes.chunks(Self::ENTRY)) {
            if chunk.len() != Self::ENTRY || chunk[0] == 0 || chunk[0] > 16 {
                continue;
            }
            let mut name = [0u8; 16];
            name.copy_from_slice(&chunk[1..17]);
            let version = u32::from_le_bytes([chunk[17], chunk[18], chunk[19], chunk[20]]);
            *slot = Some((name, chunk[0], version));
        }
        floors
    }

    pub fn encode(&self) -> [u8; Self::BYTES] {
        let mut out = [0u8; Self::BYTES];
        for (entry, chunk) in self.entries.iter().zip(out.chunks_mut(Self::ENTRY)) {
            if let Some((name, len, version)) = entry {
                chunk[0] = *len;
                chunk[1..17].copy_from_slice(name);
                chunk[17..21].copy_from_slice(&version.to_le_bytes());
            }
        }
        out
    }

    /// The floor for `name`, if it is one of the remembered names.
    pub fn floor(&self, name: &str) -> Option<u32> {
        self.entries.iter().flatten().find_map(|(n, len, version)| {
            (&n[..*len as usize] == name.as_bytes()).then_some(*version)
        })
    }

    /// Records that `name` was installed at `version`: it moves to the
    /// front, and the oldest remembered name drops off when all slots are
    /// taken.
    pub fn record(&mut self, name: &str, version: u32) {
        let bytes = name.as_bytes();
        if bytes.is_empty() || bytes.len() > 16 {
            return;
        }
        let mut entry = ([0u8; 16], bytes.len() as u8, version);
        entry.0[..bytes.len()].copy_from_slice(bytes);
        let mut kept = [None; Self::SLOTS];
        kept[0] = Some(entry);
        let mut next = 1;
        for old in self.entries.iter().flatten() {
            if &old.0[..old.1 as usize] != bytes && next < Self::SLOTS {
                kept[next] = Some(*old);
                next += 1;
            }
        }
        self.entries = kept;
    }
}

/// Checks an image for installing (or, at boot, for running).
pub fn check<'a>(
    image: &'a [u8],
    public_key: &[u8; 32],
    floors: &VersionFloors,
) -> Result<Accepted<'a>, Refusal> {
    let capsule = maataa_capsule::verify(image, public_key).map_err(Refusal::Image)?;
    if BUILT_IN_NAMES.contains(&capsule.name) {
        return Err(Refusal::BuiltInName);
    }
    if !maataa_capsule::is_wasm(capsule.payload) {
        return Err(Refusal::NotWasm);
    }
    let module =
        maataa_wasm::Module::parse(capsule.payload).map_err(|e| Refusal::Module(e.as_str()))?;
    crate::capsule_task::check_imports(module.imports()).map_err(Refusal::Module)?;
    let schedule = Schedule::parse(module.manifest()).map_err(Refusal::Manifest)?;
    if let Some(installed) = floors.floor(capsule.name) {
        if schedule.version < installed {
            return Err(Refusal::Older { installed });
        }
    }
    Ok(Accepted {
        name: capsule.name,
        capabilities: capsule.capabilities,
        schedule,
    })
}

/// INFO reply layout: `version u32 | capabilities u32 | image length u32 |
/// name length u8 | name`.
pub fn encode_info(accepted: &Accepted<'_>, len: usize, out: &mut [u8]) -> usize {
    let name = accepted.name.as_bytes();
    let total = 13 + name.len();
    if out.len() < total {
        return 0;
    }
    out[0..4].copy_from_slice(&accepted.schedule.version.to_le_bytes());
    out[4..8].copy_from_slice(&accepted.capabilities.to_le_bytes());
    out[8..12].copy_from_slice(&(len as u32).to_le_bytes());
    out[12] = name.len() as u8;
    out[13..total].copy_from_slice(name);
    total
}

#[cfg(target_arch = "arm")]
pub use kernel_side::*;

#[cfg(target_arch = "arm")]
mod kernel_side {
    use super::*;
    use crate::capsule::CAPSULE_PUBLIC_KEY;
    use crate::logging::kprintln;
    use crate::storage::persist::{self, backend::Backend};
    use crate::syscall::{E_FULL, E_NOENT, E_NOT_SUPPORTED, E_PERM, E_TOOLONG};
    use core::cell::RefCell;
    use cortex_m::interrupt::{self, Mutex};
    use maataa_store::area::InstallArea;

    static AREA: Mutex<RefCell<Option<InstallArea<Backend>>>> = Mutex::new(RefCell::new(None));
    /// Room for one image: for compaction, and to check an image before it
    /// is committed or handed to its task. Used only inside `interrupt::free`.
    static mut SCRATCH: [u8; MAX_IMAGE] = [0; MAX_IMAGE];
    /// The name of the capsule granted at boot, for the boot report and the
    /// capsule table, which keep `&'static str` names.
    static mut BOOT_NAME: [u8; 16] = [0; 16];

    fn floors() -> VersionFloors {
        let mut value = [0u8; persist::MAX_VALUE];
        match persist::get(persist::KEY_CAPSULE_FLOORS, &mut value) {
            Some(Ok(Some(n))) => VersionFloors::decode(&value[..n]),
            _ => VersionFloors::default(),
        }
    }

    /// Runs `f` with the area and the scratch buffer, or returns `E_NOT_SUPPORTED`.
    fn with<R>(f: impl FnOnce(&mut InstallArea<Backend>, &mut [u8; MAX_IMAGE]) -> R) -> Option<R> {
        interrupt::free(|cs| {
            let mut area = AREA.borrow(cs).borrow_mut();
            let area = area.as_mut()?;
            // SAFETY: only used here, with interrupts off, so never shared.
            let scratch = unsafe { &mut *core::ptr::addr_of_mut!(SCRATCH) };
            Some(f(area, scratch))
        })
    }

    /// What the boot found in the area.
    pub enum Boot {
        Empty,
        Accepted {
            name: &'static str,
            capabilities: u32,
            schedule: Schedule,
        },
        Refused(Refusal),
        Unavailable,
    }

    /// Mounts the area (once, at boot) and checks the installed image.
    pub fn mount() -> Boot {
        let area = match Backend::open_capsule_area().map_err(maataa_store::StoreError::from) {
            Ok(backend) => InstallArea::mount(backend),
            Err(e) => Err(e),
        };
        match area {
            Ok(area) => interrupt::free(|cs| *AREA.borrow(cs).borrow_mut() = Some(area)),
            Err(_) => return Boot::Unavailable,
        }
        let floors = floors();
        with(|area, scratch| match area.read_installed(scratch) {
            Ok(None) => Boot::Empty,
            Err(_) => Boot::Unavailable,
            Ok(Some(len)) => match check(&scratch[..len], &CAPSULE_PUBLIC_KEY, &floors) {
                Ok(accepted) => {
                    let bytes = accepted.name.as_bytes();
                    // SAFETY: written once here, before the scheduler starts.
                    let name = unsafe {
                        let buf = &mut *core::ptr::addr_of_mut!(BOOT_NAME);
                        buf[..bytes.len()].copy_from_slice(bytes);
                        core::str::from_utf8_unchecked(&buf[..bytes.len()])
                    };
                    Boot::Accepted {
                        name,
                        capabilities: accepted.capabilities,
                        schedule: accepted.schedule,
                    }
                }
                Err(refusal) => Boot::Refused(refusal),
            },
        })
        .unwrap_or(Boot::Unavailable)
    }

    fn store_error(e: maataa_store::StoreError) -> u32 {
        match e {
            maataa_store::StoreError::TooLong => E_TOOLONG,
            maataa_store::StoreError::Full => E_FULL,
            maataa_store::StoreError::BadKey => E_PERM,
            _ => E_NOT_SUPPORTED,
        }
    }

    /// Starts an install: reserves room for an image of `len` bytes.
    pub fn begin(len: usize) -> u32 {
        with(|area, scratch| area.begin(len, scratch).map_or_else(store_error, |()| 0))
            .unwrap_or(E_NOT_SUPPORTED)
    }

    /// Writes part of the image being installed.
    pub fn write(offset: usize, data: &[u8]) -> u32 {
        with(|area, _| area.write(offset, data).map_or_else(store_error, |()| 0))
            .unwrap_or(E_NOT_SUPPORTED)
    }

    /// Checks the image being installed and, if it passes, makes it the
    /// installed one. `image_signature` comes from a signed host request
    /// (src/hostauth.rs): the pending image must end in exactly that
    /// signature. A refused image is dropped; the installed one stays.
    pub fn commit(image_signature: &[u8]) -> u32 {
        let mut floors = floors();
        let result = with(|area, scratch| {
            let len = match area.read_pending(scratch) {
                Ok(len) => len,
                Err(e) => return Err(store_error(e)),
            };
            let pending = maataa_capsule::image_signature(&scratch[..len]);
            if pending.as_ref().map(|s| &s[..]) != Some(image_signature) {
                let _ = area.abandon();
                kprintln!("capsule install: refused: the signed request names another image");
                return Err(E_PERM);
            }
            match check(&scratch[..len], &CAPSULE_PUBLIC_KEY, &floors) {
                Ok(accepted) => {
                    area.commit().map_err(store_error)?;
                    floors.record(accepted.name, accepted.schedule.version);
                    kprintln!(
                        "capsule install: {} version {} accepted; it runs from the next boot",
                        accepted.name,
                        accepted.schedule.version
                    );
                    Ok(())
                }
                Err(refusal) => {
                    let _ = area.abandon();
                    match refusal {
                        Refusal::Older { installed } => kprintln!(
                            "capsule install: refused: older than version {} already installed",
                            installed
                        ),
                        _ => kprintln!("capsule install: refused: {}", refusal.as_str()),
                    }
                    Err(E_PERM)
                }
            }
        })
        .unwrap_or(Err(E_NOT_SUPPORTED));
        match result {
            Ok(()) => {
                // The image is installed; the floor is only a guard, so a
                // failure to save it is reported but does not undo that.
                if let Some(Err(e)) = persist::put(persist::KEY_CAPSULE_FLOORS, &floors.encode()) {
                    kprintln!("capsule install: version floor not saved: {}", e.as_str());
                }
                0
            }
            Err(code) => code,
        }
    }

    /// Removes the installed capsule (from the next boot on), if its name
    /// is `name` (from a signed host request).
    pub fn remove(name: &[u8]) -> u32 {
        with(|area, scratch| {
            match area.read_installed(scratch) {
                Ok(None) => return E_NOENT,
                Err(e) => return store_error(e),
                Ok(Some(len)) => {
                    if maataa_capsule::name_unverified(&scratch[..len]).map(str::as_bytes)
                        != Some(name)
                    {
                        kprintln!(
                            "capsule remove: refused: the signed request names another capsule"
                        );
                        return E_PERM;
                    }
                }
            }
            match area.remove() {
                Ok(true) => 0,
                Ok(false) => E_NOENT,
                Err(e) => store_error(e),
            }
        })
        .unwrap_or(E_NOT_SUPPORTED)
    }

    /// Describes the installed capsule into `out`; returns the length.
    pub fn info(out: &mut [u8]) -> u32 {
        // The floor does not apply here: this describes what is in flash.
        let floors = VersionFloors::default();
        with(|area, scratch| match area.read_installed(scratch) {
            Ok(None) => E_NOENT,
            Err(e) => store_error(e),
            Ok(Some(len)) => match check(&scratch[..len], &CAPSULE_PUBLIC_KEY, &floors) {
                Ok(accepted) => encode_info(&accepted, len, out) as u32,
                Err(_) => E_PERM,
            },
        })
        .unwrap_or(E_NOT_SUPPORTED)
    }

    /// Copies the installed image into `out` (the task that runs it) after
    /// checking it again; returns its length.
    pub fn read_image(out: &mut [u8]) -> u32 {
        let floors = floors();
        with(|area, scratch| match area.read_installed(scratch) {
            Ok(None) => E_NOENT,
            Err(e) => store_error(e),
            Ok(Some(len)) if len > out.len() => E_TOOLONG,
            Ok(Some(len)) => match check(&scratch[..len], &CAPSULE_PUBLIC_KEY, &floors) {
                Ok(_) => {
                    out[..len].copy_from_slice(&scratch[..len]);
                    len as u32
                }
                Err(_) => E_PERM,
            },
        })
        .unwrap_or(E_NOT_SUPPORTED)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use maataa_capsule::{cap, sign, DEV_SEED};

    const DEV_PUBLIC: fn() -> [u8; 32] = || maataa_capsule::public_key(&DEV_SEED);

    fn wasm(manifest: &str) -> Vec<u8> {
        // (module (@custom "maataa" manifest) (func (export "tick")))
        let mut m = b"\0asm\x01\0\0\0".to_vec();
        let mut custom = vec![6u8];
        custom.extend_from_slice(b"maataa");
        custom.extend_from_slice(manifest.as_bytes());
        m.push(0);
        m.push(custom.len() as u8);
        m.extend_from_slice(&custom);
        m.extend_from_slice(&[1, 4, 1, 0x60, 0, 0]); // type () -> ()
        m.extend_from_slice(&[3, 2, 1, 0]); // one function of type 0
        m.extend_from_slice(&[7, 8, 1, 4, b't', b'i', b'c', b'k', 0, 0]); // export "tick"
        m.extend_from_slice(&[10, 4, 1, 2, 0, 0x0B]); // body: end
        m
    }

    fn image(name: &str, manifest: &str) -> Vec<u8> {
        sign(name, cap::WRITE | cap::SLEEP, &wasm(manifest), &DEV_SEED).unwrap()
    }

    #[test]
    fn accepts_a_signed_wasm_capsule_with_its_manifest() {
        let img = image("greeter", "ticks=2 period_ms=100 version=3");
        let accepted = check(&img, &DEV_PUBLIC(), &VersionFloors::default()).unwrap();
        assert_eq!(accepted.name, "greeter");
        assert_eq!(accepted.capabilities, cap::WRITE | cap::SLEEP);
        assert_eq!(accepted.schedule.version, 3);
        assert_eq!(accepted.schedule.ticks, 2);
    }

    #[test]
    fn refuses_what_it_must() {
        let key = DEV_PUBLIC();
        let none = VersionFloors::default();
        let mut tampered = image("greeter", "ticks=1");
        let last = tampered.len() - 70;
        tampered[last] ^= 1;
        assert_eq!(
            check(&tampered, &key, &none),
            Err(Refusal::Image(maataa_capsule::CapsuleError::BadSignature))
        );
        assert_eq!(
            check(&image("heartbeat", "ticks=1"), &key, &none),
            Err(Refusal::BuiltInName)
        );
        let not_wasm = sign("notes", cap::WRITE, b"plain text", &DEV_SEED).unwrap();
        assert_eq!(check(&not_wasm, &key, &none), Err(Refusal::NotWasm));
        assert!(matches!(
            check(&image("greeter", "speed=9"), &key, &none),
            Err(Refusal::Manifest(_))
        ));
        assert!(check(&image("greeter", "ticks=1"), &[7; 32], &none).is_err());
    }

    #[test]
    fn version_floors_stop_downgrades_per_name() {
        let key = DEV_PUBLIC();
        let mut floors = VersionFloors::default();
        floors.record("greeter", 3);
        assert_eq!(
            check(&image("greeter", "version=2"), &key, &floors),
            Err(Refusal::Older { installed: 3 })
        );
        assert!(check(&image("greeter", "version=3"), &key, &floors).is_ok());
        assert!(check(&image("other", "version=0"), &key, &floors).is_ok());
        // Round trip, and the oldest of four names drops off.
        floors.record("b", 1);
        floors.record("c", 1);
        let floors = VersionFloors::decode(&floors.encode());
        assert_eq!(floors.floor("greeter"), Some(3));
        let mut more = floors;
        more.record("d", 1);
        assert_eq!(more.floor("greeter"), None);
        assert_eq!(more.floor("d"), Some(1));
        more.record("c", 5);
        assert_eq!(more.floor("c"), Some(5));
        assert_eq!(VersionFloors::decode(&[]), VersionFloors::default());
    }

    #[test]
    fn info_layout() {
        let img = image("greeter", "version=4");
        let accepted = check(&img, &DEV_PUBLIC(), &VersionFloors::default()).unwrap();
        let mut out = [0u8; 64];
        let n = encode_info(&accepted, img.len(), &mut out);
        assert_eq!(n, 13 + 7);
        assert_eq!(&out[0..4], &4u32.to_le_bytes());
        assert_eq!(&out[13..20], b"greeter");
        assert_eq!(encode_info(&accepted, img.len(), &mut [0u8; 5]), 0);
    }
}
