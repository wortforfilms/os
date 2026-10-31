//! Runs a verified WebAssembly capsule as an unprivileged task.
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
//! | `sleep_ms` | `(i32) -> i32` | 7, sleep; 0 or an error code |
//! | `led` | `(i32) -> i32` | 2, LED; 0 or an error code |
//!
//! Error codes reach the capsule as negative numbers (`E_NOCAP` is -16).

#[cfg(target_arch = "arm")]
use crate::syscall;
use maataa_wasm::{Host, Import, Trap};

/// Instructions one export call may run.
pub const FUEL_PER_CALL: u32 = 20_000;

/// Names the capsule may import. Anything else is refused before it runs.
pub const IMPORTS: [(&str, u8, u8); 3] = [("log", 1, 0), ("sleep_ms", 1, 1), ("led", 1, 1)];

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
pub struct SyscallHost {
    pub name: &'static str,
}

#[cfg(target_arch = "arm")]
impl Host for SyscallHost {
    fn call(&mut self, _index: usize, import: &Import<'_>, args: &[i32]) -> Result<i32, Trap> {
        match import.name {
            "log" => {
                crate::uprintln!("capsule {}: log {}", self.name, args[0]);
                Ok(0)
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

/// Task body: load the capsule's module, call `init` once and `tick` a few
/// times, then idle. `image` must already have been verified by the kernel.
#[cfg(target_arch = "arm")]
pub fn run(name: &'static str, image: &'static [u8], ticks: u32, period_ms: u32) -> ! {
    use maataa_wasm::{Instance, Module};

    let idle = || -> ! {
        loop {
            crate::clock::idle();
        }
    };
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
    crate::uprintln!(
        "capsule {}: wasm loaded ({} bytes, {} imports)",
        name,
        payload.len(),
        module.imports().len()
    );
    let mut instance = Instance::new(&module);
    let mut host = SyscallHost { name };

    match instance.invoke(&mut host, "init", &[], FUEL_PER_CALL) {
        Ok(Some(value)) => crate::uprintln!("capsule {}: init -> {}", name, Shown(value)),
        Ok(None) => crate::uprintln!("capsule {}: init done", name),
        Err(Trap::NoSuchExport) => {}
        Err(trap) => crate::uprintln!("capsule {}: init trapped: {}", name, trap.as_str()),
    }
    for tick in 1..=ticks {
        match instance.invoke(&mut host, "tick", &[], FUEL_PER_CALL) {
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
        let _ = syscall::sleep_ms(period_ms);
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
    fn the_built_in_telemetry_capsule_loads_and_runs() {
        let image = include_bytes!("../assets/capsules/telemetry.mcap");
        let payload = maataa_capsule::payload_unverified(image).unwrap();
        let module = Module::parse(payload).expect("telemetry wasm loads");
        check_imports(module.imports()).unwrap();

        struct Fake(Vec<i32>);
        impl Host for Fake {
            fn call(&mut self, _: usize, import: &Import<'_>, args: &[i32]) -> Result<i32, Trap> {
                match import.name {
                    "log" => {
                        self.0.push(args[0]);
                        Ok(0)
                    }
                    "led" => Ok(to_capsule(crate::syscall::E_NOCAP)),
                    _ => Ok(0),
                }
            }
        }
        let mut host = Fake(Vec::new());
        let mut instance = maataa_wasm::Instance::new(&module);
        assert_eq!(
            instance.invoke(&mut host, "init", &[], FUEL_PER_CALL),
            Ok(Some(-16))
        );
        let ticks: Vec<_> = (0..3)
            .map(|_| {
                instance
                    .invoke(&mut host, "tick", &[], FUEL_PER_CALL)
                    .unwrap()
            })
            .collect();
        assert_eq!(ticks, vec![Some(89), Some(144), Some(233)]);
        assert_eq!(host.0, vec![89, 144, 233]);
    }
}
