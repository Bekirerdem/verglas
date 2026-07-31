// Verglas keeper — shared core: chain clients, agent discovery, window
// rebuilding and the stamp routine (prove → submitProof → ICM carry).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseAbiItem,
  toHex,
  type Address,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
  networkOf,
  pythAbi,
  validationRegistryAbi,
  verglasAccountAbi,
  verglasGateAbi,
  verglasHubAbi,
} from "@verglas/sdk";
import { proveWindow, type Spend } from "@verglas/sdk/prove";
import { buildOracleUpdate, fetchUsdTryIndependent } from "@verglas/sdk/fx";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/** The keeper serves one network per process: VERGLAS_NETWORK=avalanche|fuji
 *  (default fuji). Everything below reads addresses from that deployment. */
export const NET = networkOf(process.env.VERGLAS_NETWORK ?? "fuji");
if (!NET.deployment) throw new Error(`${NET.label} has no Verglas deployment yet`);
export const D = { ...NET.deployment } as const;
const CHUNK = 2000n;

/** Explicit gas and fees for every keeper write: Fuji's RPC intermittently
 *  feeds viem estimation values that build an unsendable tx (seen live:
 *  ~1.5e16 gas limit, sub-gwei fees → "exceeds block gas limit"). */
const TX_FEES = { maxFeePerGas: 30_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n } as const;
const SUBMIT_GAS = 900_000n; // Groth16 verify ~290k + bindings + registry write
const CARRY_GAS = 400_000n; // Teleporter send measured ~160k live
const PUSH_GAS = 150_000n; // oracle price push measured ~80k live

const spendEvent = parseAbiItem(
  "event Spend(address indexed to, uint256 amount, uint256 indexed txIndex, uint256 newCommitment)",
);
const accountBoundEvent = parseAbiItem("event AccountBound(uint256 indexed agentId, address indexed account)");

export function envKey(): `0x${string}` {
  const line = readFileSync(join(ROOT, ".env"), "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("PRIVATE_KEY="));
  if (!line) throw new Error("PRIVATE_KEY not found in .env");
  const raw = line.slice("PRIVATE_KEY=".length).trim();
  return (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
}

export function clients() {
  const pub = createPublicClient({ chain: NET.chain, transport: http() });
  // With no gate configured this client is never asked a gate question —
  // validityOf's try/catch turns the absence into gateSeen:false.
  const gatePub = createPublicClient({ chain: D.gate?.chain ?? NET.chain, transport: http() });
  const signer: PrivateKeyAccount = privateKeyToAccount(envKey());
  const wallet = createWalletClient({ chain: NET.chain, transport: http(), account: signer });
  return { pub, gatePub, wallet, signer };
}

async function scanLogs<T>(
  pub: PublicClient,
  fetchChunk: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
): Promise<T[]> {
  const head = await pub.getBlockNumber();
  const out: T[] = [];
  for (let from = D.deployBlock; from <= head; from += CHUNK) {
    const to = from + CHUNK - 1n < head ? from + CHUNK - 1n : head;
    out.push(...(await fetchChunk(from, to)));
  }
  return out;
}

/** All (agentId → vault) bindings the Hub has ever seen; later bindings win. */
export async function discoverAgents(pub: PublicClient): Promise<Map<bigint, Address>> {
  const logs = await scanLogs(pub, (fromBlock, toBlock) =>
    pub.getLogs({ address: D.hub, event: accountBoundEvent, fromBlock, toBlock }),
  );
  const map = new Map<bigint, Address>();
  for (const l of logs) map.set(l.args.agentId!, l.args.account!);
  return map;
}

/** The latest still-unanswered validation request for the agent, if any. */
export async function openRequest(pub: PublicClient, agentId: bigint): Promise<`0x${string}` | null> {
  const hashes = await pub.readContract({
    address: D.validationRegistry,
    abi: validationRegistryAbi,
    functionName: "getAgentValidations",
    args: [agentId],
  });
  let open: `0x${string}` | null = null;
  for (const h of hashes) {
    const s = await pub.readContract({
      address: D.validationRegistry,
      abi: validationRegistryAbi,
      functionName: "getValidationStatus",
      args: [h],
    });
    if (s[2] === 0) open = h;
  }
  return open;
}

/** Spends since the Hub's checkpoint, in txIndex order. */
export async function windowSpends(
  pub: PublicClient,
  account: Address,
  cpTxCount: bigint,
): Promise<Spend[]> {
  const logs = await scanLogs(pub, (fromBlock, toBlock) =>
    pub.getLogs({ address: account, event: spendEvent, fromBlock, toBlock }),
  );
  return logs
    .map((l) => ({ txIndex: l.args.txIndex!, to: l.args.to!, amount: l.args.amount! }))
    .sort((a, b) => (a.txIndex < b.txIndex ? -1 : 1))
    .filter((s) => s.txIndex >= cpTxCount)
    .map((s) => ({ to: s.to, amount: s.amount }));
}

export type StampResult = "stamped" | "no-request" | "empty-window";

/** The full stamp routine for one agent. Throws on tx failure. */
export async function stampAgent(
  pub: PublicClient,
  wallet: WalletClient,
  agentId: bigint,
  opts: { carry: boolean; log?: (msg: string) => void },
): Promise<StampResult> {
  const log = opts.log ?? console.log;

  const account = await pub.readContract({
    address: D.hub,
    abi: verglasHubAbi,
    functionName: "accountOf",
    args: [agentId],
  });
  if (account === "0x0000000000000000000000000000000000000000") {
    throw new Error(`agent ${agentId}: no bound account`);
  }

  const requestHash = await openRequest(pub, agentId);
  if (!requestHash) return "no-request";

  const acct = { address: account, abi: verglasAccountAbi } as const;
  const [perTxLimit, wlLen, cp] = await Promise.all([
    pub.readContract({ ...acct, functionName: "perTxLimit" }),
    pub.readContract({ ...acct, functionName: "whitelistLength" }),
    pub.readContract({ address: D.hub, abi: verglasHubAbi, functionName: "checkpoints", args: [account] }),
  ]);
  const whitelist = await Promise.all(
    Array.from({ length: Number(wlLen) }, (_, i) =>
      pub.readContract({ ...acct, functionName: "whitelist", args: [BigInt(i)] }),
    ),
  );

  const spends = await windowSpends(pub, account, cp[1]);
  if (spends.length === 0) return "empty-window";

  log(`agent #${agentId}: proving ${spends.length}-spend window…`);
  const { calldata, publicSignals } = await proveWindow(
    { spends, whitelist, perTxLimit, initialCommitment: cp[0] },
    {
      wasmPath: join(ROOT, "build", "policy_compliance_js", "policy_compliance.wasm"),
      zkeyPath: join(ROOT, "build", "policy_compliance.zkey"),
    },
  );

  const responseHash = keccak256(toHex(publicSignals.join(",")));
  const submitHash = await wallet.writeContract({
    address: D.hub,
    abi: verglasHubAbi,
    functionName: "submitProof",
    args: [
      agentId,
      requestHash,
      calldata.pA,
      calldata.pB,
      calldata.pC,
      calldata.publicSignals as unknown as readonly [
        bigint, bigint, bigint, bigint, bigint, bigint,
        bigint, bigint, bigint, bigint, bigint, bigint,
      ],
      "verglas:policy-compliance",
      responseHash,
    ],
    chain: NET.chain,
    account: wallet.account!,
    gas: SUBMIT_GAS,
    ...TX_FEES,
  });
  const rc = await pub.waitForTransactionReceipt({ hash: submitHash });
  if (rc.status !== "success") throw new Error(`submitProof reverted: ${submitHash}`);
  log(`agent #${agentId}: STAMPED score 100 (${submitHash})`);

  if (opts.carry && D.gate) await carryAttestation(pub, wallet, agentId, log);
  return "stamped";
}

/** Send the agent's current Hub attestation to this network's gate over ICM.
    Permissionless and owner-free, so the keeper can also use it on its own to
    refresh a clearance that is about to age out on the far side. */
export async function carryAttestation(
  pub: PublicClient,
  wallet: WalletClient,
  agentId: bigint,
  log: (msg: string) => void,
): Promise<void> {
  if (!D.gate) throw new Error(`${NET.label} has no gate deployed`);
  const carryHash = await wallet.writeContract({
    address: D.hub,
    abi: verglasHubAbi,
    functionName: "carryAttestation",
    args: [agentId, D.gate.blockchainId, D.gate.address],
    chain: NET.chain,
    account: wallet.account!,
    gas: CARRY_GAS,
    ...TX_FEES,
  });
  const rc = await pub.waitForTransactionReceipt({ hash: carryHash });
  if (rc.status !== "success") throw new Error(`carry reverted: ${carryHash}`);
  log(`agent #${agentId}: carried to ${D.gate.chainLabel} (${carryHash})`);
}

/** Push a fresh USD/TRY reading to the network's VerglasOracle shim. Returns
    the rate pushed, or null when the treasurer vertical isn't deployed here.
    Pyth's free feed died in July 2026; this is what keeps `payFX` alive. */
export async function pushFxPrice(
  pub: PublicClient,
  wallet: WalletClient,
  log: (msg: string) => void,
): Promise<number | null> {
  const t = NET.deployment!.treasurer;
  if (!t) return null;

  const reading = await fetchUsdTryIndependent();
  const update = await buildOracleUpdate({
    privateKey: envKey(),
    oracle: t.pyth,
    chainId: NET.chain.id,
    priceId: t.usdTryPriceId,
    rate: reading.rate,
    conf: reading.conf,
  });
  const hash = await wallet.writeContract({
    address: t.pyth,
    abi: pythAbi,
    functionName: "updatePriceFeeds",
    args: [[update]],
    chain: NET.chain,
    account: wallet.account!,
    gas: PUSH_GAS,
    ...TX_FEES,
  });
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error(`oracle push reverted: ${hash}`);
  log(
    `oracle: USD/TRY ${reading.rate.toFixed(4)} pushed (${reading.sources.map((s) => s.name).join(" + ")})`,
  );
  return reading.rate;
}

/** The gate's configured window, used when the gate chain cannot be reached —
    an L1 in maintenance must not stop the keeper from reporting Hub-side
    freshness. Matches every Gate we deploy. */
const FALLBACK_MAX_AGE = 7n * 24n * 3600n;

/** Attestation freshness against the gate's maxAge; null if none. `gateSeen`
    is false when the gate chain was unreachable and the fallback was assumed. */
export async function validityOf(
  pub: PublicClient,
  gatePub: PublicClient,
  agentId: bigint,
): Promise<{ issuedAt: bigint; expiresAt: bigint; secondsLeft: number; gateSeen: boolean } | null> {
  const att = await pub.readContract({
    address: D.hub,
    abi: verglasHubAbi,
    functionName: "latestAttestation",
    args: [agentId],
  });
  if (att[5] === 0n) return null;
  let gateSeen = true;
  let maxAge = FALLBACK_MAX_AGE;
  if (D.gate) {
    try {
      maxAge = BigInt(
        await gatePub.readContract({ address: D.gate.address, abi: verglasGateAbi, functionName: "maxAge" }),
      );
    } catch {
      gateSeen = false; // gate chain down — assume our standard window
    }
  }
  const issuedAt = att[5];
  const expiresAt = issuedAt + maxAge;
  return { issuedAt, expiresAt, secondsLeft: Number(expiresAt) - Math.floor(Date.now() / 1000), gateSeen };
}
