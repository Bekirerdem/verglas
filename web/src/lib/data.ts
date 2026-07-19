import { erc20Abi, parseAbiItem, type Address, type Hex, type PublicClient } from "viem";
import {
  FUJI_DEPLOYMENT,
  TREASURER_DEPLOYMENT,
  pythAbi,
  validationRegistryAbi,
  verglasAccountAbi,
  verglasFactoryAbi,
  verglasGateAbi,
  verglasTreasurerAbi,
  VerglasClient,
  type AccountState,
  type Attestation,
} from "@verglas/sdk";

const spendEvent = parseAbiItem(
  "event Spend(address indexed to, uint256 amount, uint256 indexed txIndex, uint256 newCommitment)",
);
const accountBoundEvent = parseAbiItem("event AccountBound(uint256 indexed agentId, address indexed account)");
const ownerWithdrawEvent = parseAbiItem("event OwnerWithdraw(address indexed to, uint256 amount)");
const frozenEvent = parseAbiItem("event Frozen()");
const unfrozenEvent = parseAbiItem("event Unfrozen()");
const erc20TransferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export type HistoryKind = "spend" | "withdraw" | "deposit" | "freeze" | "thaw";

export interface HistoryItem {
  kind: HistoryKind;
  amount: bigint | null;
  counterparty: Address | null;
  timestamp: bigint;
  txHash: Hex;
}
const carriedEvent = parseAbiItem(
  "event AttestationCarried(uint256 indexed agentId, bytes32 indexed destinationBlockchainID, address gate, bytes32 messageID)",
);

export interface Stamp {
  requestHash: Hex;
  score: number;
  tag: string;
  lastUpdate: bigint;
}

export interface SpendEvent {
  to: Address;
  amount: bigint;
  txIndex: bigint;
  newCommitment: bigint;
  txHash: Hex;
  timestamp: bigint;
}

export interface CarriedEvent {
  destinationBlockchainID: Hex;
  gate: Address;
  messageID: Hex;
  txHash: Hex;
  timestamp: bigint;
}

export interface DashboardData {
  account: AccountState;
  balance: bigint;
  attestation: Attestation | null;
  stamps: Stamp[];
  spends: SpendEvent[];
  carried: CarriedEvent[];
  cleared: boolean;
  gateMaxAge: bigint;
  fetchedAt: number;
}

const client = VerglasClient.fuji();
const D = FUJI_DEPLOYMENT;

/** Full-history scan from the deploy block: public RPCs cap eth_getLogs
    ranges (~2048 blocks), so chunk and run in bounded parallel batches.
    Fine at M1 scale; an indexer replaces this in M2. */
const CHUNK = 2_000n;
const PARALLEL = 12;

async function scanLogs<T>(
  chain: PublicClient,
  fetchChunk: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
): Promise<T[]> {
  const head = await chain.getBlockNumber();
  const ranges: Array<[bigint, bigint]> = [];
  for (let b = D.deployBlock; b <= head; b += CHUNK) {
    ranges.push([b, b + CHUNK - 1n < head ? b + CHUNK - 1n : head]);
  }
  const out: T[] = [];
  for (let i = 0; i < ranges.length; i += PARALLEL) {
    const part = await Promise.all(ranges.slice(i, i + PARALLEL).map(([f, t]) => fetchChunk(f, t)));
    out.push(...part.flat());
  }
  return out;
}

const blockTimeCache = new Map<bigint, Promise<bigint>>();
function blockTime(chain: PublicClient, blockNumber: bigint): Promise<bigint> {
  let hit = blockTimeCache.get(blockNumber);
  if (!hit) {
    hit = chain.getBlock({ blockNumber }).then((b) => b.timestamp);
    blockTimeCache.set(blockNumber, hit);
  }
  return hit;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const chain = client.hubChain;

  const [account, attestation, cleared, balance, requestHashes, gateMaxAge] = await Promise.all([
    client.getAccountState(),
    client.getAttestation(D.agentId),
    client.isCleared(D.agentId).catch(() => false),
    chain.readContract({
      address: D.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [D.account],
    }),
    chain.readContract({
      address: D.validationRegistry,
      abi: validationRegistryAbi,
      functionName: "getAgentValidations",
      args: [D.agentId],
    }),
    client
      .gateChain!.readContract({ address: D.gateOnDispatch, abi: verglasGateAbi, functionName: "maxAge" })
      .then((v) => BigInt(v))
      .catch(() => 0n),
  ]);

  // Stamp shelf comes from the registry (full history), not from log scans.
  const stamps = (
    await Promise.all(
      requestHashes.map(async (requestHash) => {
        const s = await client.getValidationStatus(requestHash);
        return { requestHash, score: s.response, tag: s.tag, lastUpdate: s.lastUpdate };
      }),
    )
  ).filter((s) => s.lastUpdate > 0n);

  const [spendLogs, carriedLogs] = await Promise.all([
    scanLogs(chain, (fromBlock, toBlock) =>
      chain.getLogs({ address: D.account, event: spendEvent, fromBlock, toBlock }),
    ),
    scanLogs(chain, (fromBlock, toBlock) =>
      chain.getLogs({ address: D.hub, event: carriedEvent, fromBlock, toBlock }),
    ),
  ]);

  const spends: SpendEvent[] = await Promise.all(
    spendLogs.map(async (log) => ({
      to: log.args.to!,
      amount: log.args.amount!,
      txIndex: log.args.txIndex!,
      newCommitment: log.args.newCommitment!,
      txHash: log.transactionHash,
      timestamp: await blockTime(chain, log.blockNumber),
    })),
  );
  spends.sort((a, b) => (a.txIndex < b.txIndex ? 1 : -1));

  const carried: CarriedEvent[] = await Promise.all(
    carriedLogs.map(async (log) => ({
      destinationBlockchainID: log.args.destinationBlockchainID!,
      gate: log.args.gate!,
      messageID: log.args.messageID!,
      txHash: log.transactionHash,
      timestamp: await blockTime(chain, log.blockNumber),
    })),
  );
  carried.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return {
    account,
    balance,
    attestation,
    stamps,
    spends,
    carried,
    cleared,
    gateMaxAge,
    fetchedAt: Date.now(),
  };
}

/** Public client for the hub chain — the console's write flows wait for receipts here. */
export const hubChain = client.hubChain;

export interface VaultState {
  owner: Address;
  agent: Address;
  perTxLimit: bigint;
  totalBudget: bigint;
  totalSpent: bigint;
  txCount: bigint;
  frozen: boolean;
  whitelist: Address[];
}

export interface VaultView {
  /** null for factory-born vaults that have no ERC-8004 identity yet. */
  agentId: bigint | null;
  account: Address;
  state: VaultState;
  balance: bigint;
  stamps: Stamp[];
  spends: SpendEvent[];
  carried: CarriedEvent[];
  history: HistoryItem[];
  attestation: Attestation | null;
  cleared: boolean;
  gateMaxAge: bigint;
  fetchedAt: number;
}

/** One shape for any vault — the known agents (#219/#220) and factory-born
    vaults (agentId null: no 8004 surface to query yet) both read through this. */
export async function fetchVaultView(account: Address, agentId: bigint | null): Promise<VaultView> {
  const chain = client.hubChain;
  const acct = { address: account, abi: verglasAccountAbi } as const;

  // Factory-born vaults may have been bound to an identity via the console's
  // "open the stamp line" flow — discover the agentId from the Hub's records.
  if (agentId === null) {
    const bound = await scanLogs(chain, (fromBlock, toBlock) =>
      chain.getLogs({ address: D.hub, event: accountBoundEvent, args: { account }, fromBlock, toBlock }),
    );
    if (bound.length > 0) agentId = bound[bound.length - 1].args.agentId!;
  }

  const [
    owner,
    agentAddr,
    perTxLimit,
    totalBudget,
    totalSpent,
    txCount,
    frozen,
    wlLen,
    balance,
    attestation,
    cleared,
    requestHashes,
    gateMaxAge,
  ] = await Promise.all([
    chain.readContract({ ...acct, functionName: "owner" }),
    chain.readContract({ ...acct, functionName: "agent" }),
    chain.readContract({ ...acct, functionName: "perTxLimit" }),
    chain.readContract({ ...acct, functionName: "totalBudget" }),
    chain.readContract({ ...acct, functionName: "totalSpent" }),
    chain.readContract({ ...acct, functionName: "txCount" }),
    chain.readContract({ ...acct, functionName: "frozen" }),
    chain.readContract({ ...acct, functionName: "whitelistLength" }),
    chain.readContract({ address: D.usdc, abi: erc20Abi, functionName: "balanceOf", args: [account] }),
    agentId === null ? Promise.resolve(null) : client.getAttestation(agentId).catch(() => null),
    agentId === null ? Promise.resolve(false) : client.isCleared(agentId).catch(() => false),
    agentId === null
      ? Promise.resolve([] as readonly Hex[])
      : chain.readContract({
          address: D.validationRegistry,
          abi: validationRegistryAbi,
          functionName: "getAgentValidations",
          args: [agentId],
        }),
    agentId === null
      ? Promise.resolve(0n)
      : client
          .gateChain!.readContract({ address: D.gateOnDispatch, abi: verglasGateAbi, functionName: "maxAge" })
          .then((v) => BigInt(v))
          .catch(() => 0n),
  ]);

  const whitelist = await Promise.all(
    Array.from({ length: Number(wlLen) }, (_, i) =>
      chain.readContract({ ...acct, functionName: "whitelist", args: [BigInt(i)] }),
    ),
  );

  const stamps = (
    await Promise.all(
      requestHashes.map(async (requestHash) => {
        const s = await client.getValidationStatus(requestHash);
        return { requestHash, score: s.response, tag: s.tag, lastUpdate: s.lastUpdate };
      }),
    )
  ).filter((s) => s.lastUpdate > 0n);

  const [spendLogs, carriedLogs, lifecycleLogs, depositLogs] = await Promise.all([
    scanLogs(chain, (fromBlock, toBlock) =>
      chain.getLogs({ address: account, event: spendEvent, fromBlock, toBlock }),
    ),
    agentId === null
      ? Promise.resolve([])
      : scanLogs(chain, (fromBlock, toBlock) =>
          chain.getLogs({ address: D.hub, event: carriedEvent, args: { agentId }, fromBlock, toBlock }),
        ),
    scanLogs(chain, (fromBlock, toBlock) =>
      chain.getLogs({
        address: account,
        events: [ownerWithdrawEvent, frozenEvent, unfrozenEvent],
        fromBlock,
        toBlock,
      }),
    ),
    scanLogs(chain, (fromBlock, toBlock) =>
      chain.getLogs({ address: D.usdc, event: erc20TransferEvent, args: { to: account }, fromBlock, toBlock }),
    ),
  ]);

  const spends: SpendEvent[] = await Promise.all(
    spendLogs.map(async (log) => ({
      to: log.args.to!,
      amount: log.args.amount!,
      txIndex: log.args.txIndex!,
      newCommitment: log.args.newCommitment!,
      txHash: log.transactionHash,
      timestamp: await blockTime(chain, log.blockNumber),
    })),
  );
  spends.sort((a, b) => (a.txIndex < b.txIndex ? 1 : -1));

  const carried: CarriedEvent[] = await Promise.all(
    carriedLogs.map(async (log) => ({
      destinationBlockchainID: log.args.destinationBlockchainID!,
      gate: log.args.gate!,
      messageID: log.args.messageID!,
      txHash: log.transactionHash,
      timestamp: await blockTime(chain, log.blockNumber),
    })),
  );
  carried.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  // One chronological feed: payments, deposits, withdrawals, brake events.
  const history: HistoryItem[] = await Promise.all([
    ...spends.map(async (s) => ({
      kind: "spend" as const,
      amount: s.amount,
      counterparty: s.to,
      timestamp: s.timestamp,
      txHash: s.txHash,
    })),
    ...lifecycleLogs.map(async (log) => {
      const timestamp = await blockTime(chain, log.blockNumber);
      if (log.eventName === "OwnerWithdraw") {
        return {
          kind: "withdraw" as const,
          amount: log.args.amount!,
          counterparty: log.args.to!,
          timestamp,
          txHash: log.transactionHash,
        };
      }
      return {
        kind: log.eventName === "Frozen" ? ("freeze" as const) : ("thaw" as const),
        amount: null,
        counterparty: null,
        timestamp,
        txHash: log.transactionHash,
      };
    }),
    ...depositLogs.map(async (log) => ({
      kind: "deposit" as const,
      amount: log.args.value!,
      counterparty: log.args.from!,
      timestamp: await blockTime(chain, log.blockNumber),
      txHash: log.transactionHash,
    })),
  ]);
  history.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  return {
    agentId,
    account,
    state: {
      owner,
      agent: agentAddr,
      perTxLimit,
      totalBudget,
      totalSpent,
      txCount,
      frozen,
      whitelist: whitelist as Address[],
    },
    balance,
    stamps,
    spends,
    carried,
    history,
    attestation,
    cleared,
    gateMaxAge,
    fetchedAt: Date.now(),
  };
}

/** Factory-born vaults of a wallet — the console's "my vaults" list. */
export function fetchMyVaults(owner: Address): Promise<readonly Address[]> {
  return client.hubChain.readContract({
    address: FUJI_DEPLOYMENT.factory,
    abi: verglasFactoryAbi,
    functionName: "vaultsOf",
    args: [owner],
  });
}

const fxPaymentEvent = parseAbiItem(
  "event FxPayment(address indexed supplier, uint256 amount, uint256 rateUsdTry, uint256 indexed day)",
);

export interface FxPaymentEvent {
  supplier: Address;
  amount: bigint;
  rateUsdTry: bigint;
  txHash: Hex;
  timestamp: bigint;
}

export interface TreasurerData {
  agentId: bigint;
  operator: Address;
  paused: boolean;
  dailyLimit: bigint;
  maxSlippageBps: number;
  referenceRateUsdTry: bigint;
  spentToday: bigint;
  vaultBalance: bigint;
  vaultFrozen: boolean;
  vaultTxCount: bigint;
  /** Live Pyth USD/TRY, normalized to 1e8 like the policy reference. */
  pythRateUsdTry: bigint;
  pythPublishTime: bigint;
  payments: FxPaymentEvent[];
}

const T = TREASURER_DEPLOYMENT;
const RATE_TARGET_EXPO = -8;

export async function fetchTreasurer(): Promise<TreasurerData> {
  const chain = client.hubChain;

  const [policy, spentToday, paused, operator, vaultBalance, vaultFrozen, vaultTxCount, pythPrice, fxLogs] =
    await Promise.all([
      chain.readContract({ address: T.treasurer, abi: verglasTreasurerAbi, functionName: "policy" }),
      chain.readContract({ address: T.treasurer, abi: verglasTreasurerAbi, functionName: "spentToday" }),
      chain.readContract({ address: T.treasurer, abi: verglasTreasurerAbi, functionName: "paused" }),
      chain.readContract({ address: T.treasurer, abi: verglasTreasurerAbi, functionName: "operator" }),
      chain.readContract({ address: D.usdc, abi: erc20Abi, functionName: "balanceOf", args: [T.account] }),
      chain.readContract({ address: T.account, abi: verglasAccountAbi, functionName: "frozen" }),
      chain.readContract({ address: T.account, abi: verglasAccountAbi, functionName: "txCount" }),
      chain.readContract({
        address: T.pyth,
        abi: pythAbi,
        functionName: "getPriceUnsafe",
        args: [T.usdTryPriceId],
      }),
      scanLogs(chain, (fromBlock, toBlock) =>
        chain.getLogs({ address: T.treasurer, event: fxPaymentEvent, fromBlock, toBlock }),
      ),
    ]);

  const payments: FxPaymentEvent[] = await Promise.all(
    fxLogs.map(async (log) => ({
      supplier: log.args.supplier!,
      amount: log.args.amount!,
      rateUsdTry: log.args.rateUsdTry!,
      txHash: log.transactionHash,
      timestamp: await blockTime(chain, log.blockNumber),
    })),
  );
  payments.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  const [price, , expo, publishTime] = pythPrice;
  const shift = expo - RATE_TARGET_EXPO;
  const raw = BigInt(price);
  const pythRateUsdTry = shift >= 0 ? raw * 10n ** BigInt(shift) : raw / 10n ** BigInt(-shift);

  return {
    agentId: T.agentId,
    operator,
    paused,
    dailyLimit: policy[0],
    maxSlippageBps: policy[1],
    referenceRateUsdTry: policy[2],
    spentToday,
    vaultBalance,
    vaultFrozen,
    vaultTxCount,
    pythRateUsdTry,
    pythPublishTime: publishTime,
    payments,
  };
}
