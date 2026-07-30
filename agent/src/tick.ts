/**
 * One-shot keeper tick: read the live USD/TRY from the independent FX sources,
 * build the strategy inputs (window low from the ECB daily series), decide, and
 * if the decision is "convert" execute VerglasTreasurer.payFX on Fuji with a
 * keeper-signed VerglasOracle update (Pyth's free Hermes died July 2026).
 *
 * Run (repo root .env supplies PRIVATE_KEY):
 *   TREASURER_ADDRESS=0x... npm run tick
 * Optional env: SUPPLIER (default 0xA1), AMOUNT_USDC (base units, default 1e6),
 * DAYS_TO_DEADLINE (default 0 = due today, deterministic demo), WINDOW_DAYS (15).
 *
 * Deliberately one-shot, no daemon: schedule externally (cron/keeper) when the
 * fleet needs it. Mirrors Hazinedar's demo cadence.
 */
import { createPublicClient, createWalletClient, http, parseAbi, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import { decideConversion } from "./strategy.ts";
import { buildOracleUpdate, fetchUsdTryIndependent } from "@verglas/sdk/fx";
import { USD_TRY_FEED_ID } from "./pyth.ts";
import { fetchUsdTry, ratesOf } from "./backtest/fetchRates.ts";

const treasurerAbi = parseAbi([
  "function payFX(address supplier, uint256 amountUsdc, bytes[] priceUpdate) payable",
  "function spentToday() view returns (uint256)",
  "function pyth() view returns (address)",
]);
const pythAbi = parseAbi(["function getUpdateFee(bytes[] updateData) view returns (uint256)"]);

const TREASURER = requireEnv("TREASURER_ADDRESS") as `0x${string}`;
const PRIVATE_KEY = requireEnv("PRIVATE_KEY") as `0x${string}`;
const SUPPLIER = (process.env.SUPPLIER ?? "0x00000000000000000000000000000000000000A1") as `0x${string}`;
const AMOUNT_USDC = BigInt(process.env.AMOUNT_USDC ?? "1000000"); // 1 USDC
const DAYS_TO_DEADLINE = Number(process.env.DAYS_TO_DEADLINE ?? "0");
const WINDOW_DAYS = Number(process.env.WINDOW_DAYS ?? "15");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var is required`);
  return v;
}

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// 1. Live rate from the independent sources (signed payload built after we
//    know which oracle the treasurer points at).
const reading = await fetchUsdTryIndependent();
console.log(
  `[tick] USD/TRY ${reading.rate.toFixed(4)} ± ${reading.conf.toFixed(4)} ` +
    `(${reading.sources.map((s) => s.name).join(", ")})`,
);

// 2. Window low from the ECB daily series (frankfurter).
const series = await fetchUsdTry(isoDaysAgo(WINDOW_DAYS + 3), isoDaysAgo(0));
const recentMin = Math.min(...ratesOf(series).slice(-WINDOW_DAYS), reading.rate);
console.log(`[tick] window low (${WINDOW_DAYS}d): ${recentMin.toFixed(4)}`);

// 3. Decide.
const decision = decideConversion({
  daysToDeadline: DAYS_TO_DEADLINE,
  windowDays: WINDOW_DAYS,
  currentRate: reading.rate,
  recentMin,
  alreadyConverted: false,
});
console.log(`[tick] decision: ${decision.action.toUpperCase()} — ${decision.reason}`);
if (decision.action === "hold") {
  process.exit(0);
}

// 4. Convert: payFX with a keeper-signed oracle update; fee is zero on the shim.
const pk = (PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`) as `0x${string}`;
const account = privateKeyToAccount(pk);
const publicClient = createPublicClient({ chain: avalancheFuji, transport: http() });
const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http() });

const pythAddress = await publicClient.readContract({ address: TREASURER, abi: treasurerAbi, functionName: "pyth" });
const updateData = [
  await buildOracleUpdate({
    privateKey: pk,
    oracle: pythAddress,
    chainId: avalancheFuji.id,
    priceId: `0x${USD_TRY_FEED_ID}`,
    rate: reading.rate,
    conf: reading.conf,
  }),
];
const fee = await publicClient.readContract({
  address: pythAddress,
  abi: pythAbi,
  functionName: "getUpdateFee",
  args: [updateData],
});

// Explicit gas/fees: Fuji RPC intermittently feeds viem estimation values
// that build an unsendable tx (seen live on this exact flow).
const hash = await walletClient.writeContract({
  address: TREASURER,
  abi: treasurerAbi,
  functionName: "payFX",
  args: [SUPPLIER, AMOUNT_USDC, updateData],
  value: fee,
  gas: 400_000n,
  maxFeePerGas: 30_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
});
console.log(`[tick] payFX sent: https://testnet.snowtrace.io/tx/${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
const spent = await publicClient.readContract({ address: TREASURER, abi: treasurerAbi, functionName: "spentToday" });
console.log(`[tick] status: ${receipt.status} | spent today: ${formatUnits(spent, 6)} USDC`);
