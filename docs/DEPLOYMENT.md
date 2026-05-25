# Golden Image Deployment

The production packaging flow is local-only and excludes raw prototypes such as
`assets/html/`.

## Build

```bash
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
markers, forbidden path exclusions, and `SHA256SUMS`.

## Flash

Dry-run:

```bash
bash scripts/flash-golden-image.sh dist-golden/maataa-os-0.1.0-alpha.1 /dev/rdiskN
```

Apply:

```bash
MAATAA_FLASH_APPLY=1 bash scripts/flash-golden-image.sh dist-golden/maataa-os-0.1.0-alpha.1 /dev/rdiskN /dev/rdiskM
```

Each target is written in parallel, read back, and compared byte-for-byte before
the routine reports success.
