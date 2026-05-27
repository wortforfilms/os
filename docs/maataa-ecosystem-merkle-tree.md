# Maataa Ecosystem Merkle Tree

This document absorbs the extracted visual map into the Maataa OS repository as a governed scaffold.

```txt
TREE_MODEL=STRUCTURED
ROOT_HASH_VERIFIED=false
PRODUCTION_READY=false
FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO
```

The displayed root hash `0x7A3F...91BC` is an image-derived label. It is not cryptographic evidence until the repository has signed leaves, materialized relation edges, and a reproducible Merkle computation pipeline.

## Level 1 Domains

1. Runtime
2. Production (TLP)
3. Distribution (Radio)
4. Knowledge (KBM)
5. Lipi (Publishing)
6. Community
7. Documentation
8. ALLB Ecosystem

## Artifacts

- Data: `data/maataa-ecosystem-merkle-tree.json`
- Verifier: `scripts/verify-maataa-ecosystem-tree.mjs`
- Evidence: `release/evidence/maataa-ecosystem-tree-status.json`
- UI: `packages/maataa-ui/src/components/MaataaEcosystemMerkleTree.tsx`

## Promotion Requirements

- attach real data leaves
- compute hashes from bytes, not from image labels
- sign relation edges
- preserve operator review evidence
- bind release artifacts to hardware-root evidence
- keep all promotion gates fail-closed
