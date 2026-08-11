// Smoke run for the verglas-pay core against the live network: status and
// registry reads, one refused breach (simulate-only inside pay), and — only
// with --pay <usdc> — one real in-rule payment to the whitelist's first entry.
import { createPublicClient, http } from "viem";
import { networkOf, verglasAccountAbi, verglasHubAbi } from "@verglas/sdk";
import { checkAgent, DEFAULT_AGENT_ID, pay, vaultStatus } from "./core.js";

const NET = networkOf(process.env.VERGLAS_NETWORK ?? "fuji");
const payIdx = process.argv.indexOf("--pay");
const payAmt = payIdx >= 0 ? process.argv[payIdx + 1] : null;

console.log("— status —");
console.log(await vaultStatus(DEFAULT_AGENT_ID));

console.log("\n— check —");
console.log(await checkAgent(DEFAULT_AGENT_ID));

console.log("\n— breach: outsider recipient (must be refused by name) —");
console.log(await pay(DEFAULT_AGENT_ID, "0x00000000000000000000000000000000000000C3", "0.1"));

console.log("\n— breach: over per-payment limit (must be refused by name) —");
const pub = createPublicClient({ chain: NET.chain, transport: http() });
const account = await pub.readContract({
  address: NET.deployment!.hub,
  abi: verglasHubAbi,
  functionName: "accountOf",
  args: [DEFAULT_AGENT_ID],
});
const vault = { address: account, abi: verglasAccountAbi } as const;
const [perTx, target] = await Promise.all([
  pub.readContract({ ...vault, functionName: "perTxLimit" }),
  pub.readContract({ ...vault, functionName: "whitelist", args: [0n] }),
]);
console.log(await pay(DEFAULT_AGENT_ID, target, ((Number(perTx) / 1e6) + 1).toString()));

if (payAmt) {
  console.log(`\n— real payment: ${payAmt} USDC to whitelist[0] —`);
  console.log(await pay(DEFAULT_AGENT_ID, target, payAmt));
} else {
  console.log("\n(no --pay flag: skipped the real payment)");
}
