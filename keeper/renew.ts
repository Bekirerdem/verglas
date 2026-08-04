// Verglas keeper — renew the stamp line of a keeper-operated agent: open a
// fresh validation window, make one minimal whitelisted spend so the window
// is provable, then run the full stamp routine (prove -> submitProof ->
// carry, self-delivering where the lane has no relayer).
//
// Only agents whose identity and spend authority sit on the keeper key can
// renew here — an external owner's vault renews from the console with their
// own signature, by design (the keeper can forge neither window nor spend).
// Usage: npx tsx renew.ts <agentId> [--amount <usdc>] [--no-stamp]
//        --no-stamp leaves the window and the spend for the scheduled keeper
//        to prove on its next pass, instead of stamping here and now.
import { concat, keccak256, toHex } from "viem";
import { validationRegistryAbi, verglasAccountAbi, verglasHubAbi, verglasTreasurerAbi } from "@verglas/sdk";
import { clients, D, NET, openRequest, stampAgent, windowSpends } from "./lib.js";

const idArg = process.argv[2];
if (!idArg || !/^\d+$/.test(idArg)) {
  console.error("usage: npx tsx renew.ts <agentId> [--amount <usdc>]");
  process.exit(1);
}
const agentId = BigInt(idArg);
const amountArg = process.argv.indexOf("--amount");
const AMOUNT = amountArg >= 0 ? BigInt(Math.round(Number(process.argv[amountArg + 1]) * 1e6)) : 100_000n;
const NO_STAMP = process.argv.includes("--no-stamp");

const TX_FEES = { maxFeePerGas: 30_000_000_000n, maxPriorityFeePerGas: 1_000_000_000n } as const;
const { pub, wallet, signer } = clients();
const log = (msg: string) => console.log(msg);

const account = await pub.readContract({
  address: D.hub,
  abi: verglasHubAbi,
  functionName: "accountOf",
  args: [agentId],
});
if (account === "0x0000000000000000000000000000000000000000") throw new Error(`agent #${agentId}: not bound`);

// 1. A window the keeper can prove into — open one if none is pending.
if (await openRequest(pub, agentId)) {
  log(`agent #${agentId}: window already open`);
} else {
  const rand = new Uint8Array(32);
  crypto.getRandomValues(rand);
  const requestHash = keccak256(concat([account, toHex(rand)]));
  const hash = await wallet.writeContract({
    address: D.validationRegistry,
    abi: validationRegistryAbi,
    functionName: "validationRequest",
    args: [D.hub, agentId, "verglas:policy-compliance:window", requestHash],
    chain: NET.chain,
    account: signer,
    gas: 300_000n,
    ...TX_FEES,
  });
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error(`validationRequest reverted: ${hash}`);
  log(`agent #${agentId}: window opened (${hash})`);
}

// 2. At least one spend since the Hub checkpoint — the circuit has nothing
//    to prove over an empty window.
const cp = await pub.readContract({ address: D.hub, abi: verglasHubAbi, functionName: "checkpoints", args: [account] });
if ((await windowSpends(pub, account, cp[1])).length > 0) {
  log(`agent #${agentId}: window already has spends`);
} else {
  const vault = { address: account, abi: verglasAccountAbi } as const;
  const [vaultAgent, target] = await Promise.all([
    pub.readContract({ ...vault, functionName: "agent" }),
    pub.readContract({ ...vault, functionName: "whitelist", args: [0n] }),
  ]);
  let hash: `0x${string}`;
  if (vaultAgent === signer.address) {
    hash = await wallet.writeContract({
      ...vault,
      functionName: "spend",
      args: [target, AMOUNT],
      chain: NET.chain,
      account: signer,
      gas: 300_000n,
      ...TX_FEES,
    });
  } else if (D.treasurer && vaultAgent === D.treasurer.treasurer) {
    // The treasurer is the vault's agent — spend through payFX as operator.
    // Empty price update: the keeper's oracle push keeps the stored rate fresh.
    hash = await wallet.writeContract({
      address: D.treasurer.treasurer,
      abi: verglasTreasurerAbi,
      functionName: "payFX",
      args: [target, AMOUNT, []],
      chain: NET.chain,
      account: signer,
      gas: 400_000n,
      ...TX_FEES,
    });
  } else {
    throw new Error(`agent #${agentId}: keeper key holds neither spend authority nor the operator role`);
  }
  const rc = await pub.waitForTransactionReceipt({ hash });
  if (rc.status !== "success") throw new Error(`spend reverted: ${hash}`);
  log(`agent #${agentId}: spent ${Number(AMOUNT) / 1e6} USDC to ${target} (${hash})`);
}

// 3. The stamp routine — prove, submit, carry, self-deliver. Skipping it hands
//    the window to the scheduled keeper, which runs the same routine on its
//    next pass; the proving artifacts then never have to exist on this machine.
if (NO_STAMP) {
  log(`agent #${agentId}: window and spend are ready — the scheduled keeper will stamp them`);
  process.exit(0);
}
const result = await stampAgent(pub, wallet, agentId, { carry: true, log });
console.log(result === "stamped" ? "RENEWED ✓" : `stamp not reached: ${result}`);
process.exit(result === "stamped" ? 0 : 1);
