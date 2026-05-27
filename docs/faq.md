# FAQ

## Is Maataa OS production ready?

No.

```txt
PRODUCTION_READY=false
FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO
```

## Can I use the dashboard locally?

Yes. The dashboard is a local preview and evidence cockpit.

```bash
npm run electron:dev
```

## Does the system have real hardware attestation?

Only if the current machine or target device exposes a real verifiable provider. The system must not invent MMIO, TPM, Secure Enclave, HSM, serial, or silicon evidence.

## Does Lipi Runtime certify 426 scripts?

No. It provides a deterministic 426-slot registry scaffold. Certification requires source-backed evidence, review, and governed promotion.

## Are Hindi, Haryanvi, and Punjabi supported?

They are present in the Aam Jantaa preview interface. Production language readiness remains blocked until field validation and release governance pass.

## Can I flash hardware now?

Only for controlled experiments with explicit operator responsibility. Production flashing is blocked until hardware-root evidence, operator quorum, signed release authority, and rollback drill evidence all pass.

## What should I attach to a bug report?

- exact command
- exact output
- route or package involved
- evidence JSON file if relevant
- screenshot only if it helps explain the UI issue
