// Verglas demo agent — the live scene for the demo: the key that holds the
// agent role pays inside the rules, then tries to break them and the vault
// turns it away, by name.
// Usage: npx tsx demo-agent.ts <agentId> --pay [usdc]   one real in-rule payment
//        npx tsx demo-agent.ts <agentId> --breach       two breach attempts, both refused
import { ContractFunctionRevertedError, formatUnits, parseUnits, type Address } from "viem";
import { verglasAccountAbi, verglasHubAbi } from "@verglas/sdk";
import { clients, D, NET } from "./lib.js";

const TX_FEES = { maxFeePerGas: 30_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n } as const;
/** Deliberately on no whitelist — the outsider the rules exist to stop. */
const OUTSIDER = "0x00000000000000000000000000000000000000B2" as Address;

const idArg = process.argv[2];
if (!idArg || !/^\d+$/.test(idArg)) {
  console.error("usage: npx tsx demo-agent.ts <agentId> --pay [usdc] | --breach");
  process.exit(1);
}
const agentId = BigInt(idArg);
const BREACH = process.argv.includes("--breach");
const payIdx = process.argv.indexOf("--pay");
const payArg = payIdx >= 0 ? process.argv[payIdx + 1] : undefined;
const payAmt = payArg && !payArg.startsWith("--") ? parseUnits(payArg, 6) : 100_000n;

const { pub, wallet, signer } = clients();

const account = await pub.readContract({ address: D.hub, abi: verglasHubAbi, functionName: "accountOf", args: [agentId] });
if (account === "0x0000000000000000000000000000000000000000") throw new Error(`agent #${agentId}: not bound`);
const vault = { address: account, abi: verglasAccountAbi } as const;

const [agent, perTx, budget, spent, frozen, target] = await Promise.all([
  pub.readContract({ ...vault, functionName: "agent" }),
  pub.readContract({ ...vault, functionName: "perTxLimit" }),
  pub.readContract({ ...vault, functionName: "totalBudget" }),
  pub.readContract({ ...vault, functionName: "totalSpent" }),
  pub.readContract({ ...vault, functionName: "frozen" }),
  pub.readContract({ ...vault, functionName: "whitelist", args: [0n] }),
]);
const fmt = (v: bigint) => `${formatUnits(v, 6)} USDC`;
console.log(`vault ${account}`);
console.log(`  rules: per-payment ${fmt(perTx)} · budget ${fmt(spent)}/${fmt(budget)} · frozen ${frozen}`);
if (agent !== signer.address) throw new Error(`this key is not the vault's agent (agent is ${agent})`);

const revertName = (e: unknown): string | null => {
  const rev =
    e instanceof Error && "walk" in e
      ? (e as { walk: (fn: (x: unknown) => boolean) => unknown }).walk((x) => x instanceof ContractFunctionRevertedError)
      : undefined;
  const data = rev instanceof ContractFunctionRevertedError ? rev.data : undefined;
  return data?.errorName ? `${data.errorName}(${(data.args ?? []).map(String).join(", ")})` : null;
};

if (!BREACH) {
  try {
    await pub.simulateContract({ ...vault, functionName: "spend", args: [target, payAmt], account: signer.address });
  } catch (e) {
    console.log(`✘ payment of ${fmt(payAmt)}: refused by the vault${revertName(e) ? ` — ${revertName(e)}` : ""}`);
    process.exit(1);
  }
  const hash = await wallet.writeContract({
    ...vault,
    functionName: "spend",
    args: [target, payAmt],
    chain: NET.chain,
    account: signer,
    gas: 300_000n,
    ...TX_FEES,
  });
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error(`spend reverted on-chain: ${hash}`);
  console.log(`✔ paid ${fmt(payAmt)} to ${target} — inside the rules (${hash})`);
} else {
  const attempt = async (label: string, to: Address, amount: bigint) => {
    try {
      await pub.simulateContract({ ...vault, functionName: "spend", args: [to, amount], account: signer.address });
      console.log(`⚠ ${label}: the vault would ACCEPT this — adjust the scenario`);
    } catch (e) {
      // Older vault builds revert the whitelist rule without a named error —
      // the refusal is the same, the chain just doesn't spell the name.
      const named = revertName(e);
      console.log(`✘ ${label}: refused by the vault${named ? ` — ${named}` : ""}`);
    }
  };
  await attempt(`pay ${fmt(payAmt)} to an outsider address`, OUTSIDER, payAmt);
  await attempt(`pay ${fmt(perTx + 1n)} — over the per-payment limit`, target, perTx + 1n);
  const overBudget = budget - spent + 100_000n; // inside per-payment, over the budget
  if (overBudget <= perTx) {
    await attempt(`pay ${fmt(overBudget)} — inside the limit, over the budget`, target, overBudget);
  }
}
