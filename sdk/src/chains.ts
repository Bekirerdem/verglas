import { defineChain, type Chain } from "viem";
import { avalanche, avalancheFuji } from "viem/chains";

/** Fuji C-Chain (43113) — where the Verglas Hub lives on testnet. */
export const fujiC = avalancheFuji;

/** Avalanche C-Chain (43114) — mainnet. */
export const avalancheC = avalanche;

/** Dispatch test L1 (779672) — the demo's second chain until its public RPC
 *  died on 2026-07-30 (blockNumber 0, state calls 500). Kept for the day it
 *  comes back; the live gate moved to Echo. */
export const dispatch = defineChain({
  id: 779672,
  name: "Dispatch Testnet",
  nativeCurrency: { name: "Dispatch", symbol: "DIS", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://subnets.avax.network/dispatch/testnet/rpc"] },
  },
  testnet: true,
});

/** Echo test L1 (173750) — the live second chain of the demo. */
export const echo = defineChain({
  id: 173750,
  name: "Echo Testnet",
  nativeCurrency: { name: "Echo", symbol: "ECH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://subnets.avax.network/echo/testnet/rpc"] },
  },
  testnet: true,
});

/**
 * Avalanche blockchain IDs (bytes32) used as ICM source/destination.
 * Read from the Warp precompile (0x02...05 getBlockchainID) on 2026-07-12
 * (echo: 2026-07-31) — do not trust third-party listings for these.
 */
export const BLOCKCHAIN_IDS = {
  fujiC: "0x7fc93d85c6d62c5b2ac0b519c87010ea5294012d1e407030d6acd0021cac10d5",
  dispatch: "0x9f3be606497285d0ffbb5ac9ba24aa60346a9b1812479ed66cb329f394a4b1c7",
  echo: "0x1278d1be4b987e847be3465940eb5066c4604a7fbd6e086900823597d81af4c1",
} as const;

/** Canonical TeleporterMessenger, same address on every Avalanche EVM chain. */
export const TELEPORTER_ADDRESS = "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf" as const;

/**
 * Canonical ERC-8004 Identity Registry on Fuji (vanity CREATE2 deployment).
 * Verglas agentIds are real ERC-721 tokens minted here.
 *
 * ⚠️ The canonical registries use a DIFFERENT vanity address per network — the
 * mainnet one is not this address (see IDENTITY_REGISTRY_MAINNET). Always read
 * the address from the network registry rather than assuming one is global.
 */
export const IDENTITY_REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;

/**
 * Canonical ERC-8004 Identity Registry on Avalanche C-Chain MAINNET. Verified
 * live on 2026-07-30: name() = "AgentIdentity", owner = the 8004 reference
 * team, register() returns the next agentId (1783 at the time of checking).
 * Source: erc-8004/erc-8004-contracts README.
 */
export const IDENTITY_REGISTRY_MAINNET = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;

/**
 * Canonical ERC-8004 Reputation Registry on Avalanche mainnet (live, unused by
 * Verglas today — recorded so the mainnet picture is complete).
 */
export const REPUTATION_REGISTRY_MAINNET = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as const;

/** Circle's official USDC on Avalanche C-Chain mainnet, 6 decimals. */
export const USDC_MAINNET = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" as const;

/** Live Fuji v4 deployment of 2026-07-31 (see deployments/fuji-testnet.md).
 *  v4 = the attestation–vault binding pass: the packet carries WHICH vault was
 *  proven and rebinding an identity to a different vault invalidates its
 *  attestation (v3 was the bindAccount ownership fix + oracle shim). */
export const FUJI_DEPLOYMENT = {
  hub: "0xBDC5eca7253caC347Cf690Ead10dfFda0284A9d5",
  /** The canonical ERC-8004 Validation Registry — not a Verglas deployment. */
  validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
  verifier: "0xD8A0b54325B52345E390A4B297bC0629000960DE",
  account: "0x8Ede2dB4a519B260944EE58125d6ecfA33CfaE72",
  /** Circle's official Fuji USDC, 6 decimals. */
  usdc: "0x5425890298aed601595a70AB815c96711a31Bc65",
  agentId: 219n,
  /** C-Chain block of the deployment — the earliest block worth scanning for events. */
  deployBlock: 0x3666514n,
  /** VerglasFactory (2026-07-30, refillable-budget vaults) — the console's
   *  "create your vault" door. */
  factory: "0x54Ea4db6Ba394B5853BB2271c8C1838549c7aE2B",
  /** Earlier factories whose vaults must stay visible in "my vaults" —
   *  their VerglasAccounts have an immutable budget (no refuel). */
  legacyFactories: ["0x770e72fcedadf61940e6e70630664f50ad8eac7b"],
  /** VerglasDispenser (2026-07-19) — workshop USDC tap, 2 USDC / 24h. */
  dispenser: "0x29C0Dd6DEf26BaC92FDB19DD338089A9396F0EDb",
} as const;

/** The V2 vertical: the treasurer and its own vault + canonical agentId. */
export const TREASURER_DEPLOYMENT = {
  treasurer: "0xf9098c210C5918F7dE01aA7E96b997C819Fb4614",
  account: "0xec9fb95C029980B80F63FfA27c20b98f586c564c",
  agentId: 220n,
  /** IPyth-compatible price source. Since the July 2026 Pyth cutover this is
   *  the VerglasOracle shim (keeper-signed independent FX sources), kept under
   *  the same field name because every consumer reads it through the IPyth ABI. */
  pyth: "0x11a5Bd2295B316eEB53101cdB8B16D7A61A3bF4E",
  /** USD/TRY feed id (Pyth's id kept as the shim's storage key). */
  usdTryPriceId: "0x032a2eba1c2635bf973e95fb62b2c0705c1be2603b9572cc8d5edeaf8744e058",
} as const;

/** A Verglas deployment, whatever chain it sits on. Mirrors FUJI_DEPLOYMENT's
 *  shape so a consumer written against one network works on the other. */
type Hex40 = `0x${string}`;

export interface VerglasDeployment {
  hub: Hex40;
  validationRegistry: Hex40;
  identityRegistry: Hex40;
  verifier: Hex40;
  usdc: Hex40;
  factory: Hex40;
  legacyFactories: readonly Hex40[];
  /** Earliest block worth scanning for this deployment's events. */
  deployBlock: bigint;
  /** Showcase vault + agent the console lists for visitors, if any. */
  account?: Hex40;
  agentId?: bigint;
  /** The treasurer vertical, when deployed on this network. */
  treasurer?: {
    treasurer: Hex40;
    account: Hex40;
    agentId: bigint;
    pyth: Hex40;
    usdTryPriceId: Hex40;
  };
  /** Workshop USDC tap — testnet only. */
  dispenser?: Hex40;
  /** A VerglasGate on a second L1, when one is live. Clients build their gate
   *  reads from `chain` and their links from `explorer` — nothing outside this
   *  entry may assume which L1 the gate sits on. */
  gate?: {
    address: Hex40;
    blockchainId: Hex40;
    chainLabel: string;
    chain: Chain;
    explorer: string;
    /** No relayer serves this lane — whoever sends a carry must also collect
     *  the Warp signatures and submit `receiveCrossChainMessage` on the gate
     *  chain itself (see deployments/fuji-testnet.md, "self-deliver"). */
    selfDeliver?: boolean;
  };
}

/** One network Verglas can run on. `deployment: null` means "supported by the
 *  code, not deployed yet" — the console offers it but marks it unavailable
 *  instead of pretending addresses exist. */
export interface VerglasNetwork {
  key: "fuji" | "avalanche";
  label: string;
  /** Short human tag the UI shows next to the balance ("Test ortamı"). */
  kind: "testnet" | "mainnet";
  chain: typeof avalancheFuji | typeof avalanche;
  explorer: string;
  deployment: VerglasDeployment | null;
}

export const NETWORKS: Record<VerglasNetwork["key"], VerglasNetwork> = {
  fuji: {
    key: "fuji",
    label: "Fuji",
    kind: "testnet",
    chain: avalancheFuji,
    explorer: "https://testnet.snowtrace.io",
    deployment: {
      hub: FUJI_DEPLOYMENT.hub,
      validationRegistry: FUJI_DEPLOYMENT.validationRegistry,
      identityRegistry: IDENTITY_REGISTRY_ADDRESS,
      verifier: FUJI_DEPLOYMENT.verifier,
      usdc: FUJI_DEPLOYMENT.usdc,
      factory: FUJI_DEPLOYMENT.factory,
      legacyFactories: FUJI_DEPLOYMENT.legacyFactories,
      deployBlock: FUJI_DEPLOYMENT.deployBlock,
      account: FUJI_DEPLOYMENT.account,
      agentId: FUJI_DEPLOYMENT.agentId,
      treasurer: {
        treasurer: TREASURER_DEPLOYMENT.treasurer,
        account: TREASURER_DEPLOYMENT.account,
        agentId: TREASURER_DEPLOYMENT.agentId,
        pyth: TREASURER_DEPLOYMENT.pyth,
        usdTryPriceId: TREASURER_DEPLOYMENT.usdTryPriceId,
      },
      dispenser: FUJI_DEPLOYMENT.dispenser,
      // The Echo gate (2026-07-31). The old Dispatch gate
      // (0xa24972871B987cC7feD401Ea8e46F6D85F88a24C) trusts the pre-v4 Hub
      // and Dispatch's public RPC has been down since 2026-07-30 — retired.
      gate: {
        address: "0xD09c7baE6A2eE0E1E1C9443EF2a2791d8a97dc36",
        blockchainId: BLOCKCHAIN_IDS.echo,
        chainLabel: "Echo",
        chain: echo,
        explorer: "https://subnets-test.avax.network/echo",
        // The public relayer's Echo lane has been dead since May 2026.
        selfDeliver: true,
      },
    },
  },
  avalanche: {
    key: "avalanche",
    label: "Avalanche",
    kind: "mainnet",
    chain: avalanche,
    explorer: "https://snowtrace.io",
    // Live since 2026-07-30 (script/DeployMainnet.s.sol, block 91597965).
    // Identity comes from the canonical ERC-8004 registry already on mainnet;
    // Validation is ours because no chain has a canonical one (that spec
    // section is still being revised with the TEE community).
    deployment: {
      hub: "0x2b6466EC93C064f67C260c30613593460252169C",
      validationRegistry: "0x332fc886dd6ab933c89a1149e7D938a6B4214a01",
      identityRegistry: IDENTITY_REGISTRY_MAINNET,
      verifier: "0xa24972871B987cC7feD401Ea8e46F6D85F88a24C",
      usdc: USDC_MAINNET,
      factory: "0xc07ef259Eb88742e00113d9F460F5D2081078960",
      legacyFactories: [],
      deployBlock: 0x575ac8dn,
      // The first mainnet vault, shown to visitors so the console has
      // something real on it before they connect a wallet: agent #1783, two
      // USDC payments, one score-100 attestation.
      account: "0x004cd1dAc729a1E4A05e235A56985c368E94C3c5",
      agentId: 1783n,
      // The oracle lives at 0x31900CA6bBd05ac2516feB6798f6aeB86FD41239
      // (owner: the project wallet, keeper: the service key); it gets wired in
      // with the treasurer vertical, which is not on mainnet yet.
      // No gate either: cross-chain clearance is M3, per L1 operator.
    },
  },
};

export const DEFAULT_NETWORK: VerglasNetwork["key"] = "fuji";

export function networkOf(key: string | null | undefined): VerglasNetwork {
  return key === "avalanche" ? NETWORKS.avalanche : NETWORKS.fuji;
}
