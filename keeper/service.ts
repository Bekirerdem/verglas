// Verglas keeper service — the always-on heartbeat.
//
// Every tick it:
//   1. discovers every agent ever bound to the Hub (AccountBound events),
//   2. stamps any agent with an open validation window and ≥1 new spend
//      (prove → submitProof → ICM carry),
//   3. reports attestation freshness and warns when one is about to expire
//      (a fresh stamp needs a new owner-signed window + at least one spend —
//      the keeper cannot forge either, by design),
//   4. observes the treasurer's FX breaker state (payment automation stays
//      in the agent package; the service only reports here).
//
// Usage: npx tsx service.ts [--once] [--no-carry] [--tick <seconds>]
import { createPublicClient, http } from "viem";
import { TREASURER_DEPLOYMENT, fujiC, pythAbi, verglasTreasurerAbi } from "@verglas/sdk";
import { clients, discoverAgents, stampAgent, validityOf } from "./lib.js";

const ONCE = process.argv.includes("--once");
const CARRY = !process.argv.includes("--no-carry");
const tickArg = process.argv.indexOf("--tick");
const TICK_S = tickArg >= 0 ? Number(process.argv[tickArg + 1]) : 300;
const EXPIRY_WARN_S = 24 * 3600;

const T = TREASURER_DEPLOYMENT;
const stamp = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const log = (msg: string) => console.log(`[${stamp()}] ${msg}`);

async function observeTreasurer(pub: ReturnType<typeof createPublicClient>) {
  try {
    const [policy, spentToday, paused, price] = await Promise.all([
      pub.readContract({ address: T.treasurer, abi: verglasTreasurerAbi, functionName: "policy" }),
      pub.readContract({ address: T.treasurer, abi: verglasTreasurerAbi, functionName: "spentToday" }),
      pub.readContract({ address: T.treasurer, abi: verglasTreasurerAbi, functionName: "paused" }),
      pub.readContract({
        address: T.pyth,
        abi: pythAbi,
        functionName: "getPriceUnsafe",
        args: [T.usdTryPriceId],
      }),
    ]);
    const ref = policy[2];
    const expo = price[2];
    const shift = expo - -8;
    const raw = BigInt(price[0]);
    const live = shift >= 0 ? raw * 10n ** BigInt(shift) : raw / 10n ** BigInt(-shift);
    const diff = live > ref ? live - ref : ref - live;
    const devBps = ref > 0n ? Number((diff * 1_000_000n) / ref) / 100 : 0;
    const state = paused ? "PAUSED" : devBps > policy[1] ? "BREAKER-TRIPPED" : "OK";
    log(
      `treasurer #${T.agentId}: ${state} · live ${(Number(live) / 1e8).toFixed(4)} vs ref ${(Number(ref) / 1e8).toFixed(4)} ` +
        `(${devBps.toFixed(1)}bps/${policy[1]}bps) · today ${(Number(spentToday) / 1e6).toFixed(2)}/${(Number(policy[0]) / 1e6).toFixed(2)} USDC`,
    );
  } catch (e) {
    log(`treasurer observe failed: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
  }
}

async function tick(): Promise<void> {
  const { pub, gatePub, wallet } = clients();

  const agents = await discoverAgents(pub);
  log(`tick — ${agents.size} bound agent(s): ${[...agents.keys()].map((a) => `#${a}`).join(", ")}`);

  for (const [agentId] of agents) {
    try {
      const result = await stampAgent(pub, wallet, agentId, { carry: CARRY, log });
      if (result === "no-request") {
        const v = await validityOf(pub, gatePub, agentId);
        if (!v) {
          log(`agent #${agentId}: no attestation and no open window — owner must open the stamp line`);
        } else if (v.secondsLeft <= 0) {
          log(`agent #${agentId}: attestation EXPIRED — owner must reopen a window (+1 spend) to re-stamp`);
        } else if (v.secondsLeft < EXPIRY_WARN_S) {
          log(`agent #${agentId}: expires in ${(v.secondsLeft / 3600).toFixed(1)}h — reopen a window soon`);
        } else {
          log(`agent #${agentId}: fresh (${(v.secondsLeft / 86400).toFixed(1)}d left)`);
        }
      } else if (result === "empty-window") {
        log(`agent #${agentId}: window open but no new spends — waiting for payments`);
      }
    } catch (e) {
      log(`agent #${agentId}: ERROR ${e instanceof Error ? e.message.slice(0, 120) : e}`);
    }
  }

  await observeTreasurer(pub as unknown as ReturnType<typeof createPublicClient>);
}

async function main() {
  log(`keeper service starting — tick ${TICK_S}s, carry ${CARRY ? "on" : "off"}${ONCE ? ", single pass" : ""}`);
  for (;;) {
    await tick().catch((e) => log(`tick failed: ${e instanceof Error ? e.message.slice(0, 120) : e}`));
    if (ONCE) break;
    await new Promise((r) => setTimeout(r, TICK_S * 1000));
  }
  process.exit(0);
}

main();
