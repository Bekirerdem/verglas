import { formatUnits } from "viem";

export const short = (hex: string, head = 6, tail = 4) =>
  `${hex.slice(0, head)}…${hex.slice(-tail)}`;

export const usd = (v: bigint) => {
  const n = Number(formatUnits(v, 6));
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const utcDate = (unix: bigint) =>
  new Date(Number(unix) * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }) + " UTC";

/** "6d 22h" style countdown; empty string when past. */
export const remaining = (deadlineUnix: bigint) => {
  const secs = Number(deadlineUnix) - Math.floor(Date.now() / 1000);
  if (secs <= 0) return "";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((secs % 3600) / 60)}m`;
};
