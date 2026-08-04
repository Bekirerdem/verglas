// Verglas keeper service — the always-on heartbeat.
//
// Every tick it:
//   1. refreshes the FX price on the VerglasOracle shim — the treasurer's
//      circuit breaker rejects a stale price, so this is what keeps payFX
//      alive now that Pyth's free feed is gone,
//   2. discovers every agent ever bound to the Hub (AccountBound events),
//   3. stamps any agent with an open validation window and >=1 new spend
//      (prove -> submitProof -> ICM carry; where no relayer serves the lane
//      the keeper also aggregates the Warp signature and delivers the
//      message to the gate chain itself),
//   4. re-carries an attestation whose gate clearance is about to lapse: the
//      Hub's proof is still valid, only the far-side copy ages out, and
//      carrying needs no owner signature,
//   5. reports freshness and says plainly when only the owner can act (a new
//      stamp needs an owner-signed window plus at least one spend — the
//      keeper can forge neither, by design),
//   6. observes the treasurer's FX breaker state.
//
// Usage: npx tsx service.ts [--once] [--no-carry] [--no-oracle] [--tick <seconds>]
// Env:   VERGLAS_NETWORK=fuji|avalanche (default fuji)
//        PRIVATE_KEY — the keeper key; falls back to the repo's .env
//        VERGLAS_AGG_URL — signature-aggregator endpoint for self-delivered
//        lanes (default http://127.0.0.1:8080/aggregate-signatures)
//
// Under --once the exit code is the whole monitoring stack: 1 means the keeper
// could not do its job (see `fail` below), so the scheduled run goes red and
// GitHub mails us. Waiting on the owner is not a failure.
import { createPublicClient, formatEther } from "viem";
import { pythAbi, verglasTreasurerAbi } from "@verglas/sdk";
import { NET, carryAttestation, clients, discoverAgents, pushFxPrice, stampAgent, validityOf } from "./lib.js";

const ONCE = process.argv.includes("--once");
const CARRY = !process.argv.includes("--no-carry");
const ORACLE = !process.argv.includes("--no-oracle");
const tickArg = process.argv.indexOf("--tick");
const TICK_S = tickArg >= 0 ? Number(process.argv[tickArg + 1]) : 300;

/** Warn this far before a stamp expires — renewing needs the owner. */
const EXPIRY_WARN_S = 24 * 3600;
/** Re-carry this far before the gate copy lapses (keeper can fix this alone). */
const RECARRY_S = 12 * 3600;
/** Skip the push while the stored price is younger than this: ticking faster
 *  than the feed's own resolution would only burn gas. */
const PRICE_FRESH_S = 20 * 60;
/** Below this the wallet is too thin to be trusted with the next few days of
 *  ticks (a stamp costs ~0.03 AVAX at the pinned fees, a price push ~0.002). */
const MIN_BALANCE = 30_000_000_000_000_000n; // 0.03 AVAX

const T = NET.deployment!.treasurer;
const stamp = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const log = (msg: string) => console.log(`[${stamp()}] ${msg}`);
const short = (e: unknown) => (e instanceof Error ? e.message.split("\n")[0].slice(0, 140) : String(e));

/** Something the keeper was supposed to do and could not: a thin wallet, a
 *  needed price push that failed, an agent whose stamp or carry threw. Logged
 *  like everything else, but it also colours the --once exit code. */
let failed = false;
const fail = (msg: string) => {
  failed = true;
  log(msg);
};

type Pub = ReturnType<typeof createPublicClient>;

/** Age of the price currently on the shim, in seconds (Infinity if never pushed). */
async function storedPriceAge(pub: Pub): Promise<number> {
  if (!T) return Infinity;
  try {
    const price = await pub.readContract({
      address: T.pyth,
      abi: pythAbi,
      functionName: "getPriceUnsafe",
      args: [T.usdTryPriceId],
    });
    return Math.floor(Date.now() / 1000) - Number(price[3]);
  } catch {
    return Infinity; // never pushed, or the read failed — attempt a push
  }
}

async function observeTreasurer(pub: Pub) {
  if (!T) return; // no treasurer vertical on this network
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
    const shift = price[2] - -8;
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
    log(`treasurer observe failed: ${short(e)}`);
  }
}

async function tick(): Promise<void> {
  const { pub, gatePub, wallet, signer } = clients();

  const balance = await pub.getBalance({ address: signer.address });
  const avax = `${Number(formatEther(balance)).toFixed(4)} AVAX`;
  if (balance < MIN_BALANCE) fail(`keeper ${signer.address}: ${avax} left — top the wallet up`);
  else log(`keeper ${signer.address}: ${avax}`);

  if (ORACLE && T) {
    // A failed push must never stop stamping: the vault's rules are enforced
    // on-chain whatever the FX feed is doing.
    try {
      const age = await storedPriceAge(pub);
      if (age < PRICE_FRESH_S) log(`oracle: stored price ${Math.round(age / 60)} min old — no push needed`);
      else await pushFxPrice(pub, wallet, log);
    } catch (e) {
      fail(`oracle push FAILED: ${short(e)}`);
    }
  }

  const agents = await discoverAgents(pub);
  log(`tick — ${agents.size} bound agent(s): ${[...agents.keys()].map((a) => `#${a}`).join(", ")}`);

  for (const [agentId] of agents) {
    try {
      const result = await stampAgent(pub, wallet, agentId, { carry: CARRY, log });
      if (result === "stamped") continue;

      const v = await validityOf(pub, gatePub, agentId);
      if (!v) {
        log(`agent #${agentId}: no attestation and no open window — owner must open the stamp line`);
      } else if (v.secondsLeft <= 0) {
        log(`agent #${agentId}: attestation EXPIRED — owner must reopen a window (+1 spend) to re-stamp`);
      } else if (result === "empty-window") {
        log(`agent #${agentId}: window open but no new spends — waiting for payments`);
      } else if (!v.gateSeen) {
        log(
          `agent #${agentId}: Hub stamp fresh (${(v.secondsLeft / 86400).toFixed(1)}d) but the gate chain is ` +
            `unreachable — clearance unverified, re-carry deferred`,
        );
      } else if (CARRY && NET.deployment!.gate && v.secondsLeft < RECARRY_S) {
        log(`agent #${agentId}: clearance lapses in ${(v.secondsLeft / 3600).toFixed(1)}h — re-carrying`);
        await carryAttestation(pub, wallet, agentId, log);
      } else if (v.secondsLeft < EXPIRY_WARN_S) {
        log(`agent #${agentId}: expires in ${(v.secondsLeft / 3600).toFixed(1)}h — reopen a window soon`);
      } else {
        log(`agent #${agentId}: fresh (${(v.secondsLeft / 86400).toFixed(1)}d left)`);
      }
    } catch (e) {
      fail(`agent #${agentId}: ERROR ${short(e)}`);
    }
  }

  await observeTreasurer(pub);
}

async function main() {
  log(
    `keeper service starting — network ${NET.label}, tick ${TICK_S}s, ` +
      `carry ${CARRY ? "on" : "off"}, oracle ${ORACLE ? "on" : "off"}${ONCE ? ", single pass" : ""}`,
  );
  for (;;) {
    await tick().catch((e) => fail(`tick failed: ${short(e)}`));
    if (ONCE) break;
    await new Promise((r) => setTimeout(r, TICK_S * 1000));
  }
  process.exit(failed ? 1 : 0);
}

main();
