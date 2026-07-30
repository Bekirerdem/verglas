/**
 * One-shot oracle push: read USD/TRY from the independent sources, sign with
 * the keeper key, push to VerglasOracle and read it back. While the free
 * Hermes endpoint is still alive (pre-cutover) the push is also cross-checked
 * against Pyth and the deviation printed.
 *
 * Run (repo root .env supplies PRIVATE_KEY):
 *   ORACLE_ADDRESS=0x... npm run push-fx
 */
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";
import { buildOracleUpdate, fetchUsdTryIndependent } from "@verglas/sdk/fx";
import { fetchUsdTryFromHermes, USD_TRY_FEED_ID } from "./pyth.ts";

const oracleAbi = parseAbi([
  "function updatePriceFeeds(bytes[] updateData) payable",
  "function getPriceNoOlderThan(bytes32 id, uint256 age) view returns ((int64 price, uint64 conf, int32 expo, uint256 publishTime))",
]);

const ORACLE = requireEnv("ORACLE_ADDRESS") as `0x${string}`;
const PRIVATE_KEY = requireEnv("PRIVATE_KEY");
const PRICE_ID = `0x${USD_TRY_FEED_ID}` as `0x${string}`;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var is required`);
  return v;
}

const pk = (PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`) as `0x${string}`;
const account = privateKeyToAccount(pk);
const publicClient = createPublicClient({ chain: avalancheFuji, transport: http() });
const walletClient = createWalletClient({ account, chain: avalancheFuji, transport: http() });

const reading = await fetchUsdTryIndependent();
console.log(
  `[push-fx] USD/TRY ${reading.rate.toFixed(6)} ± ${reading.conf.toFixed(6)} ` +
    `(${reading.sources.map((s) => `${s.name}=${s.rate}`).join(", ")})`,
);

const update = await buildOracleUpdate({
  privateKey: pk,
  oracle: ORACLE,
  chainId: avalancheFuji.id,
  priceId: PRICE_ID,
  rate: reading.rate,
  conf: reading.conf,
});

// Explicit gas and fees: Fuji's RPC feeds viem's automatic estimation values
// that produce an unsendable tx (seen live: ~1.5e16 gas limit, sub-gwei fees).
// A push costs ~80k gas; 25 nAVAX is the C-Chain base fee ceiling headroom.
const hash = await walletClient.writeContract({
  address: ORACLE,
  abi: oracleAbi,
  functionName: "updatePriceFeeds",
  args: [[update]],
  gas: 150_000n,
  maxFeePerGas: 30_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
});
console.log(`[push-fx] push sent: https://testnet.snowtrace.io/tx/${hash}`);
const receipt = await publicClient.waitForTransactionReceipt({ hash });

const stored = await publicClient.readContract({
  address: ORACLE,
  abi: oracleAbi,
  functionName: "getPriceNoOlderThan",
  args: [PRICE_ID, 300n],
});
console.log(
  `[push-fx] status: ${receipt.status} | stored: ${Number(stored.price) / 1e8} ` +
    `(expo ${stored.expo}, published ${new Date(Number(stored.publishTime) * 1000).toISOString()})`,
);

// Cross-check against Pyth while its free endpoint still answers.
try {
  const hermes = await fetchUsdTryFromHermes();
  const devBps = Math.abs(reading.rate - hermes.rate) / hermes.rate / 0.0001;
  console.log(`[push-fx] Hermes cross-check: ${hermes.rate.toFixed(6)} — deviation ${devBps.toFixed(1)} bps`);
} catch {
  console.log("[push-fx] Hermes cross-check unavailable (post-cutover — expected)");
}
