//! Runs a verified WebAssembly capsule as an unprivileged task.
//!
//! The kernel starts one capsule task for each verified capsule whose payload
//! is WebAssembly, up to [`CAPSULE_TASKS`]. When to call the capsule comes
//! from its signed manifest: the module's `maataa` custom section
//! (`maataa_capsule::Schedule`), for example `ticks=3 period_ms=200`.
//!
//! The kernel verifies the capsule's signature at boot and gives this task
//! the capability mask from the capsule's signed manifest. The interpreter
//! (`crates/maataa-wasm`) runs inside the task, on the task's own stack, and
//! each import becomes a supervisor call made by this task, so the kernel's
//! capability check applies to the capsule's calls as to any other task's.
//!
//! Imports (module `maataa`):
//!
//! | Import | Type | Supervisor call |
//! | --- | --- | --- |
//! | `log` | `(i32)` | 1, write: `capsule <name>: log <value>` |
//! | `log_str` | `(ptr, len)` | 1, write: `capsule <name>: <text>` (UTF-8 from memory) |
//! | `sleep_ms` | `(i32) -> i32` | 7, sleep; 0 or an error code |
//! | `led` | `(i32) -> i32` | 2, LED; 0 or an error code |
//! | `store_get` | `(key, ptr, cap) -> i32` | 15; value length or an error code |
//! | `store_put` | `(key, ptr, len) -> i32` | 16; 0 or an error code |
//!
//! Error codes reach the capsule as negative numbers (`E_NOCAP` is -16).
//!
//! **Memory.** A capsule with a linear memory gets [`CAPSULE_MEMORY_BYTES`]
//! of it, in a buffer on this task's own stack. Its data segments are copied
//! in at load; any access beyond the buffer traps. A pointer an import
//! receives is checked against the same buffer, and because the buffer lies
//! in the task's stack the kernel's own buffer checks accept it for
//! `store_get` / `store_put` unchanged.

#[cfg(target_arch = "arm")]
use crate::syscall;
use maataa_wasm::{Host, Import, Trap};

/// How many capsule tasks the kernel runs (tasks 7 and 8).
pub const CAPSULE_TASKS: usize = 2;

/// A verified WebAssembly capsule, assigned to a capsule task at boot.
#[derive(Clone, Copy)]
pub struct CapsuleGrant {
    pub name: &'static str,
    /// The whole signed image; the kernel verified it before granting it.
    pub image: &'static [u8],
    pub capabilities: u32,
    /// Scheduling level from the signed manifest (`priority=`, 1..=4).
    pub priority: u8,
}

/// The scheduling level a verified capsule image asks for in its signed
/// manifest: 1 to 4, or 1 if it names none. A manifest the task will refuse
/// anyway (or a payload that is not WebAssembly) also gets level 1, the
/// lowest an application task has, so a bad image can never run high.
pub fn manifest_priority(image: &[u8]) -> u8 {
    maataa_capsule::payload_unverified(image)
        .and_then(|payload| maataa_wasm::manifest_section(payload).ok())
        .and_then(|section| maataa_capsule::Schedule::parse(section).ok())
        .map_or(maataa_capsule::Schedule::DEFAULT.priority, |s| s.priority)
}

/// Instructions one export call may run.
pub const FUEL_PER_CALL: u32 = 20_000;

/// Linear memory a capsule may use.
pub const CAPSULE_MEMORY_BYTES: usize = 4096;

/// Names the capsule may import. Anything else is refused before it runs.
pub const IMPORTS: [(&str, u8, u8); 6] = [
    ("log", 1, 0),
    ("log_str", 2, 0),
    ("sleep_ms", 1, 1),
    ("led", 1, 1),
    ("store_get", 3, 1),
    ("store_put", 3, 1),
];

/// The `[ptr, ptr + len)` slice of capsule memory, or a trap.
pub fn capsule_slice(memory: &mut [u8], ptr: i32, len: i32) -> Result<&mut [u8], Trap> {
    let (ptr, len) = (ptr as u32 as usize, len as u32 as usize);
    let end = ptr.checked_add(len).ok_or(Trap::OutOfBounds)?;
    memory.get_mut(ptr..end).ok_or(Trap::OutOfBounds)
}

/// Checks every import against [`IMPORTS`] (module, name and type).
pub fn check_imports(imports: &[Import<'_>]) -> Result<(), &'static str> {
    for import in imports {
        if import.module != "maataa" {
            return Err("import from a module other than maataa");
        }
        let known = IMPORTS.iter().any(|&(name, params, results)| {
            import.name == name && import.ty.params == params && import.ty.results == results
        });
        if !known {
            return Err("unknown import or wrong type");
        }
    }
    Ok(())
}

/// Turns a syscall result into the value the capsule sees.
pub const fn to_capsule(code: u32) -> i32 {
    code as i32
}

/// Host functions backed by supervisor calls.
#[cfg(target_arch = "arm")]
pub struct SyscallHost<'a> {
    pub name: &'a str,
}

#[cfg(target_arch = "arm")]
impl Host for SyscallHost<'_> {
    fn call(
        &mut self,
        _index: usize,
        import: &Import<'_>,
        args: &[i32],
        memory: &mut [u8],
    ) -> Result<i32, Trap> {
        match import.name {
            "log" => {
                crate::uprintln!("capsule {}: log {}", self.name, args[0]);
                Ok(0)
            }
            "log_str" => {
                let bytes = capsule_slice(memory, args[0], args[1])?;
                let text = core::str::from_utf8(bytes).unwrap_or("<not UTF-8>");
                crate::uprintln!("capsule {}: {}", self.name, text);
                Ok(0)
            }
            "store_get" => {
                let out = capsule_slice(memory, args[1], args[2])?;
                Ok(match syscall::store_get(args[0].clamp(0, 255) as u8, out) {
                    Ok(n) => n as i32,
                    Err(code) => to_capsule(code),
                })
            }
            "store_put" => {
                let value = capsule_slice(memory, args[1], args[2])?;
                Ok(
                    match syscall::store_put(args[0].clamp(0, 255) as u8, value) {
                        Ok(()) => 0,
                        Err(code) => to_capsule(code),
                    },
                )
            }
            "sleep_ms" => Ok(match syscall::sleep_ms(args[0].max(0) as u32) {
                Ok(()) => 0,
                Err(code) => to_capsule(code),
            }),
            "led" => Ok(to_capsule(syscall::led_checked(args[0] != 0))),
            _ => Err(Trap::UnresolvedImport),
        }
    }
}

/// Formats a capsule result: errors from the kernel get their name.
#[cfg(target_arch = "arm")]
struct Shown(i32);

#[cfg(target_arch = "arm")]
impl core::fmt::Display for Shown {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        let code = self.0 as u32;
        if code >= syscall::E_LOWEST {
            write!(f, "{} ({})", self.0, syscall::error_name(code))
        } else {
            write!(f, "{}", self.0)
        }
    }
}

/// Task body: load the capsule's module, call `init` once and `tick` on the
/// schedule its signed manifest gives, then park. `image` must already have
/// been verified by the kernel.
#[cfg(target_arch = "arm")]
pub fn run(name: &str, image: &[u8]) -> ! {
    use maataa_capsule::Schedule;
    use maataa_wasm::{Instance, Module};

    // Done (or refused): park, so a capsule at a higher level never keeps
    // the levels below it from running.
    let idle = || -> ! { syscall::park_forever() };
    let Some(payload) = maataa_capsule::payload_unverified(image) else {
        crate::uprintln!("capsule {}: bad image", name);
        idle()
    };
    let module = match Module::parse(payload) {
        Ok(module) => module,
        Err(error) => {
            crate::uprintln!("capsule {}: not loaded: {}", name, error.as_str());
            idle()
        }
    };
    if let Err(why) = check_imports(module.imports()) {
        crate::uprintln!("capsule {}: not loaded: {}", name, why);
        idle()
    }
    let schedule = match Schedule::parse(module.manifest()) {
        Ok(schedule) => schedule,
        Err(why) => {
            crate::uprintln!("capsule {}: not loaded: {}", name, why);
            idle()
        }
    };
    crate::uprintln!(
        "capsule {}: wasm loaded ({} bytes, {} imports, {} bytes of memory)",
        name,
        payload.len(),
        module.imports().len(),
        if module.memory_pages().is_some() {
            CAPSULE_MEMORY_BYTES
        } else {
            0
        }
    );
    match (module.manifest().is_some(), schedule.forever()) {
        (false, _) => crate::uprintln!(
            "capsule {}: schedule: default, {} tick (no signed manifest section)",
            name,
            schedule.ticks
        ),
        (true, false) => crate::uprintln!(
            "capsule {}: schedule: {} ticks every {} ms (signed manifest)",
            name,
            schedule.ticks,
            schedule.period_ms
        ),
        (true, true) => crate::uprintln!(
            "capsule {}: schedule: a tick every {} ms, without end (signed manifest)",
            name,
            schedule.period_ms
        ),
    }
    let mut instance = Instance::new(&module);
    let mut host = SyscallHost { name };
    let mut memory = [0u8; CAPSULE_MEMORY_BYTES];
    if let Err(trap) = instance.init_memory(&mut memory) {
        crate::uprintln!("capsule {}: not loaded: {}", name, trap.as_str());
        idle()
    }

    match instance.invoke(&mut host, "init", &[], FUEL_PER_CALL, &mut memory) {
        Ok(Some(value)) => crate::uprintln!("capsule {}: init -> {}", name, Shown(value)),
        Ok(None) => crate::uprintln!("capsule {}: init done", name),
        Err(Trap::NoSuchExport) => {}
        Err(trap) => crate::uprintln!("capsule {}: init trapped: {}", name, trap.as_str()),
    }
    let mut tick: u32 = 0;
    while schedule.forever() || tick < schedule.ticks {
        tick = tick.wrapping_add(1);
        match instance.invoke(&mut host, "tick", &[], FUEL_PER_CALL, &mut memory) {
            Ok(value) => crate::uprintln!(
                "capsule {}: tick {} -> {} ({} instructions)",
                name,
                tick,
                Shown(value.unwrap_or(0)),
                instance.fuel_used
            ),
            Err(trap) => {
                crate::uprintln!("capsule {}: tick {} trapped: {}", name, tick, trap.as_str());
                break;
            }
        }
        let _ = syscall::sleep_ms(schedule.period_ms);
    }
    crate::uprintln!("capsule {}: done", name);
    idle()
}

#[cfg(test)]
mod tests {
    use super::*;
    use maataa_wasm::{FuncType, Module};

    fn import(
        module: &'static str,
        name: &'static str,
        params: u8,
        results: u8,
    ) -> Import<'static> {
        Import {
            module,
            name,
            ty: FuncType { params, results },
        }
    }

    #[test]
    fn only_known_imports_with_their_types_are_allowed() {
        assert!(
            check_imports(&[import("maataa", "log", 1, 0), import("maataa", "led", 1, 1)]).is_ok()
        );
        assert!(check_imports(&[import("env", "log", 1, 0)]).is_err());
        assert!(check_imports(&[import("maataa", "log", 2, 0)]).is_err());
        assert!(check_imports(&[import("maataa", "reboot", 0, 0)]).is_err());
    }

    #[test]
    fn capsule_slices_are_bounds_checked() {
        let mut memory = [0u8; 16];
        assert_eq!(capsule_slice(&mut memory, 4, 8).unwrap().len(), 8);
        assert_eq!(capsule_slice(&mut memory, 8, 9), Err(Trap::OutOfBounds));
        assert_eq!(capsule_slice(&mut memory, -1, 1), Err(Trap::OutOfBounds));
        assert_eq!(capsule_slice(&mut memory, 1, -1), Err(Trap::OutOfBounds));
    }

    #[test]
    fn built_in_capsules_carry_their_schedules() {
        use maataa_capsule::Schedule;
        for (image, expected) in [
            (
                &include_bytes!("../assets/capsules/telemetry.mcap")[..],
                Schedule {
                    ticks: 3,
                    period_ms: 200,
                    version: 0,
                    priority: 1,
                },
            ),
            (
                &include_bytes!("../assets/capsules/heartbeat.mcap")[..],
                Schedule {
                    ticks: 4,
                    period_ms: 300,
                    version: 0,
                    priority: 1,
                },
            ),
        ] {
            let payload = maataa_capsule::payload_unverified(image).unwrap();
            assert!(maataa_capsule::is_wasm(payload));
            let module = Module::parse(payload).unwrap();
            check_imports(module.imports()).unwrap();
            assert_eq!(Schedule::parse(module.manifest()), Ok(expected));
        }
    }

    #[test]
    fn capsule_priority_comes_from_the_signed_manifest_and_defaults_to_one() {
        for image in [
            &include_bytes!("../assets/capsules/telemetry.mcap")[..],
            &include_bytes!("../assets/capsules/heartbeat.mcap")[..],
            &include_bytes!("../assets/capsules/greeter.mcap")[..],
        ] {
            assert_eq!(manifest_priority(image), 1);
        }
        // Not WebAssembly, or not an image at all: the lowest level.
        assert_eq!(
            manifest_priority(include_bytes!("../assets/capsules/hostlink.mcap")),
            1
        );
        assert_eq!(manifest_priority(b"junk"), 1);
    }

    /// The panini capsule (capsules/panini.wat) against its reference,
    /// crates/maataa-sandhi: every pair of boundary letters (all 14 vowels and
    /// a consonant on each side), malformed requests, and the store protocol
    /// (request in key 40, answer in key 41, key 40 deleted when done).
    #[test]
    fn the_panini_capsule_agrees_with_its_reference() {
        use std::collections::HashMap;
        let image = include_bytes!("../assets/capsules/panini.mcap");
        let payload = maataa_capsule::payload_unverified(image).unwrap();
        let module = Module::parse(payload).expect("panini wasm loads");
        check_imports(module.imports()).unwrap();
        assert_eq!(
            maataa_capsule::Schedule::parse(module.manifest()).map(|s| s.forever()),
            Ok(true)
        );

        #[derive(Default)]
        struct Store {
            keys: HashMap<i32, Vec<u8>>,
            logged: Vec<String>,
            writes: usize,
        }
        impl Host for Store {
            fn call(
                &mut self,
                _: usize,
                import: &Import<'_>,
                args: &[i32],
                memory: &mut [u8],
            ) -> Result<i32, Trap> {
                match import.name {
                    "log_str" => {
                        let text = capsule_slice(memory, args[0], args[1])?;
                        self.logged.push(String::from_utf8_lossy(text).into_owned());
                        Ok(0)
                    }
                    "store_get" => {
                        let out = capsule_slice(memory, args[1], args[2])?;
                        Ok(match self.keys.get(&args[0]) {
                            Some(v) if v.len() > out.len() => to_capsule(crate::syscall::E_TOOLONG),
                            Some(v) => {
                                out[..v.len()].copy_from_slice(v);
                                v.len() as i32
                            }
                            None => to_capsule(crate::syscall::E_NOENT),
                        })
                    }
                    "store_put" => {
                        let value = capsule_slice(memory, args[1], args[2])?.to_vec();
                        self.writes += 1;
                        // As the kernel's store: an empty value deletes the key.
                        if value.is_empty() {
                            self.keys.remove(&args[0]);
                        } else {
                            self.keys.insert(args[0], value);
                        }
                        Ok(0)
                    }
                    _ => Err(Trap::UnresolvedImport),
                }
            }
        }

        let mut host = Store::default();
        let mut instance = maataa_wasm::Instance::new(&module);
        let mut memory = [0u8; CAPSULE_MEMORY_BYTES];
        instance.init_memory(&mut memory).unwrap();
        assert_eq!(
            instance.invoke(&mut host, "init", &[], FUEL_PER_CALL, &mut memory),
            Ok(None)
        );
        assert_eq!(host.logged, ["panini capsule up"]);
        let mut tick = |host: &mut Store, memory: &mut [u8; CAPSULE_MEMORY_BYTES]| {
            instance
                .invoke(host, "tick", &[], FUEL_PER_CALL, memory)
                .expect("tick runs within its fuel")
                .unwrap()
        };

        // No request: nothing is written.
        assert_eq!(tick(&mut host, &mut memory), 0);
        assert_eq!(host.writes, 0);

        let mut requests: Vec<Vec<u8>> = Vec::new();
        let letters = b"aAiIuUfFxXeEoOk";
        for &a in letters {
            for &b in letters {
                requests.push(vec![b'k', a, b'+', b, b'k']);
                requests.push(vec![a, b'+', b]);
            }
        }
        for text in [
            "deva+indra",
            "mahA+fzi",
            "vane+atra",
            "hare+e",
            "iti+Adi",
            "devaindra",
            "+indra",
            "deva+",
            "deva+in+dra",
            "deva+indra!",
            "a+b c",
            "+",
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa+aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ] {
            requests.push(text.as_bytes().to_vec());
        }
        for request in requests {
            host.keys.insert(40, request.clone());
            host.keys.remove(&41);
            let result = tick(&mut host, &mut memory);
            let mut expected = [0u8; maataa_sandhi::MAX_TEXT];
            let shown = String::from_utf8_lossy(&request).into_owned();
            match maataa_sandhi::join_request(&request, &mut expected) {
                Ok((n, rule)) => {
                    assert_eq!(result, rule as i32, "{shown}");
                    assert_eq!(
                        host.keys.get(&41).map(Vec::as_slice),
                        Some(&expected[..n]),
                        "{shown}"
                    );
                }
                Err(error) => {
                    assert_eq!(result, error.code(), "{shown}");
                    assert_eq!(
                        host.keys.get(&41).map(Vec::as_slice),
                        Some(&b"?"[..]),
                        "{shown}"
                    );
                }
            }
            assert!(!host.keys.contains_key(&40), "{shown}: request not deleted");
        }
        assert!(host.logged.iter().any(|line| line == "devendra"));
        assert!(host.logged.iter().any(|line| line == "vane'tra"));
    }

    /// Runs the built-in capsule against a fake kernel: a store (key -> bytes),
    /// a log, and an LED call that is refused.
    #[test]
    fn the_built_in_telemetry_capsule_loads_and_runs() {
        use std::collections::HashMap;
        let image = include_bytes!("../assets/capsules/telemetry.mcap");
        let payload = maataa_capsule::payload_unverified(image).unwrap();
        let module = Module::parse(payload).expect("telemetry wasm loads");
        check_imports(module.imports()).unwrap();

        #[derive(Default)]
        struct Fake {
            logged: Vec<String>,
            store: HashMap<i32, Vec<u8>>,
        }
        impl Host for Fake {
            fn call(
                &mut self,
                _: usize,
                import: &Import<'_>,
                args: &[i32],
                memory: &mut [u8],
            ) -> Result<i32, Trap> {
                match import.name {
                    "log" => self.logged.push(args[0].to_string()),
                    "log_str" => {
                        let text = capsule_slice(memory, args[0], args[1])?;
                        self.logged.push(String::from_utf8_lossy(text).into_owned());
                    }
                    "led" => return Ok(to_capsule(crate::syscall::E_NOCAP)),
                    "store_get" => {
                        let out = capsule_slice(memory, args[1], args[2])?;
                        return Ok(match self.store.get(&args[0]) {
                            Some(v) => {
                                out[..v.len()].copy_from_slice(v);
                                v.len() as i32
                            }
                            None => to_capsule(crate::syscall::E_NOENT),
                        });
                    }
                    "store_put" => {
                        let value = capsule_slice(memory, args[1], args[2])?.to_vec();
                        self.store.insert(args[0], value);
                    }
                    _ => {}
                }
                Ok(0)
            }
        }

        let mut host = Fake::default();
        // Two "boots": the lifetime count in key 32 carries over.
        for boot in 0..2 {
            let mut instance = maataa_wasm::Instance::new(&module);
            let mut memory = [0u8; CAPSULE_MEMORY_BYTES];
            instance.init_memory(&mut memory).unwrap();
            assert_eq!(
                instance.invoke(&mut host, "init", &[], FUEL_PER_CALL, &mut memory),
                Ok(Some(-16))
            );
            let ticks: Vec<_> = (0..3)
                .map(|_| {
                    instance
                        .invoke(&mut host, "tick", &[], FUEL_PER_CALL, &mut memory)
                        .unwrap()
                })
                .collect();
            assert_eq!(ticks, vec![Some(89), Some(144), Some(233)]);
            let lifetime = 3 * (boot + 1);
            assert_eq!(
                host.store.get(&32),
                Some(&(lifetime as u32).to_le_bytes().to_vec())
            );
        }
        assert_eq!(host.logged[0], "telemetry capsule up");
        assert_eq!(&host.logged[1..3], &["lifetime ticks", "1"]);
        assert_eq!(host.logged.last().map(String::as_str), Some("6"));
    }
}
