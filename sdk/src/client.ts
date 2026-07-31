import {
  createPublicClient,
  encodeFunctionData,
  fallback,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { FUJI_DEPLOYMENT, fujiC, NETWORKS, type VerglasNetwork } from "./chains.js";
import { validationRegistryAbi, verglasAccountAbi, verglasGateAbi, verglasHubAbi } from "./abi.js";

export interface VerglasAddresses {
  hub: Address;
  validationRegistry: Address;
  /** Default account for getAccountState when none is passed. */
  account?: Address;
  /** Default gate (on the gate chain) for isCleared when none is passed. */
  gate?: Address;
}

export interface AccountState {
  owner: Address;
  agent: Address;
  token: Address;
  perTxLimit: bigint;
  totalBudget: bigint;
  totalSpent: bigint;
  txCount: bigint;
  commitment: bigint;
  frozen: boolean;
  whitelist: Address[];
}

export interface Attestation {
  /** The vault this attestation was proven for — populated once the Hub that
   *  carries it in the attestation is deployed (see abi.ts note). */
  account?: Address;
  requestHash: Hex;
  finalCommitment: bigint;
  txCount: bigint;
  score: number;
  issuedAt: bigint;
}

export interface Groth16Calldata {
  pA: readonly [bigint, bigint];
  pB: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  pC: readonly [bigint, bigint];
  publicSignals: readonly bigint[];
}

/**
 * Thin, typed access to the Verglas contracts. Reads need only public
 * clients; writes additionally need a viem WalletClient (with account
 * and chain set by the caller).
 */
export class VerglasClient {
  readonly hubChain: PublicClient;
  readonly gateChain?: PublicClient;
  readonly addresses: VerglasAddresses;
  readonly walletClient?: WalletClient;

  constructor(opts: {
    hubChain: PublicClient;
    gateChain?: PublicClient;
    addresses: VerglasAddresses;
    walletClient?: WalletClient;
  }) {
    this.hubChain = opts.hubChain;
    this.gateChain = opts.gateChain;
    this.addresses = opts.addresses;
    this.walletClient = opts.walletClient;
  }

  /** The live Fuji testnet deployment; the gate comes from the network
      registry (absent while no gate L1 is live). Reads go through a
      fallback transport: the official RPC rate-limits per IP (429), which
      would take the console down for a whole venue on shared wifi. */
  static fuji(opts?: { walletClient?: WalletClient }): VerglasClient {
    const gate = NETWORKS.fuji.deployment?.gate;
    return new VerglasClient({
      hubChain: createPublicClient({
        chain: fujiC,
        transport: fallback([
          // Fail fast: a rate-limited primary must hand over in seconds,
          // not stall reads behind minutes of retry backoff.
          http(undefined, { retryCount: 1, timeout: 4_000 }),
          http("https://avalanche-fuji-c-chain-rpc.publicnode.com", { retryCount: 1, timeout: 6_000 }),
          http("https://avalanche-fuji.drpc.org", { retryCount: 1, timeout: 6_000 }),
        ]),
        batch: { multicall: true },
      }),
      gateChain: gate ? createPublicClient({ chain: gate.chain, transport: http() }) : undefined,
      addresses: {
        hub: FUJI_DEPLOYMENT.hub,
        validationRegistry: FUJI_DEPLOYMENT.validationRegistry,
        account: FUJI_DEPLOYMENT.account,
        gate: gate?.address,
      },
      walletClient: opts?.walletClient,
    });
  }

  /** A client for any network in the SDK registry. Mainnet has no second-chain
      gate yet, so `gateChain` is only wired when the deployment declares one. */
  static forNetwork(network: VerglasNetwork, opts?: { walletClient?: WalletClient }): VerglasClient {
    if (network.key === "fuji") return VerglasClient.fuji(opts);
    const d = network.deployment;
    if (!d) throw new Error(`${network.label} has no Verglas deployment yet`);
    return new VerglasClient({
      hubChain: createPublicClient({
        chain: network.chain,
        transport: fallback([
          http(undefined, { retryCount: 1, timeout: 4_000 }),
          http("https://avalanche-c-chain-rpc.publicnode.com", { retryCount: 1, timeout: 6_000 }),
        ]),
        batch: { multicall: true },
      }),
      addresses: {
        hub: d.hub,
        validationRegistry: d.validationRegistry,
        account: d.account ?? d.hub,
        gate: d.gate?.address ?? "0x0000000000000000000000000000000000000000",
      },
      walletClient: opts?.walletClient,
    });
  }

  // ---- reads ----

  async getAccountState(account?: Address): Promise<AccountState> {
    const address = this.#require(account ?? this.addresses.account, "account");
    const abi = verglasAccountAbi;
    const read = <T,>(functionName: string, args: unknown[] = []) =>
      this.hubChain.readContract({ address, abi, functionName, args } as never) as Promise<T>;

    const [owner, agent, token, perTxLimit, totalBudget, totalSpent, txCount, commitment, frozen, wlLen] =
      await Promise.all([
        read<Address>("owner"),
        read<Address>("agent"),
        read<Address>("token"),
        read<bigint>("perTxLimit"),
        read<bigint>("totalBudget"),
        read<bigint>("totalSpent"),
        read<bigint>("txCount"),
        read<bigint>("commitment"),
        read<boolean>("frozen"),
        read<bigint>("whitelistLength"),
      ]);

    const whitelist = await Promise.all(
      Array.from({ length: Number(wlLen) }, (_, i) => read<Address>("whitelist", [BigInt(i)])),
    );

    return { owner, agent, token, perTxLimit, totalBudget, totalSpent, txCount, commitment, frozen, whitelist };
  }

  /** Latest Hub attestation for an agent, or null if none was ever issued. */
  async getAttestation(agentId: bigint): Promise<Attestation | null> {
    // Two Hub generations are live at once: the mainnet Hub records the vault
    // the attestation was proven for (6 fields), the older Fuji Hub does not
    // (5). Decoding by RETURN LENGTH keeps one code path working against both
    // and keeps working after Fuji is redeployed — no per-network config, and
    // no silent mis-decode (which is what a fixed ABI would do here).
    const data = await this.hubChain.call({
      to: this.addresses.hub,
      data: encodeFunctionData({ abi: verglasHubAbi, functionName: "latestAttestation", args: [agentId] }),
    });
    const raw = data.data ?? "0x";
    const words = (raw.length - 2) / 64;
    const at = (i: number) => `0x${raw.slice(2 + i * 64, 2 + (i + 1) * 64)}` as Hex;
    const num = (i: number) => BigInt(at(i));

    const hasAccount = words >= 6;
    const o = hasAccount ? 1 : 0;
    const issuedAt = num(o + 4);
    if (issuedAt === 0n) return null;
    return {
      account: hasAccount ? (`0x${at(0).slice(26)}` as Address) : undefined,
      requestHash: at(o),
      finalCommitment: num(o + 1),
      txCount: num(o + 2),
      score: Number(num(o + 3)),
      issuedAt,
    };
  }

  async getValidationStatus(requestHash: Hex) {
    const [validatorAddress, agentId, response, responseHash, tag, lastUpdate] = await this.hubChain.readContract({
      address: this.addresses.validationRegistry,
      abi: validationRegistryAbi,
      functionName: "getValidationStatus",
      args: [requestHash],
    });
    return { validatorAddress, agentId, response, responseHash, tag, lastUpdate };
  }

  /**
   * The L1 operator's one-liner: does this agent hold a fresh, sufficient
   * attestation at the gate? Queries the gate chain.
   */
  async isCleared(agentId: bigint, opts?: { gate?: Address; gateChain?: PublicClient }): Promise<boolean> {
    const gateChain = opts?.gateChain ?? this.gateChain;
    if (!gateChain) throw new Error("VerglasClient: no gate chain client configured");
    const gate = this.#require(opts?.gate ?? this.addresses.gate, "gate");
    return gateChain.readContract({
      address: gate,
      abi: verglasGateAbi,
      functionName: "isCleared",
      args: [agentId],
    });
  }

  // ---- writes (require walletClient) ----

  async spend(to: Address, amount: bigint, opts?: { account?: Address }): Promise<Hex> {
    const address = this.#require(opts?.account ?? this.addresses.account, "account");
    return this.#wallet().writeContract({
      address,
      abi: verglasAccountAbi,
      functionName: "spend",
      args: [to, amount],
    } as never);
  }

  async submitProof(opts: {
    agentId: bigint;
    requestHash: Hex;
    calldata: Groth16Calldata;
    responseURI: string;
    responseHash: Hex;
  }): Promise<Hex> {
    const { pA, pB, pC, publicSignals } = opts.calldata;
    if (publicSignals.length !== 12) throw new Error("VerglasClient: expected 12 public signals");
    return this.#wallet().writeContract({
      address: this.addresses.hub,
      abi: verglasHubAbi,
      functionName: "submitProof",
      args: [opts.agentId, opts.requestHash, pA, pB, pC, publicSignals, opts.responseURI, opts.responseHash],
    } as never);
  }

  async carryAttestation(agentId: bigint, destinationBlockchainID: Hex, gate: Address): Promise<Hex> {
    return this.#wallet().writeContract({
      address: this.addresses.hub,
      abi: verglasHubAbi,
      functionName: "carryAttestation",
      args: [agentId, destinationBlockchainID, gate],
    } as never);
  }

  #wallet(): WalletClient {
    if (!this.walletClient) throw new Error("VerglasClient: this operation requires a walletClient");
    return this.walletClient;
  }

  #require<T>(value: T | undefined, name: string): T {
    if (value === undefined) throw new Error(`VerglasClient: no ${name} address configured`);
    return value;
  }
}
