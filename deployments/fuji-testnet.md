# Verglas — Fuji Testnet Deployment (2026-07-12)

First live end-to-end run of the M1 pipeline: real spends on Fuji C-Chain,
Groth16 policy-compliance proof verified on-chain, ERC-8004 validation
stamped, attestation carried to the Dispatch L1 over ICM, gate clearance
confirmed on the second chain.

## Fuji C-Chain (43113)

| Contract           | Address                                      |
| ------------------ | -------------------------------------------- |
| VerglasHub         | `0xc07ef259Eb88742e00113d9F460F5D2081078960` |
| ValidationRegistry | `0x31900CA6bBd05ac2516feB6798f6aeB86FD41239` |
| Groth16Verifier    | `0x2b6466EC93C064f67C260c30613593460252169C` |
| VerglasAccount     | `0x0b35C0c0f44f7Fd62e556D6AcAC00EA313546F45` |
| TestUSD (dev)      | `0xa24972871B987cC7feD401Ea8e46F6D85F88a24C` |
| DevIdentity (dev)  | `0x332fc886dd6ab933c89a1149e7D938a6B4214a01` |

## Dispatch L1 (779672)

| Contract    | Address                                      |
| ----------- | -------------------------------------------- |
| VerglasGate | `0xD09c7baE6A2eE0E1E1C9443EF2a2791d8a97dc36` |

Gate parameters: `minScore=100`, `maxAge=7 days`, trusts the Hub above on
Fuji C-Chain (`0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5`).

## The live run

- Agent `1599`, window `(0xA1,100e6)(0xB2,50e6)(0xA1,25e6)`, proof verified
  on-chain by `submitProof`, registry stamped with score 100,
  tag `verglas:policy-compliance`.
- ICM carry tx (C-Chain): `0x2aeb3d600565d7ff6e811383476deba71b6e9228893cdb19d8ddebed1dd3191b`
  — messageID `0x5f4f7344087ba93a30969ee6f849df4fed3f11d6e1dfdd033fa21280ec21d225`,
  160,297 gas.
- Delivery: public testnet relayer delivered within seconds;
  `isCleared(1599)` returned `true` on Dispatch, carried attestation
  matches the Hub's record field-for-field.

## Notes

- TestUSD and DevIdentity are E2E stand-ins; later milestones switch to a
  real token and the canonical ERC-8004 Identity Registry (`0x8004A9...`).
- `carryAttestation` must be sent via `cast send` (not inside a forge
  script): Foundry's local EVM cannot execute the Warp precompile
  (`0x02000...05`) that Teleporter writes messages to.
