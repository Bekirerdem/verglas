/**
 * Independent USD/TRY reference sources feeding the VerglasOracle shim.
 *
 * Pyth's free Hermes endpoint dies with the July 2026 protocol migration, so
 * the keeper now reads two key-less public references (ECB via Frankfurter,
 * plus open.er-api.com), cross-checks them, and signs a PricePayload the
 * VerglasOracle contract verifies with ecrecover. The oracle's own guards
 * (monotonic publishTime, ±10% deviation) and the treasurer's FX breaker sit
 * behind this, so a single bad source read cannot move money.
 */
import { encodeAbiParameters, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export type FxReading = {
  /** 1 USD = X TRY, averaged across the agreeing sources. */
  rate: number;
  /** Half the source spread (same unit as rate) — becomes the payload's conf. */
  conf: number;
  sources: { name: string; rate: number }[];
};

/** Sources must agree within 2% or the push is aborted (daily ECB vs live feeds
 *  typically sit well under 0.5% apart; 2% means something is broken). */
const MAX_SOURCE_SPREAD = 0.02;
/** Confidence assigned when only one source answered: 0.5% of the rate. */
const SINGLE_SOURCE_CONF = 0.005;

async function fromFrankfurter(): Promise<number> {
  const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=TRY");
  if (!res.ok) throw new Error(`frankfurter: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { rates?: { TRY?: number } };
  const rate = data.rates?.TRY;
  if (!rate || rate <= 0) throw new Error("frankfurter: no TRY rate in response");
  return rate;
}

async function fromErApi(): Promise<number> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error(`er-api: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { result?: string; rates?: { TRY?: number } };
  const rate = data.result === "success" ? data.rates?.TRY : undefined;
  if (!rate || rate <= 0) throw new Error("er-api: no TRY rate in response");
  return rate;
}

/** Read USD/TRY from the independent sources; throw if none answer or they disagree. */
export async function fetchUsdTryIndependent(): Promise<FxReading> {
  const candidates = [
    { name: "frankfurter(ECB)", fn: fromFrankfurter },
    { name: "open.er-api", fn: fromErApi },
  ];
  const settled = await Promise.allSettled(candidates.map((c) => c.fn()));
  const sources = candidates
    .map((c, i) => ({ name: c.name, result: settled[i] }))
    .filter((s) => s.result.status === "fulfilled")
    .map((s) => ({ name: s.name, rate: (s.result as PromiseFulfilledResult<number>).value }));

  if (sources.length === 0) {
    const reasons = settled.map((s) => (s.status === "rejected" ? String(s.reason) : "ok")).join(" | ");
    throw new Error(`no FX source answered: ${reasons}`);
  }
  if (sources.length === 1) {
    return { rate: sources[0].rate, conf: sources[0].rate * SINGLE_SOURCE_CONF, sources };
  }

  const [a, b] = [sources[0].rate, sources[1].rate];
  const spread = Math.abs(a - b) / Math.min(a, b);
  if (spread > MAX_SOURCE_SPREAD) {
    throw new Error(`FX sources disagree by ${(spread * 100).toFixed(2)}% — push aborted`);
  }
  return { rate: (a + b) / 2, conf: Math.abs(a - b) / 2, sources };
}

/** All pushes happen at this exponent (the treasurer normalizes anyway). */
export const ORACLE_EXPO = -8;

/**
 * Build one keeper-signed updatePriceFeeds blob for VerglasOracle. The digest
 * binds chain id and oracle address, so a payload cannot be replayed onto
 * another deployment; publishTime monotonicity in the contract kills same-
 * deployment replays.
 */
export async function buildOracleUpdate(opts: {
  privateKey: `0x${string}`;
  oracle: `0x${string}`;
  chainId: number;
  priceId: `0x${string}`;
  rate: number;
  conf: number;
  publishTime?: number;
}): Promise<`0x${string}`> {
  const price = BigInt(Math.round(opts.rate * 1e8));
  const conf = BigInt(Math.round(opts.conf * 1e8));
  const publishTime = BigInt(opts.publishTime ?? Math.floor(Date.now() / 1000));

  const inner = keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "address" },
        { type: "bytes32" },
        { type: "int64" },
        { type: "uint64" },
        { type: "int32" },
        { type: "uint256" },
      ],
      [BigInt(opts.chainId), opts.oracle, opts.priceId, price, conf, ORACLE_EXPO, publishTime],
    ),
  );
  const account = privateKeyToAccount(opts.privateKey);
  const signature = await account.signMessage({ message: { raw: inner } });

  return encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "id", type: "bytes32" },
          { name: "price", type: "int64" },
          { name: "conf", type: "uint64" },
          { name: "expo", type: "int32" },
          { name: "publishTime", type: "uint256" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    [{ id: opts.priceId, price, conf, expo: ORACLE_EXPO, publishTime, signature }],
  );
}
