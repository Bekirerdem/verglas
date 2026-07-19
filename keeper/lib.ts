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
  BLOCKCHAIN_IDS,
  dispatch,
  FUJI_DEPLOYMENT,
  fujiC,
  validationRegistryAbi,
  verglasAccountAbi,
  verglasGateAbi,
  verglasHubAbi,
} from "@verglas/sdk";
import { proveWindow, type Spend } from "@verglas/sdk/prove";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const D = FUJI_DEPLOYMENT;
const CHUNK = 2000n;

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
  const pub = createPublicClient({ chain: fujiC, transport: http() });
  const gatePub = createPublicClient({ chain: dispatch, transport: http() });
  const signer: PrivateKeyAccount = privateKeyToAccount(envKey());
  const wallet = createWalletClient({ chain: fujiC, transport: http(), account: signer });
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
    chain: fujiC,
    account: wallet.account!,
  });
  const rc = await pub.waitForTransactionReceipt({ hash: submitHash });
  if (rc.status !== "success") throw new Error(`submitProof reverted: ${submitHash}`);
  log(`agent #${agentId}: STAMPED score 100 (${submitHash})`);

  if (opts.carry) {
    const carryHash = await wallet.writeContract({
      address: D.hub,
      abi: verglasHubAbi,
      functionName: "carryAttestation",
      args: [agentId, BLOCKCHAIN_IDS.dispatch, D.gateOnDispatch],
      chain: fujiC,
      account: wallet.account!,
    });
    const rc2 = await pub.waitForTransactionReceipt({ hash: carryHash });
    if (rc2.status !== "success") throw new Error(`carry reverted: ${carryHash}`);
    log(`agent #${agentId}: carried to Dispatch (${carryHash})`);
  }
  return "stamped";
}

/** Attestation freshness against the gate's maxAge; null if none. */
export async function validityOf(
  pub: PublicClient,
  gatePub: PublicClient,
  agentId: bigint,
): Promise<{ issuedAt: bigint; expiresAt: bigint; secondsLeft: number } | null> {
  const att = await pub.readContract({
    address: D.hub,
    abi: verglasHubAbi,
    functionName: "latestAttestation",
    args: [agentId],
  });
  if (att[4] === 0n) return null;
  const maxAge = await gatePub.readContract({
    address: D.gateOnDispatch,
    abi: verglasGateAbi,
    functionName: "maxAge",
  });
  const issuedAt = att[4];
  const expiresAt = issuedAt + BigInt(maxAge);
  return { issuedAt, expiresAt, secondsLeft: Number(expiresAt) - Math.floor(Date.now() / 1000) };
}
