# Contracts & Addresses

Verglas runs on two networks. Everything below is real and verifiable on-chain — no stand-ins.

## Avalanche C-Chain mainnet (43114)

| Contract | Address |
| --- | --- |
| VerglasHub | `0x2b6466EC93C064f67C260c30613593460252169C` |
| ValidationRegistry (Verglas) | `0x332fc886dd6ab933c89a1149e7D938a6B4214a01` |
| Groth16Verifier | `0xa24972871B987cC7feD401Ea8e46F6D85F88a24C` |
| VerglasOracle | `0x31900CA6bBd05ac2516feB6798f6aeB86FD41239` |
| VerglasFactory | `0xc07ef259Eb88742e00113d9F460F5D2081078960` |
| ERC-8004 Identity Registry (canonical) | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| USDC (Circle official) | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` |

::: info Why our own Validation Registry?
Identity is the canonical ERC-8004 registry — already live on Avalanche mainnet,
and note it sits at a **different address than on Fuji** (the reference
deployment mines a separate vanity address per network). The Validation Registry
is a Verglas deployment because **no chain has a canonical one**: the reference
repository lists no Validation address for any network and that section of the
spec is still under revision with the TEE community. Ours is event- and
interface-compatible with ERC-8004.
:::

## Fuji testnet (43113)

| Contract | Address |
| --- | --- |
| VerglasHub | `0x17C273c8edEd16C5e9f7a7525f74AcE15bb5d81E` |
| VerglasOracle (keeper-signed price shim) | `0x11a5Bd2295B316eEB53101cdB8B16D7A61A3bF4E` |
| Groth16Verifier | `0xD8A0b54325B52345E390A4B297bC0629000960DE` |
| VerglasAccount (demo vault) | `0x8Ede2dB4a519B260944EE58125d6ecfA33CfaE72` |
| VerglasAccount (treasury vault) | `0xec9fb95C029980B80F63FfA27c20b98f586c564c` |
| VerglasTreasurer | `0xf9098c210C5918F7dE01aA7E96b997C819Fb4614` |
| VerglasFactory (refillable-budget vaults) | `0x54Ea4db6Ba394B5853BB2271c8C1838549c7aE2B` |

## Canonical infrastructure we build on

| Contract | Address |
| --- | --- |
| ERC-8004 Identity Registry (canonical) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 Validation Registry (canonical) | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |
| USDC (Circle official, 6 decimals) | `0x5425890298aed601595a70AB815c96711a31Bc65` |
| TeleporterMessenger (every Avalanche EVM chain) | `0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf` |

USD/TRY feed id (Pyth's id, kept as the VerglasOracle storage key):
`0x032a2eba1c2635bf973e95fb62b2c0705c1be2603b9572cc8d5edeaf8744e058`

::: info Why VerglasOracle instead of Pyth?
Pyth's free Hermes endpoint shut down with the July 2026 protocol migration.
VerglasOracle keeps the exact `IPyth` surface the treasurer was built against;
the keeper reads two independent public FX references (ECB via Frankfurter +
open.er-api.com), cross-checks them, and pushes a signed price the contract
verifies with `ecrecover`. Monotonic publish times, a future-skew bound and a
±10% deviation guard protect against bad source reads.
:::

## Dispatch L1 (779672)

| Contract | Address |
| --- | --- |
| VerglasGate | `0xa24972871B987cC7feD401Ea8e46F6D85F88a24C` (v2 — redeploy pending) |

Gate parameters: `minScore = 100`, `maxAge = 7 days`, trusts the Hub on Fuji C-Chain (blockchain ID `0x7fc93d85…cac10d5`, read from the Warp precompile — don't trust third-party listings). The v3 Gate redeploy was blocked by a Dispatch public-RPC outage during the wave; until it ships, this Gate still trusts the v2 Hub.

## Agent identities

Real ERC-721 tokens minted by the canonical Identity Registry: **#219** (demo vault) and **#220** (treasurer vault).

## Source

All contracts live in [`src/`](https://github.com/Bekirerdem/verglas) — Solidity 0.8.25, no proxies, no upgradability, custom errors, 86 Foundry tests. Deploy scripts under `script/`, full deployment history in `deployments/fuji-testnet.md`.
