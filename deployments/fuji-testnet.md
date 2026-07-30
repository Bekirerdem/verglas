# Verglas — Fuji Testnet Deployment v3 (2026-07-30)

The redeploy wave: the Hub ships the bindAccount ownership fix (and holds
the Identity Registry directly — the canonical Validation Registry's getter
is `getIdentityRegistry()`, which the previous indirect lookup missed), and
the treasurer is fed by the VerglasOracle shim instead of Pyth (whose free
Hermes endpoint died with the July 2026 protocol migration).

## Fuji C-Chain (43113) — v3

| Contract                    | Address                                      |
| --------------------------- | -------------------------------------------- |
| VerglasHub (bindAccount fix) | 0x17C273c8edEd16C5e9f7a7525f74AcE15bb5d81E  |
| VerglasOracle (keeper-signed IPyth shim) | 0x11a5Bd2295B316eEB53101cdB8B16D7A61A3bF4E |
| VerglasAccount (treasury v3) | 0xec9fb95C029980B80F63FfA27c20b98f586c564c  |
| VerglasTreasurer (shim-fed) | 0xf9098c210C5918F7dE01aA7E96b997C819Fb4614   |
| VerglasFactory (refillable-budget vaults) | 0x54Ea4db6Ba394B5853BB2271c8C1838549c7aE2B |

The 07-18 factory (0x770e72fc…) stays queried as a legacy source for
"my vaults"; its vaults carry an immutable budget (no refuel).

Unchanged from v2: Groth16Verifier, VerglasAccount (demo, #219), canonical
registries, USDC, VerglasFactory, VerglasDispenser — see the table below.
The USD/TRY feed keeps Pyth's id as the shim's storage key.

Agent identities were KEPT: **#219** rebound to its existing demo vault on
the new Hub, **#220** rebound to the fresh treasury vault (the old vault's
agent is immutable, so the treasurer swap needed a new vault; its 6 USDC
was reclaimed by owner exit and 7 USDC funded the new one). **#221**
(external owner) rebinds through the console's stamp-line flow.

v3 live run (2026-07-30): first payFX through the shim at 47.392141 USD/TRY
(tx 0x70c4bc2f…), strategy tick convert (tx 0x51cc37d1…), both agents
re-stamped on the canonical registry — #219 3-spend window (0xb63cf8bc…),
#220 shim-fed window (0xb61862a6…). Groth16Verifier reused, proof pipeline
byte-identical.

⚠️ VerglasGate on Dispatch: redeploy pending — the Dispatch public RPC was
down (blockNumber=0, state methods 500) during the wave. Until the new Gate
ships, the v2 Gate keeps trusting the OLD Hub, so cross-chain clearance
reflects v2 attestations only.

---

# Historical: Fuji Deployment v2 (2026-07-16, superseded)

The stand-ins are gone: this deployment runs on the canonical ERC-8004
registries and real Circle USDC, and adds the V2 vertical — a live
VerglasTreasurer paying FX-timed supplier payments through its own vault.

## Fuji C-Chain (43113) — v2

| Contract                    | Address                                      |
| --------------------------- | -------------------------------------------- |
| VerglasHub                  | 0xE963114E7549167b340dC05b173A2597bf14CC7C   |
| Groth16Verifier             | 0xD8A0b54325B52345E390A4B297bC0629000960DE   |
| VerglasAccount (demo)       | 0x8Ede2dB4a519B260944EE58125d6ecfA33CfaE72   |
| VerglasAccount (treasury)   | 0x135a08223c5aBEAb6F6482aB08E85086f6265981   |
| VerglasTreasurer            | 0xfEa6a384A7eAFA63760F3C00bB518d76A90491D3   |
| Identity Registry (canonical ERC-8004)   | 0x8004A818BFB912233c491871b3d84c89A494BD9e |
| Validation Registry (canonical ERC-8004) | 0x8004Cb1BF31DAf7788923b405b754f57acEB4272 |
| USDC (Circle official, 6 decimals)       | 0x5425890298aed601595a70AB815c96711a31Bc65 |
| Pyth                        | 0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509   |
| VerglasFactory (2026-07-18) | 0x770e72fcedadf61940e6e70630664f50ad8eac7b   |
| VerglasDispenser (2026-07-19, 2 USDC/24h) | 0x29C0Dd6DEf26BaC92FDB19DD338089A9396F0EDb |

Agent IDs are real ERC-721 tokens minted by the canonical Identity Registry:
**219** (demo account) and **220** (treasurer vault). Deploy block 0x3666514.
Pyth FX.USD/TRY feed id: 032a2eba1c2635bf973e95fb62b2c0705c1be2603b9572cc8d5edeaf8744e058.

## Dispatch L1 (779672) — v2

| Contract    | Address                                      |
| ----------- | -------------------------------------------- |
| VerglasGate | 0xa24972871B987cC7feD401Ea8e46F6D85F88a24C   |

Gate parameters unchanged: minScore=100, maxAge=7 days, trusts the v2 Hub.

## The v2 live run (2026-07-16)

- Agent 219, window (0xA1,3e6)(0xB2,2e6)(0xA1,1e6) in real USDC, proof
  verified on-chain by submitProof, and the response written into the
  **canonical** ERC-8004 Validation Registry (score 100,
  tag verglas:policy-compliance) — the first ZK-verified validation
  response on that registry.
- Treasurer: one-shot keeper tick executed a live payFX — Hermes USD/TRY
  47.0523, owner reference 47.05211, deviation ~0.4bps under the 200bps
  breaker, 1 USDC paid inside the 10 USDC daily epoch cap
  (tx 0x568869caad6ad62227cb58ac3bee2d1b6265a3e87918524fafe97a3984197574).
- ICM carry to Dispatch: tx 0x377dd7c7... then 0x0cbf9f0f... — public
  relayer delivery pending at the time of writing (was instant on 07-12;
  see the note below).

## Notes (v2)

- The deployer must hold faucet USDC before running either deploy script
  (faucet.circle.com, ~10-20 USDC per day).
- carryAttestation must be sent via cast send (not inside a forge script):
  Foundry's local EVM cannot execute the Warp precompile Teleporter writes to.
- REFERENCE_RATE env on DeployTreasurerFuji seeds the FX breaker anchor —
  set it from a fresh Hermes read on demo day.

---

# Historical: Fuji Deployment v1 (2026-07-12, superseded)

First live end-to-end run of the M1 pipeline: real spends on Fuji C-Chain,
Groth16 policy-compliance proof verified on-chain, ERC-8004 validation
stamped (on Verglas's own registry deploy — v2 moved to the canonical one),
attestation carried to the Dispatch L1 over ICM, gate clearance
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
