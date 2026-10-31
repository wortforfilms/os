use std::env;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

fn main() {
    // Put the memory layout in the output directory
    let out = &PathBuf::from(env::var_os("OUT_DIR").unwrap());
    File::create(out.join("memory.x"))
        .unwrap()
        .write_all(include_bytes!("memory.x"))
        .unwrap();
    println!("cargo:rustc-link-search={}", out.display());

    // Re-run build if memory.x changes
    println!("cargo:rerun-if-changed=memory.x");

    let release_key = capsule_key(out);
    store_key(out);
    capsule_images(out, release_key);
}

/// The built-in capsule images (src/kernel.rs includes them from OUT_DIR).
/// MAATAA_CAPSULE_DIR points at a directory of images signed with the
/// release key (scripts/release.sh); otherwise assets/capsules is used.
fn capsule_images(out: &Path, release_key: bool) {
    println!("cargo:rerun-if-env-changed=MAATAA_CAPSULE_DIR");
    let dir = match env::var("MAATAA_CAPSULE_DIR") {
        Ok(d) if !d.trim().is_empty() => PathBuf::from(d.trim()),
        _ => {
            if release_key {
                println!(
                    "cargo:warning=MAATAA_CAPSULE_PUBKEY is set but MAATAA_CAPSULE_DIR is not: \
                     the development-signed images in assets/capsules will be rejected at boot"
                );
            }
            PathBuf::from("assets/capsules")
        }
    };
    let target = out.join("capsules");
    fs::create_dir_all(&target).unwrap();
    for name in ["telemetry", "heartbeat", "control", "hostlink"] {
        let from = dir.join(format!("{name}.mcap"));
        println!("cargo:rerun-if-changed={}", from.display());
        fs::copy(&from, target.join(format!("{name}.mcap")))
            .unwrap_or_else(|e| panic!("{}: {e}", from.display()));
    }
}

/// The master key the persistent store is sealed with (src/storage/persist.rs
/// binds it to the chip's unique id). A release build sets MAATAA_STORE_KEY
/// (64 hex characters); otherwise a development key, public in this source,
/// is used and the boot report says so.
fn store_key(out: &Path) {
    println!("cargo:rerun-if-env-changed=MAATAA_STORE_KEY");
    let (bytes, kind): (Vec<u8>, &str) = match env::var("MAATAA_STORE_KEY") {
        Ok(value) if !value.trim().is_empty() => {
            let hex = value.trim();
            assert!(
                hex.len() == 64 && hex.bytes().all(|b| b.is_ascii_hexdigit()),
                "MAATAA_STORE_KEY must be 64 hex characters"
            );
            (
                (0..32)
                    .map(|i| u8::from_str_radix(&hex[2 * i..2 * i + 2], 16).unwrap())
                    .collect(),
                "release",
            )
        }
        _ => (
            b"maataa-os-dev-store-NOT-SECRET!!".to_vec(),
            "development (public; integrity only)",
        ),
    };
    assert_eq!(bytes.len(), 32);
    let list: Vec<String> = bytes.iter().map(|b| format!("0x{b:02x}")).collect();
    let source = format!(
        "/// Persistent store master key (build.rs).\n\
         pub const STORE_MASTER_KEY: [u8; 32] = [{}];\n\
         /// Which key this build uses, for the boot report.\n\
         pub const STORE_KEY_KIND: &str = \"{kind}\";\n",
        list.join(", ")
    );
    fs::write(out.join("store_key.rs"), source).unwrap();
}

/// The public key the kernel checks capsule signatures against. A release
/// build sets MAATAA_CAPSULE_PUBKEY (64 hex characters); otherwise the
/// development key in keys/capsule-dev.pub is used and the boot report says so.
fn capsule_key(out: &Path) -> bool {
    println!("cargo:rerun-if-env-changed=MAATAA_CAPSULE_PUBKEY");
    println!("cargo:rerun-if-changed=keys/capsule-dev.pub");
    let (hex, kind) = match env::var("MAATAA_CAPSULE_PUBKEY") {
        Ok(value) if !value.trim().is_empty() => (value.trim().to_string(), "release"),
        _ => (
            fs::read_to_string("keys/capsule-dev.pub")
                .expect("keys/capsule-dev.pub is missing")
                .trim()
                .to_string(),
            "development (public seed; integrity only)",
        ),
    };
    assert!(
        hex.len() == 64 && hex.bytes().all(|b| b.is_ascii_hexdigit()),
        "capsule public key must be 64 hex characters"
    );
    let bytes: Vec<String> = (0..32)
        .map(|i| format!("0x{}", &hex[2 * i..2 * i + 2]))
        .collect();
    let source = format!(
        "/// Capsule signing public key (build.rs).\n\
         pub const CAPSULE_PUBLIC_KEY: [u8; 32] = [{}];\n\
         /// Which key this build trusts, for the boot report.\n\
         pub const CAPSULE_KEY_KIND: &str = \"{kind}\";\n\
         /// First 8 hex characters of the key, for the boot report.\n\
         pub const CAPSULE_KEY_ID: &str = \"{}\";\n",
        bytes.join(", "),
        &hex[..8]
    );
    fs::write(out.join("capsule_key.rs"), source).unwrap();
    kind == "release"
}
