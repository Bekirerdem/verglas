/**
 * Fetches historical and live USD/TRY rates (frankfurter.app — ECB based,
 * free, no key required). Ported from Hazinedar.
 */
export type RatePoint = { date: string; rate: number };

export async function fetchUsdTry(start: string, end: string): Promise<RatePoint[]> {
  const url = `https://api.frankfurter.app/${start}..${end}?from=USD&to=TRY`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`frankfurter fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { rates: Record<string, { TRY: number }> };
  const points = Object.entries(data.rates)
    .map(([date, obj]) => ({ date, rate: obj.TRY }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (points.length === 0) {
    throw new Error("frankfurter returned an empty series");
  }
  return points;
}

/** Ordered rate series as plain numbers. */
export function ratesOf(points: RatePoint[]): number[] {
  return points.map((p) => p.rate);
}
