# KBS Getting Started

KBS is the Maataa Knowledge Base System: a governed knowledge runtime for sources, claims, citations, evidence, graph lineage, review, and PHKD status.

Current status: `GOVERNED_PRODUCTION_NO_GO`.

Run the local verification slice:

```bash
npm run typecheck:kbs
npm run test:kbs
npm run kbs:verify
```

The runtime is local-first and deterministic. It does not claim public production readiness, hardware attestation, release signer verification, scholar approval, or deployment success.
