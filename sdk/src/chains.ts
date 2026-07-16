import { defineChain } from "viem";
import { avalancheFuji } from "viem/chains";

/** Fuji C-Chain (43113) — where the Verglas Hub lives on testnet. */
export const fujiC = avalancheFuji;

/** Dispatch test L1 (779672) — the second chain of the live demo. */
export const dispatch = defineChain({
  id: 779672,
  name: "Dispatch Testnet",
  nativeCurrency: { name: "Dispatch", symbol: "DIS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://subnets.avax.network/dispatch/testnet/rpc"] },
  },
  testnet: true,
});

/**
 * Avalanche blockchain IDs (bytes32) used as ICM source/destination.
 * Read from the Warp precompile (0x02...05 getBlockchainID) on 2026-07-12 —
 * do not trust third-party listings for these.
 */
export const BLOCKCHAIN_IDS = {
  fujiC: "0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5",
  dispatch: "0x9f3be606497285d0ffbb5ac9ba24aa60346a9b1812479ed66cb329f394a4b1c7",
} as const;

/** Canonical TeleporterMessenger, same address on every Avalanche EVM chain. */
export const TELEPORTER_ADDRESS = "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf" as const;

/**
 * Canonical ERC-8004 Identity Registry on Fuji (vanity CREATE2 deployment).
 * Verglas agentIds are real ERC-721 tokens minted here; the SDK never calls
 * it directly, but every consumer should know where identities come from.
 */
export const IDENTITY_REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;

/** Live Fuji v2 deployment of 2026-07-16 (see deployments/fuji-testnet.md). */
export const FUJI_DEPLOYMENT = {
  hub: "0xE963114E7549167b340dC05b173A2597bf14CC7C",
  /** The canonical ERC-8004 Validation Registry — not a Verglas deployment. */
  validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
  verifier: "0xD8A0b54325B52345E390A4B297bC0629000960DE",
  account: "0x8Ede2dB4a519B260944EE58125d6ecfA33CfaE72",
  /** Circle's official Fuji USDC, 6 decimals. */
  usdc: "0x5425890298aed601595a70AB815c96711a31Bc65",
  gateOnDispatch: "0xa24972871B987cC7feD401Ea8e46F6D85F88a24C",
  agentId: 219n,
  /** C-Chain block of the deployment — the earliest block worth scanning for events. */
  deployBlock: 0x3666514n,
} as const;

/** The V2 vertical: the treasurer and its own vault + canonical agentId. */
export const TREASURER_DEPLOYMENT = {
  treasurer: "0xfEa6a384A7eAFA63760F3C00bB518d76A90491D3",
  account: "0x135a08223c5aBEAb6F6482aB08E85086f6265981",
  agentId: 220n,
  /** Pyth price-feed contract on Fuji. */
  pyth: "0x23f0e8FAeE7bbb405E7A7C3d60138FCfd43d7509",
  /** Pyth FX.USD/TRY price feed id. */
  usdTryPriceId: "0x032a2eba1c2635bf973e95fb62b2c0705c1be2603b9572cc8d5edeaf8744e058",
} as const;
