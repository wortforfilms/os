# Operator Quorum

The release authority requires both a verified hardware-backed release signer and a verified operator quorum before it can emit `GOVERNED_RELEASE_CANDIDATE`.

This is not production GO. Production GO still requires hardware-root `CAPTURED` and every governed production gate to pass.

## Commands

```bash
npm run operator:enroll
npm run operator:approve
npm run operator:list
npm run operator:revoke
npm run release:verify
npm run govern:release
```

## Enroll Operator

Enrollment requires a real public key or certificate fingerprint source. No dev-only bypass exists.

```bash
export MAATAA_OPERATOR_ID=brahmini
export MAATAA_OPERATOR_ROLE=Admin
export MAATAA_OPERATOR_SIGNER_TYPE=HSM
export MAATAA_OPERATOR_PUBLIC_KEY_PEM=/secure/path/operator-public.pem
export MAATAA_OPERATOR_CERTIFICATE_PEM=/secure/path/operator-cert.pem
npm run operator:enroll
```

Allowed signer types:

- `TPM2`
- `HSM`
- `SECURE_ENCLAVE`
- `BLOCKED`

`BLOCKED` operators may be listed for audit, but they cannot satisfy quorum.

## Approval Payload

To print the exact payload that must be signed by the operator hardware-backed key:

```bash
export MAATAA_OPERATOR_ID=brahmini
export MAATAA_OPERATOR_ROLE=Admin
export MAATAA_RELEASE_APPROVAL_NONCE=$(openssl rand -hex 32)
npm run operator:approve -- --payload
```

The signed payload includes:

- release manifest hash
- operator id
- operator role
- nonce
- approval timestamp
- expiry timestamp

## Submit Approval

After signing the printed payload with the enrolled operator key:

```bash
export MAATAA_OPERATOR_ID=brahmini
export MAATAA_OPERATOR_ROLE=Admin
export MAATAA_RELEASE_APPROVAL_NONCE='same nonce used for payload'
export MAATAA_RELEASE_APPROVAL_EXPIRES_AT='2026-05-26T00:15:00.000Z'
export MAATAA_OPERATOR_APPROVAL_SIGNATURE_B64='base64-signature'
npm run operator:approve
```

The script verifies the signature before appending it to:

- `release/release-authority/operator-approvals.json`

## Revoke Operator

```bash
export MAATAA_OPERATOR_ID=brahmini
export MAATAA_OPERATOR_REVOKE_REASON='key rotated'
npm run operator:revoke
```

Revoked operators cannot satisfy quorum.

## Quorum Rules

- no unsigned approvals
- no fake operators
- no duplicate operator counting
- no expired approvals
- no revoked operators
- no `BLOCKED` signer type approvals
- default quorum is 2 unless `MAATAA_RELEASE_QUORUM` is set

Expected outcomes:

- no real signer: `BLOCKED`
- one operator only: `BLOCKED`
- quorum with unverifiable signatures: `BLOCKED`
- valid hardware-backed quorum plus verified release signer: `GOVERNED_RELEASE_CANDIDATE`
