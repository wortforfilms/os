use std::env;
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;

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

    capsule_key(out);
}

/// The public key the kernel checks capsule signatures against. A release
/// build sets MAATAA_CAPSULE_PUBKEY (64 hex characters); otherwise the
/// development key in keys/capsule-dev.pub is used and the boot report says so.
fn capsule_key(out: &PathBuf) {
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
}
