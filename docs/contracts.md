# Contracts & Addresses

Live Fuji v2 deployment (2026-07-16). Everything below is real and verifiable on-chain — no stand-ins.

## Fuji C-Chain (43113)

| Contract | Address |
| --- | --- |
| VerglasHub | `0xE963114E7549167b340dC05b173A2597bf14CC7C` |
| Groth16Verifier | `0xD8A0b54325B52345E390A4B297bC0629000960DE` |
| VerglasAccount (demo vault) | `0x8Ede2dB4a519B260944EE58125d6ecfA33CfaE72` |
| VerglasAccount (treasury vault) | `0x135a08223c5aBEAb6F6482aB08E85086f6265981` |
| VerglasTreasurer | `0xfEa6a384A7eAFA63760F3C00bB518d76A90491D3` |

## Canonical infrastructure we build on

| Contract | Address |
| --- | --- |
| ERC-8004 Identity Registry (canonical) | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ERC-8004 Validation Registry (canonical) | `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |
| USDC (Circle official, 6 decimals) | `0x5425890298aed601595a70AB815c96711a31Bc65` |
| Pyth | `0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509` |
| TeleporterMessenger (every Avalanche EVM chain) | `0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf` |

Pyth `FX.USD/TRY` feed id: `0x032a2eba1c2635bf973e95fb62b2c0705c1be2603b9572cc8d5edeaf8744e058`

## Dispatch L1 (779672)

| Contract | Address |
| --- | --- |
| VerglasGate | `0xa24972871B987cC7feD401Ea8e46F6D85F88a24C` |

Gate parameters: `minScore = 100`, `maxAge = 7 days`, trusts the v2 hub on Fuji C-Chain (blockchain ID `0x7fc93d85…cac10d5`, read from the Warp precompile — don't trust third-party listings).

## Agent identities

Real ERC-721 tokens minted by the canonical Identity Registry: **#219** (demo vault) and **#220** (treasurer vault).

## Source

All contracts live in [`src/`](https://github.com/Bekirerdem/verglas) — Solidity 0.8.25, no proxies, no upgradability, custom errors, 57 Foundry tests. Deploy scripts under `script/`, full deployment history in `deployments/fuji-testnet.md`.
