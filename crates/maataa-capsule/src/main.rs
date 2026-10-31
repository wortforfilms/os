//! `maataa-capsule`: build, sign and inspect MCAP capsule images.
//!
//! ```text
//! maataa-capsule sign --name telemetry --caps write,sleep --payload target/telemetry.wasm --dev -o assets/capsules/telemetry.mcap
//! maataa-capsule inspect assets/capsules/telemetry.mcap --dev
//! maataa-capsule resign assets/capsules/telemetry.mcap --seed-file ~/.maataa/capsule-release.seed -o out/telemetry.mcap
//! maataa-capsule keygen -o ~/.maataa/capsule-release.seed     # keep this file private
//! maataa-capsule pubkey --seed-file ~/.maataa/capsule-release.seed
//! maataa-capsule wasm capsules/telemetry.wat -o target/telemetry.wasm
//! ```
//!
//! `--dev` uses the public development seed (`DEV_SEED`). A release key is a
//! 32-byte seed stored as 64 hex characters in a file you keep off the repo.

use maataa_capsule::{cap, public_key, sign, verify, DEV_SEED};
use std::process::ExitCode;

const USAGE: &str = "usage:
  maataa-capsule sign --name NAME --caps LIST --payload FILE (--dev | --seed-file F) -o OUT
  maataa-capsule inspect IMAGE (--dev | --pubkey HEX | --seed-file F)
  maataa-capsule resign IMAGE [--from-pubkey HEX] (--dev | --seed-file F) -o OUT
  maataa-capsule keygen -o SEED_FILE
  maataa-capsule pubkey (--dev | --seed-file F)
  maataa-capsule wasm TEXT.wat -o OUT.wasm   (assemble; must load in the kernel's interpreter)
caps: comma-separated names, `none`, or `all`:
  write led demo_done test send recv sleep mutex semaphore uart_write uart_read host_status
  store_get store_put capsule_install";

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn unhex32(text: &str) -> Result<[u8; 32], String> {
    let text = text.trim();
    if text.len() != 64 {
        return Err(format!("expected 64 hex characters, got {}", text.len()));
    }
    let mut out = [0u8; 32];
    for (i, byte) in out.iter_mut().enumerate() {
        *byte = u8::from_str_radix(&text[2 * i..2 * i + 2], 16).map_err(|e| e.to_string())?;
    }
    Ok(out)
}

fn parse_caps(list: &str) -> Result<u32, String> {
    match list {
        "none" => return Ok(0),
        "all" => return Ok(cap::ALL),
        _ => {}
    }
    list.split(',').try_fold(0u32, |mask, name| {
        cap::NAMES
            .iter()
            .find(|(_, n)| *n == name.trim())
            .map(|(bits, _)| mask | bits)
            .ok_or_else(|| format!("unknown capability `{name}`"))
    })
}

fn describe_caps(mask: u32) -> String {
    let names: Vec<&str> = cap::NAMES
        .iter()
        .filter(|(bits, _)| mask & bits == *bits)
        .map(|(_, n)| *n)
        .collect();
    if names.is_empty() {
        "none".into()
    } else {
        names.join(",")
    }
}

struct Args(Vec<String>);

impl Args {
    fn value(&self, flag: &str) -> Option<&str> {
        self.0
            .iter()
            .position(|a| a == flag)
            .and_then(|i| self.0.get(i + 1))
            .map(String::as_str)
    }
    fn has(&self, flag: &str) -> bool {
        self.0.iter().any(|a| a == flag)
    }
    fn seed(&self) -> Result<[u8; 32], String> {
        match (self.has("--dev"), self.value("--seed-file")) {
            (true, None) => Ok(DEV_SEED),
            (false, Some(path)) => {
                unhex32(&std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?)
            }
            _ => Err("give exactly one of --dev or --seed-file".into()),
        }
    }
}

fn run(args: Args) -> Result<(), String> {
    let command = args.0.first().ok_or(USAGE)?.as_str();
    match command {
        "sign" => {
            let name = args.value("--name").ok_or("--name is required")?;
            let caps = parse_caps(args.value("--caps").ok_or("--caps is required")?)?;
            let payload_path = args.value("--payload").ok_or("--payload is required")?;
            let out = args.value("-o").ok_or("-o is required")?;
            let payload =
                std::fs::read(payload_path).map_err(|e| format!("{payload_path}: {e}"))?;
            let image =
                sign(name, caps, &payload, &args.seed()?).map_err(|e| e.as_str().to_string())?;
            std::fs::write(out, &image).map_err(|e| format!("{out}: {e}"))?;
            println!(
                "signed {out}: {name}, caps {}, payload {} bytes, image {} bytes",
                describe_caps(caps),
                payload.len(),
                image.len()
            );
            Ok(())
        }
        "resign" => {
            // Same name, capabilities and payload, signed with another key:
            // turns the development-signed built-in images into release ones.
            let path = args.0.get(1).ok_or("resign needs an image path")?;
            let out = args.value("-o").ok_or("-o is required")?;
            let image = std::fs::read(path).map_err(|e| format!("{path}: {e}"))?;
            let from = match args.value("--from-pubkey") {
                Some(hex_key) => unhex32(hex_key)?,
                None => public_key(&DEV_SEED),
            };
            let capsule = verify(&image, &from).map_err(|e| {
                format!(
                    "{path}: does not verify with the key it is re-signed from: {}",
                    e.as_str()
                )
            })?;
            let signed = sign(
                capsule.name,
                capsule.capabilities,
                capsule.payload,
                &args.seed()?,
            )
            .map_err(|e| e.as_str().to_string())?;
            std::fs::write(out, &signed).map_err(|e| format!("{out}: {e}"))?;
            println!(
                "re-signed {out}: {}, caps {}, payload {} bytes",
                capsule.name,
                describe_caps(capsule.capabilities),
                capsule.payload.len()
            );
            Ok(())
        }
        "inspect" => {
            let path = args.0.get(1).ok_or("inspect needs an image path")?;
            let image = std::fs::read(path).map_err(|e| format!("{path}: {e}"))?;
            let key = match args.value("--pubkey") {
                Some(hex_key) => unhex32(hex_key)?,
                None => public_key(&args.seed()?),
            };
            let capsule =
                verify(&image, &key).map_err(|e| format!("{path}: rejected: {}", e.as_str()))?;
            println!(
                "{path}: verified; name {}, caps {} ({:#06x}), payload {} bytes",
                capsule.name,
                describe_caps(capsule.capabilities),
                capsule.capabilities,
                capsule.payload.len()
            );
            Ok(())
        }
        "keygen" => {
            let out = args.value("-o").ok_or("-o is required")?;
            if std::path::Path::new(out).exists() {
                return Err(format!("{out} exists; not overwriting a key"));
            }
            let mut seed = [0u8; 32];
            use std::io::Read;
            std::fs::File::open("/dev/urandom")
                .and_then(|mut f| f.read_exact(&mut seed))
                .map_err(|e| format!("/dev/urandom: {e}"))?;
            std::fs::write(out, format!("{}\n", hex(&seed))).map_err(|e| format!("{out}: {e}"))?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(out, std::fs::Permissions::from_mode(0o600));
            }
            println!("wrote {out} (keep it private)");
            println!("public key: {}", hex(&public_key(&seed)));
            Ok(())
        }
        "wasm" => {
            let path = args.0.get(1).ok_or("wasm needs a .wat path")?;
            let out = args.value("-o").ok_or("-o is required")?;
            let bytes = wat::parse_file(path).map_err(|e| format!("{path}: {e}"))?;
            let module = maataa_wasm::Module::parse(&bytes).map_err(|e| {
                format!("{path}: the kernel interpreter rejects it: {}", e.as_str())
            })?;
            let imports: Vec<String> = module
                .imports()
                .iter()
                .map(|i| format!("{}.{}", i.module, i.name))
                .collect();
            let exports: Vec<&str> = module.export_names().collect();
            let schedule = maataa_capsule::Schedule::parse(module.manifest())
                .map_err(|e| format!("{path}: maataa manifest: {e}"))?;
            std::fs::write(out, &bytes).map_err(|e| format!("{out}: {e}"))?;
            println!(
                "wrote {out}: {} bytes; imports [{}]; exports [{}]; schedule {} ticks every {} ms, version {}{}",
                bytes.len(),
                imports.join(", "),
                exports.join(", "),
                schedule.ticks,
                schedule.period_ms,
                schedule.version,
                if module.manifest().is_none() { " (default: no maataa section)" } else { "" }
            );
            Ok(())
        }
        "pubkey" => {
            println!("{}", hex(&public_key(&args.seed()?)));
            Ok(())
        }
        "-h" | "--help" => {
            println!("{USAGE}");
            Ok(())
        }
        other => Err(format!("unknown command `{other}`\n{USAGE}")),
    }
}

fn main() -> ExitCode {
    match run(Args(std::env::args().skip(1).collect())) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("maataa-capsule: {e}");
            ExitCode::FAILURE
        }
    }
}
