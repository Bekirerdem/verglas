import { defineChain } from "viem";
import { avalancheFuji } from "viem/chains";

/** Fuji C-Chain (43113) — where the Verglas Hub lives on testnet. */
export const fujiC = avalancheFuji;

/** Dispatch test L1 (779672) — the second chain of the live M1 demo. */
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

/** Live Fuji deployment of 2026-07-12 (see deployments/fuji-testnet.md). */
export const FUJI_DEPLOYMENT = {
  hub: "0xc07ef259Eb88742e00113d9F460F5D2081078960",
  validationRegistry: "0x31900CA6bBd05ac2516feB6798f6aeB86FD41239",
  verifier: "0x2b6466EC93C064f67C260c30613593460252169C",
  account: "0x0b35C0c0f44f7Fd62e556D6AcAC00EA313546F45",
  testUsd: "0xa24972871B987cC7feD401Ea8e46F6D85F88a24C",
  devIdentity: "0x332fc886dd6ab933c89a1149e7D938a6B4214a01",
  gateOnDispatch: "0xD09c7baE6A2eE0E1E1C9443EF2a2791d8a97dc36",
  agentId: 1599n,
  /** C-Chain block of the deployment — the earliest block worth scanning for events. */
  deployBlock: 0x3651fb3n,
} as const;
