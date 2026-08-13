// verglas-pay core — the vault operations the MCP tools expose. Kept apart
// from the server so a smoke run can call them directly, no stdio in the way.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  formatUnits,
  getAddress,
  http,
  isAddress,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { networkOf, verglasAccountAbi, verglasHubAbi, VerglasClient } from "@verglas/sdk";
import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { ChainIdToNetwork } from "x402/types";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NET = networkOf(process.env.VERGLAS_NETWORK ?? "fuji");
if (!NET.deployment) throw new Error(`${NET.label} has no Verglas deployment`);
const D = NET.deployment;

/** Fuji's RPC intermittently mis-estimates fees into an unsendable tx; the
 *  keeper pins them and so do we. */
const TX_FEES = { maxFeePerGas: 30_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n } as const;

function envKey(): `0x${string}` {
  let fromFile: string | undefined;
  try {
    // Repo convenience only — an installed package has no .env to fall back to.
    fromFile = readFileSync(join(ROOT, ".env"), "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("PRIVATE_KEY="))
      ?.slice("PRIVATE_KEY=".length)
      .trim();
  } catch {
    /* no .env file */
  }
  const raw = process.env.PRIVATE_KEY?.trim() || fromFile;
  if (!raw) throw new Error("PRIVATE_KEY not set (env or repo .env)");
  return (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
}

const pub = createPublicClient({ chain: NET.chain, transport: http() });
const signer = privateKeyToAccount(envKey());
const wallet = createWalletClient({ chain: NET.chain, transport: http(), account: signer });

export const DEFAULT_AGENT_ID = BigInt(process.env.VERGLAS_AGENT_ID ?? "219");
const fmt = (v: bigint) => `${formatUnits(v, 6)} USDC`;
const explorer = (hash: string) => `${NET.chain.blockExplorers!.default.url}/tx/${hash}`;

async function vaultOf(agentId: bigint) {
  const account = await pub.readContract({
    address: D.hub,
    abi: verglasHubAbi,
    functionName: "accountOf",
    args: [agentId],
  });
  if (account === "0x0000000000000000000000000000000000000000")
    throw new Error(`agent #${agentId} has no bound vault on ${NET.label}`);
  return { address: account, abi: verglasAccountAbi } as const;
}

/** The named rule that refused a spend, e.g. NotInWhitelist(0x…), or null. */
function revertName(e: unknown): string | null {
  const rev =
    e instanceof Error && "walk" in e
      ? (e as { walk: (fn: (x: unknown) => boolean) => unknown }).walk(
          (x) => x instanceof ContractFunctionRevertedError,
        )
      : undefined;
  const data = rev instanceof ContractFunctionRevertedError ? rev.data : undefined;
  return data?.errorName ? `${data.errorName}(${(data.args ?? []).map(String).join(", ")})` : null;
}

export async function vaultStatus(agentId: bigint): Promise<string> {
  const vault = await vaultOf(agentId);
  const [agent, perTx, budget, spent, frozen, wlLen] = await Promise.all([
    pub.readContract({ ...vault, functionName: "agent" }),
    pub.readContract({ ...vault, functionName: "perTxLimit" }),
    pub.readContract({ ...vault, functionName: "totalBudget" }),
    pub.readContract({ ...vault, functionName: "totalSpent" }),
    pub.readContract({ ...vault, functionName: "frozen" }),
    pub.readContract({ ...vault, functionName: "whitelistLength" }),
  ]);
  const whitelist = await Promise.all(
    Array.from({ length: Number(wlLen) }, (_, i) =>
      pub.readContract({ ...vault, functionName: "whitelist", args: [BigInt(i)] }),
    ),
  );
  // Vaults born before the 2026-08-13 factory don't have the daily-cap
  // family; a missing getter just means "no daily rule to show".
  let dailyLine: string | null = null;
  try {
    const [daily, todaySpent] = await Promise.all([
      pub.readContract({ ...vault, functionName: "dailyLimit" }),
      pub.readContract({ ...vault, functionName: "dailySpentNow" }),
    ]);
    if (daily > 0n) dailyLine = `  daily limit: ${fmt(todaySpent)} spent of ${fmt(daily)} this window`;
  } catch {
    /* pre-dailyLimit vault */
  }
  const mine = agent === signer.address;
  return [
    `vault ${vault.address} on ${NET.label} (agent #${agentId})`,
    `  agent key: ${agent}${mine ? " — this key, payments allowed" : " — NOT this key, read-only"}`,
    `  per-payment limit: ${fmt(perTx)}`,
    ...(dailyLine ? [dailyLine] : []),
    `  budget: ${fmt(spent)} spent of ${fmt(budget)} (${fmt(budget - spent)} left)`,
    `  frozen: ${frozen}`,
    `  whitelist (${whitelist.length}): ${whitelist.join(", ")}`,
  ].join("\n");
}

export async function pay(agentId: bigint, to: string, usdc: string): Promise<string> {
  if (!isAddress(to, { strict: false })) throw new Error(`"${to}" is not a valid address`);
  const dest = getAddress(to); // normalize any casing to the checksummed form
  const amount = parseUnits(usdc, 6);
  if (amount <= 0n) throw new Error(`amount must be positive, got ${usdc}`);
  const vault = await vaultOf(agentId);

  const agent = await pub.readContract({ ...vault, functionName: "agent" });
  if (agent !== signer.address)
    throw new Error(`this key (${signer.address}) is not the vault's agent (${agent})`);

  try {
    await pub.simulateContract({
      ...vault,
      functionName: "spend",
      args: [dest, amount],
      account: signer.address,
    });
  } catch (e) {
    const name = revertName(e);
    if (name) return `REFUSED by the vault: ${name} — the payment never left. Rules live in the contract, not in this tool.`;
    throw e;
  }

  const hash = await wallet.writeContract({
    ...vault,
    functionName: "spend",
    args: [dest, amount],
    chain: NET.chain,
    account: signer,
    gas: 300_000n,
    ...TX_FEES,
  });
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error(`spend reverted on-chain: ${explorer(hash)}`);
  const [spent, budget] = await Promise.all([
    pub.readContract({ ...vault, functionName: "totalSpent" }),
    pub.readContract({ ...vault, functionName: "totalBudget" }),
  ]);
  return [
    `PAID ${usdc} USDC to ${dest}`,
    `  tx: ${explorer(hash)}`,
    `  budget after: ${fmt(spent)} of ${fmt(budget)}`,
  ].join("\n");
}

/** The x402 float vault: its whitelist holds the agent key itself, so the only
 *  thing it can ever fund is the agent's own signing wallet — and only inside
 *  the vault's limits. Payments to the outside world then ride x402. */
export const X402_AGENT_ID = BigInt(process.env.VERGLAS_X402_AGENT_ID ?? "223");

const ERC20_BALANCE = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** Pay a 402-gated URL. The float lives in the agent's own wallet and is
 *  refilled exclusively through the vault — spend() enforces the rules, so a
 *  frozen or exhausted vault stops x402 payments at the refill step, by name. */
export async function payX402(agentId: bigint, url: string, maxUsdc: string): Promise<string> {
  const cap = parseUnits(maxUsdc, 6);
  const x402Network = ChainIdToNetwork[NET.chain.id];
  if (!x402Network) throw new Error(`${NET.label} has no x402 network mapping`);

  const probe = await fetch(url);
  if (probe.status !== 402) {
    const body = (await probe.text()).slice(0, 600);
    return `no payment required (HTTP ${probe.status})\n${body}`;
  }
  const offer = (await probe.json()) as {
    accepts?: Array<Record<string, string>>;
    accepted?: Record<string, string>;
  };
  const reqs = offer.accepts ?? (offer.accepted ? [offer.accepted] : []);
  const match = reqs.find((r) => r.scheme === "exact" && r.network === x402Network);
  if (!match)
    throw new Error(
      `no exact/${x402Network} offer at ${url}; offered: ${reqs.map((r) => `${r.scheme}/${r.network}`).join(", ") || "none"}`,
    );
  if (getAddress(match.asset) !== getAddress(D.usdc))
    return `REFUSED by this tool: seller wants token ${match.asset}, this vault only holds USDC.`;
  const amount = BigInt(match.maxAmountRequired ?? match.amount ?? "0");
  if (amount === 0n) throw new Error("offer carries no amount");
  if (amount > cap) return `REFUSED by this tool: price ${fmt(amount)} is over the per-call cap ${fmt(cap)}.`;

  // Float check — anything missing is pulled through the vault, where the
  // rules live. A refusal here is the contract talking, not this tool.
  const lines: string[] = [];
  const float = (await pub.readContract({
    address: D.usdc,
    abi: ERC20_BALANCE,
    functionName: "balanceOf",
    args: [signer.address],
  })) as bigint;
  if (float < amount) {
    const refill = await pay(agentId, signer.address, formatUnits(amount - float, 6));
    if (refill.startsWith("REFUSED"))
      return `x402 payment stopped at the vault refill step.\n${refill}`;
    lines.push(`float refill through vault (agent #${agentId}):`, refill.replace(/^/gm, "  "));
  }

  const fetchWithPay = wrapFetchWithPayment(fetch, wallet, cap);
  const res = await fetchWithPay(url);
  const settleHeader = res.headers.get("x-payment-response");
  const settle = settleHeader ? decodeXPaymentResponse(settleHeader) : null;
  const body = (await res.text()).slice(0, 600);
  if (!res.ok) {
    // The header was sent, but without a settlement receipt nothing moved —
    // don't call it paid.
    lines.push(`payment offered but the seller did not deliver (HTTP ${res.status})`, `  response: ${body}`);
    return lines.join("\n");
  }
  lines.push(
    `PAID ${fmt(amount)} over x402 to ${match.payTo}`,
    settle?.transaction ? `  settlement tx: ${explorer(settle.transaction)}` : "  settlement: receipt header missing",
    `  response: ${body}`,
  );
  return lines.join("\n");
}

export async function checkAgent(agentId: bigint): Promise<string> {
  const client = VerglasClient.forNetwork(NET);
  const r = await client.checkAgent(agentId);
  const lines = [
    `agent #${agentId} on ${NET.label}: ${r.cleared ? "CLEARED" : "NOT CLEARED"}`,
    r.clearedFor ? `  cleared for: ${r.clearedFor}` : null,
    r.attestation
      ? `  last seal: score ${r.attestation.score}, issued ${new Date(Number(r.attestation.issuedAt) * 1000).toISOString()}`
      : "  no seal on record",
    `  stamp history: ${r.history.length} stamps`,
  ].filter(Boolean);
  return lines.join("\n");
}
