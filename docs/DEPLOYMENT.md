# Golden Image Deployment

Current product deployment posture: `CONTROLLED_NO_GO`.

Preview packaging can be verified locally, but production deployment remains
blocked until hardware root of trust, per-device flashing admission, and the
remaining hardening blockers are resolved.

The production packaging flow is local-only and excludes raw prototypes such as
`assets/html/`.

## Build

```bash
npm run build
npm run golden:build
```

This runs scaffold validation, QEMU smoke, frontend minimization, kernel release
build, stripping, binary conversion, geometry checks, and SHA-256 matrix
generation.

Output:

```text
dist-golden/maataa-os-0.1.0-alpha.1/
```

## Verify

```bash
npm run golden:verify
```

Verification checks required artifacts, boot-contract markers, recovery fallback
markers, forbidden path exclusions, `SHA256SUMS`, package kernel hash, and the
production hardening matrix. It reports unresolved blockers rather than
mutating a false pass state.

## Flash

Dry-run:

```bash
bash scripts/flash-golden-image.sh dist-golden/maataa-os-0.1.0-alpha.1 /dev/rdiskN
```

The package argument is optional when using the default alpha bundle:

```bash
bash scripts/flash-golden-image.sh /dev/rdiskN
```

Apply:

```bash
MAATAA_FLASH_APPLY=1 bash scripts/flash-golden-image.sh dist-golden/maataa-os-0.1.0-alpha.1 /dev/rdiskN /dev/rdiskM
```

Each target is written in parallel, read back, and compared byte-for-byte before
the routine reports success.
