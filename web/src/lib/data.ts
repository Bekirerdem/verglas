import {
  createPublicClient,
  erc20Abi,
  fallback,
  http,
  parseAbiItem,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import {
  identityRegistryAbi,
  pythAbi,
  validationRegistryAbi,
  verglasAccountAbi,
  verglasFactoryAbi,
  verglasGateAbi,
  verglasHubAbi,
  verglasTreasurerAbi,
  VerglasClient,
  type AccountState,
  type Attestation,
} from "@verglas/sdk";
import { DEPLOYMENT, NET, SHOWCASE_ACCOUNT, SHOWCASE_AGENT_ID, TREASURER } from "./network";

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

/** The newest scored stamp. The registry lists requests in creation order, so
 *  a plain `.find()` returns the OLDEST stamp once an agent has re-attested. */
export function latestStamp(stamps: Stamp[]): Stamp | undefined {
  return stamps
    .filter((s) => s.score > 0)
    .reduce<Stamp | undefined>((best, s) => (!best || s.lastUpdate > best.lastUpdate ? s : best), undefined);
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

// Every address and chain below comes from the network selected at page load
// (see lib/network.ts) — the console is network-agnostic; switching reloads.
const client = VerglasClient.forNetwork(NET);
const D = {
  ...DEPLOYMENT,
  gateOnDispatch: DEPLOYMENT.gate?.address ?? "0x0000000000000000000000000000000000000000",
} as const;

/** History scanning (M1, pre-indexer). Three rules keep the console
    responsive and the visitor's devtools clean:
    1. The scan NEVER blocks a paint — fetchVaultView resolves from point
       reads plus whatever the store already holds; the scan extends the
       store in the background and re-delivers through a callback.
    2. Each vault has a persistent per-browser log store: the historical
       range is scanned once, then every refresh only extends it from
       scannedTo to head — a couple of requests instead of hundreds.
    3. A failed or over-budget scan halts at the last fully ingested
       chunk and resumes on the next refresh; history never rejects the
       whole view. */
const CHUNK = 2_000n; // public RPC caps eth_getLogs ranges (~2048 blocks)
const SCAN_BUDGET_MS = 8_000; // per refresh cycle; the scan never blocks a paint
const CHUNK_PAUSE_MS = 120; // breathing room between chunks (per-IP 429 limit)
const LOG_CACHE_V = 1;

// getLogs prefers the official RPC but must survive its outages: the
// endpoint intermittently drops browser traffic with CORS-less error
// responses (every request surfaces as ERR_FAILED), which used to kill
// history entirely. publicnode handles our small 2k-block chunks; its
// rare 500 just halts the scan until the next refresh.
const logsChain = createPublicClient({
  chain: NET.chain,
  transport: fallback([
    http(undefined, { retryCount: 0, timeout: 10_000 }),
    http(
      NET.key === "fuji"
        ? "https://avalanche-fuji-c-chain-rpc.publicnode.com"
        : "https://avalanche-c-chain-rpc.publicnode.com",
      { retryCount: 0, timeout: 10_000 },
    ),
  ]),
});

interface VaultLogs {
  creationBlock: bigint;
  /** Last block whose logs are fully in the store (inclusive). */
  scannedTo: bigint;
  /** Discovered via AccountBound for factory vaults; null until bound. */
  agentId: bigint | null;
  spends: SpendEvent[];
  carried: CarriedEvent[];
  history: HistoryItem[];
}

const logStores = new Map<string, VaultLogs>();
const storeKey = (account: Address) => `vg-logs-${LOG_CACHE_V}-${account.toLowerCase()}`;
const BIG = "#bigint:";
/** Written by the activation flow so this browser never has to rediscover
    its own vault's agentId from logs. */
export const agentHintKey = (account: Address) => `vg-agent-hint-${account.toLowerCase()}`;

function saveVaultLogs(account: Address, store: VaultLogs): void {
  try {
    localStorage.setItem(
      storeKey(account),
      JSON.stringify(store, (_k, v: unknown) => (typeof v === "bigint" ? BIG + v.toString() : v)),
    );
  } catch {
    // quota / private mode — the in-memory store still covers this session
  }
}

function loadVaultLogs(account: Address): VaultLogs | null {
  try {
    const raw = localStorage.getItem(storeKey(account));
    if (!raw) return null;
    return JSON.parse(raw, (_k, v: unknown) =>
      typeof v === "string" && v.startsWith(BIG) ? BigInt(v.slice(BIG.length)) : v,
    ) as VaultLogs;
  } catch {
    return null;
  }
}

function readAgentHint(account: Address): bigint | null {
  try {
    const raw = localStorage.getItem(agentHintKey(account));
    return raw === null ? null : BigInt(raw);
  } catch {
    return null;
  }
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/** Identities this browser has activation hints for that the wallet still owns
 *  and that are not already bound to the given vault — the "migrate your
 *  identity here" candidates a fresh vault offers instead of minting anew. */
export async function migratableIdentities(wallet: Address, account: Address): Promise<bigint[]> {
  const ids = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith("vg-agent-hint-")) continue;
      const v = localStorage.getItem(k);
      if (v) ids.add(v);
    }
  } catch {
    return [];
  }
  const out: bigint[] = [];
  await Promise.all(
    [...ids].map(async (raw) => {
      try {
        const id = BigInt(raw);
        const [holder, boundTo] = await Promise.all([
          client.hubChain.readContract({
            address: DEPLOYMENT.identityRegistry,
            abi: identityRegistryAbi,
            functionName: "ownerOf",
            args: [id],
          }),
          client.hubChain.readContract({
            address: D.hub,
            abi: verglasHubAbi,
            functionName: "accountOf",
            args: [id],
          }),
        ]);
        if (holder.toLowerCase() === wallet.toLowerCase() && boundTo.toLowerCase() !== account.toLowerCase()) {
          out.push(id);
        }
      } catch {
        // burned/unknown id or a read failure — just not a candidate
      }
    }),
  );
  return out.sort((a, b) => (a < b ? -1 : 1));
}

/** Creation block via binary search over eth_getCode — point reads, no
    getLogs. Bounds every scan for factory vaults, so a vault created
    minutes ago (every workshop attendee's) scans a handful of blocks. */
async function findCreationBlock(account: Address): Promise<bigint> {
  try {
    const head = await logsChain.getBlockNumber();
    let lo = D.deployBlock;
    let hi = head;
    while (lo < hi) {
      const mid = lo + (hi - lo) / 2n;
      const code = await logsChain.getCode({ address: account, blockNumber: mid });
      if (code && code !== "0x") hi = mid;
      else lo = mid + 1n;
    }
    return lo;
  } catch {
    return D.deployBlock; // superset fallback: just a longer one-time scan
  }
}

/** The store as it stands right now — no network, no creation-block
    search. Shares the same object getVaultLogs works on, so a background
    scan's appends are visible to the next peek. */
function peekVaultLogs(account: Address): VaultLogs | null {
  const key = account.toLowerCase();
  const store = logStores.get(key) ?? loadVaultLogs(account);
  if (store) logStores.set(key, store);
  return store;
}

async function getVaultLogs(account: Address, agentIdHint: bigint | null): Promise<VaultLogs> {
  const key = account.toLowerCase();
  let store = logStores.get(key) ?? loadVaultLogs(account);
  if (!store) {
    const known = key === SHOWCASE_ACCOUNT.toLowerCase() || key === (T?.account ?? ZERO_ADDR).toLowerCase();
    const creationBlock = known ? D.deployBlock : await findCreationBlock(account);
    store = {
      creationBlock,
      scannedTo: creationBlock - 1n,
      agentId: null,
      spends: [],
      carried: [],
      history: [],
    };
  }
  if (store.agentId === null) store.agentId = agentIdHint ?? readAgentHint(account);
  logStores.set(key, store);
  return store;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Extend the store from scannedTo toward head, chunk by chunk, inside a
    time budget. Chunks are atomic: the store only mutates after every log
    of the chunk (timestamps included) resolved, so a retry cannot dupe. */
async function extendVaultLogs(store: VaultLogs, account: Address): Promise<void> {
  const deadline = Date.now() + SCAN_BUDGET_MS;
  let head: bigint;
  try {
    head = await logsChain.getBlockNumber();
  } catch {
    return; // official RPC unreachable — keep what we have, no error spam
  }

  const chain = client.hubChain;
  let from = store.scannedTo + 1n;
  let retried = false;
  while (from <= head && Date.now() < deadline) {
    const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head;
    try {
      const [acctLogs, depositLogs, boundLogs, carriedKnown] = await Promise.all([
        logsChain.getLogs({
          address: account,
          events: [spendEvent, ownerWithdrawEvent, frozenEvent, unfrozenEvent],
          fromBlock: from,
          toBlock: to,
        }),
        logsChain.getLogs({
          address: D.usdc,
          event: erc20TransferEvent,
          args: { to: account },
          fromBlock: from,
          toBlock: to,
        }),
        store.agentId === null
          ? logsChain.getLogs({
              address: D.hub,
              event: accountBoundEvent,
              args: { account },
              fromBlock: from,
              toBlock: to,
            })
          : Promise.resolve([]),
        store.agentId !== null
          ? logsChain.getLogs({
              address: D.hub,
              event: carriedEvent,
              args: { agentId: store.agentId },
              fromBlock: from,
              toBlock: to,
            })
          : Promise.resolve([]),
      ]);

      let carriedLogs = carriedKnown;
      if (boundLogs.length > 0) {
        // Bind discovered mid-scan: pick up carries from this same chunk
        // too — a carry can never precede its bind, earlier chunks are clean.
        store.agentId = boundLogs[boundLogs.length - 1].args.agentId!;
        carriedLogs = await logsChain.getLogs({
          address: D.hub,
          event: carriedEvent,
          args: { agentId: store.agentId },
          fromBlock: from,
          toBlock: to,
        });
      }

      const spendPending: Promise<SpendEvent>[] = [];
      const lifecyclePending: Promise<HistoryItem>[] = [];
      for (const log of acctLogs) {
        if (log.eventName === "Spend") {
          spendPending.push(
            (async () => ({
              to: log.args.to!,
              amount: log.args.amount!,
              txIndex: log.args.txIndex!,
              newCommitment: log.args.newCommitment!,
              txHash: log.transactionHash,
              timestamp: await blockTime(chain, log.blockNumber),
            }))(),
          );
        } else if (log.eventName === "OwnerWithdraw") {
          lifecyclePending.push(
            (async () => ({
              kind: "withdraw" as const,
              amount: log.args.amount!,
              counterparty: log.args.to!,
              timestamp: await blockTime(chain, log.blockNumber),
              txHash: log.transactionHash,
            }))(),
          );
        } else {
          lifecyclePending.push(
            (async () => ({
              kind: log.eventName === "Frozen" ? ("freeze" as const) : ("thaw" as const),
              amount: null,
              counterparty: null,
              timestamp: await blockTime(chain, log.blockNumber),
              txHash: log.transactionHash,
            }))(),
          );
        }
      }

      const [spendsAdd, lifecycleAdd, depositsAdd, carriedAdd] = await Promise.all([
        Promise.all(spendPending),
        Promise.all(lifecyclePending),
        Promise.all(
          depositLogs.map(async (log) => ({
            kind: "deposit" as const,
            amount: log.args.value!,
            counterparty: log.args.from!,
            timestamp: await blockTime(chain, log.blockNumber),
            txHash: log.transactionHash,
          })),
        ),
        Promise.all(
          carriedLogs.map(async (log) => ({
            destinationBlockchainID: log.args.destinationBlockchainID!,
            gate: log.args.gate!,
            messageID: log.args.messageID!,
            txHash: log.transactionHash,
            timestamp: await blockTime(chain, log.blockNumber),
          })),
        ),
      ]);

      store.spends.push(...spendsAdd);
      store.carried.push(...carriedAdd);
      store.history.push(
        ...spendsAdd.map((s) => ({
          kind: "spend" as const,
          amount: s.amount,
          counterparty: s.to,
          timestamp: s.timestamp,
          txHash: s.txHash,
        })),
        ...lifecycleAdd,
        ...depositsAdd,
      );
      store.scannedTo = to;
      from = to + 1n;
      retried = false;
      if (from <= head) await sleep(CHUNK_PAUSE_MS);
    } catch {
      if (retried) break; // halt at the contiguous boundary; resume next refresh
      retried = true;
      await sleep(1_200);
    }
  }
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
    client.getAttestation(SHOWCASE_AGENT_ID),
    client.isCleared(SHOWCASE_AGENT_ID).catch(() => false),
    chain.readContract({
      address: D.usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [SHOWCASE_ACCOUNT],
    }),
    chain.readContract({
      address: D.validationRegistry,
      abi: validationRegistryAbi,
      functionName: "getAgentValidations",
      args: [SHOWCASE_AGENT_ID],
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

  // The landing shows only live status (cleared / attestation / rate) — it
  // never renders spend or carry history, so we skip the heavy full-range
  // eth_getLogs scans that the fallback RPCs choke on. History belongs to
  // the console (fetchVaultView), not the marketing page.
  return {
    account,
    balance,
    attestation,
    stamps,
    spends: [],
    carried: [],
    cleared,
    gateMaxAge,
    fetchedAt: Date.now(),
  };
}

/** Public client for the hub chain — the console's write flows wait for receipts here. */
export const hubChain = client.hubChain;

/** USDC balances for the side rail's vault list — batched reads. */
export async function fetchBalances(accounts: readonly Address[]): Promise<Record<string, bigint>> {
  const out: Record<string, bigint> = {};
  await Promise.all(
    accounts.map(async (a) => {
      out[a.toLowerCase()] = await client.hubChain.readContract({
        address: D.usdc,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [a],
      });
    }),
  );
  return out;
}

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

/** The fast half of a vault view: point reads only, no log scans. */
async function readVaultCore(
  account: Address,
  agentId: bigint | null,
): Promise<Omit<VaultView, "spends" | "carried" | "history" | "fetchedAt">> {
  const chain = client.hubChain;
  const acct = { address: account, abi: verglasAccountAbi } as const;

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
    attestation,
    cleared,
    gateMaxAge,
  };
}

/** One chronological feed, served from the store (append order → sorted copies). */
function storeSlices(store: VaultLogs | null): Pick<VaultView, "spends" | "carried" | "history"> {
  if (!store) return { spends: [], carried: [], history: [] };
  return {
    spends: [...store.spends].sort((a, b) => (a.txIndex < b.txIndex ? 1 : -1)),
    carried: [...store.carried].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)),
    history: [...store.history].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)),
  };
}

/** One shape for any vault — the known agents (#219/#220) and factory-born
    vaults (agentId null: no 8004 surface to query yet) both read through this.

    First paint never waits for history: the view resolves from point reads
    plus whatever the store already holds, while the catch-up scan (and, for
    a virgin factory vault, the creation-block search) runs in the
    background and re-delivers the extended view through onUpdate. */
export async function fetchVaultView(
  account: Address,
  agentId: bigint | null,
  onUpdate?: (view: VaultView) => void,
): Promise<VaultView> {
  const cached = peekVaultLogs(account);
  let knownId = agentId ?? cached?.agentId ?? readAgentHint(account);

  // Ghost-identity guard: a hint (or an old discovery) goes stale when the
  // identity is migrated to ANOTHER vault — without this check the old vault
  // would keep rendering the migrated identity's attestations as its own.
  // accountOf == 0x0 (not bound anywhere, e.g. right after a Hub redeploy)
  // deliberately keeps the hint: the renew flow restores that binding itself.
  if (agentId === null && knownId !== null) {
    const boundTo = await client.hubChain
      .readContract({ address: D.hub, abi: verglasHubAbi, functionName: "accountOf", args: [knownId] })
      .catch(() => null);
    if (boundTo !== null && boundTo !== ZERO_ADDR && boundTo.toLowerCase() !== account.toLowerCase()) {
      knownId = null;
      try {
        localStorage.removeItem(agentHintKey(account));
      } catch {
        // private mode
      }
      if (cached) cached.agentId = null;
    }
  }

  const scan = getVaultLogs(account, knownId).then(async (store) => {
    await extendVaultLogs(store, account);
    saveVaultLogs(account, store);
    return store;
  });

  const core = await readVaultCore(account, knownId);
  const view: VaultView = { ...core, ...storeSlices(cached), fetchedAt: Date.now() };

  if (onUpdate)
    void scan
      .then(async (store) => {
        // A virgin store can discover its agentId mid-scan (AccountBound);
        // the audit surfaces (stamps, passport) only exist after a re-read then.
        const fresh =
          knownId === null && store.agentId !== null ? await readVaultCore(account, store.agentId) : core;
        onUpdate({ ...fresh, ...storeSlices(store), fetchedAt: Date.now() });
      })
      .catch(() => {}); // a failed re-read keeps the already-delivered view

  return view;
}

/** Vaults born from the CURRENT factory support increaseBudget; legacy-factory
 *  vaults (and the showcase vaults) carry the old bytecode and cannot refuel. */
const refillableVaults = new Set<string>();
export const isRefillable = (account: Address) => refillableVaults.has(account.toLowerCase());

/** Factory-born vaults of a wallet — the console's "my vaults" list.
 *  Legacy factories are queried too (their vaults must not vanish from the UI
 *  after a factory redeploy) and come FIRST: callers rely on "last element =
 *  newest vault" right after createVault. */
export async function fetchMyVaults(owner: Address): Promise<readonly Address[]> {
  const factories = [...DEPLOYMENT.legacyFactories, DEPLOYMENT.factory];
  const lists = await Promise.all(
    factories.map((address) =>
      client.hubChain
        .readContract({ address, abi: verglasFactoryAbi, functionName: "vaultsOf", args: [owner] })
        .catch(() => [] as readonly Address[]),
    ),
  );
  for (const v of lists[lists.length - 1]) refillableVaults.add(v.toLowerCase());
  return lists.flat();
}


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
  /** Live USD/TRY read from the VerglasOracle shim — the keeper pushes it from
      independent FX references (Hermes died with the July 2026 Pyth cutover),
      normalized to 1e8 like the policy reference. */
  pythRateUsdTry: bigint;
  pythPublishTime: bigint;
  payments: FxPaymentEvent[];
}

const T = TREASURER;
const RATE_TARGET_EXPO = -8;

export async function fetchTreasurer(): Promise<TreasurerData> {
  if (!T) throw new Error(`${NET.label} has no treasurer deployment`);
  const chain = client.hubChain;

  // Point reads only — no eth_getLogs. The public fallback RPCs 500 on
  // full-range getLogs, and both callers (landing status + console policy)
  // need only current state, never the FX payment history.
  const [policy, spentToday, paused, operator, vaultBalance, vaultFrozen, vaultTxCount, pythPrice] =
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
    ]);

  const payments: FxPaymentEvent[] = [];

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
