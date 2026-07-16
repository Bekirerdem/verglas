/**
 * Hermes (Pyth's price service) client: fetches the latest USD/TRY price and
 * the binary update payload that VerglasTreasurer.payFX() forwards on-chain.
 *
 * NOTE: hermes.pyth.network requires an API key starting 2026-07-31 (Pyth Core
 * plans). This module targets the pre-cutover free endpoint; M2 swaps in
 * an authenticated endpoint via HERMES_URL.
 */

export const USD_TRY_FEED_ID = "032a2eba1c2635bf973e95fb62b2c0705c1be2603b9572cc8d5edeaf8744e058";

const HERMES_URL = process.env.HERMES_URL ?? "https://hermes.pyth.network";

export type HermesPrice = {
  /** Normalized float rate (1 USD = X TRY). */
  rate: number;
  publishTime: number;
  /** 0x-prefixed update blobs for IPyth.updatePriceFeeds. */
  updateData: `0x${string}`[];
};

export async function fetchUsdTryFromHermes(feedId: string = USD_TRY_FEED_ID): Promise<HermesPrice> {
  const url = `${HERMES_URL}/v2/updates/price/latest?ids[]=${feedId}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`hermes fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as {
    binary: { encoding: string; data: string[] };
    parsed: { price: { price: string; expo: number; publish_time: number } }[];
  };
  const p = data.parsed[0].price;
  const rate = Number(p.price) * 10 ** p.expo;
  const updateData = data.binary.data.map((d) => (d.startsWith("0x") ? d : `0x${d}`) as `0x${string}`);
  return { rate, publishTime: p.publish_time, updateData };
}
