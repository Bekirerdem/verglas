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

/** "6d 22h" style countdown; empty string when past. Pass a unit set to
    localize the suffixes (TR reads "6g 22s"). */
export const SPAN_UNITS_TR = { d: "g", h: "s", m: "d" } as const;
export const remaining = (deadlineUnix: bigint, u = { d: "d", h: "h", m: "m" }) => {
  const secs = Number(deadlineUnix) - Math.floor(Date.now() / 1000);
  if (secs <= 0) return "";
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  return d > 0 ? `${d}${u.d} ${h}${u.h}` : `${h}${u.h} ${Math.floor((secs % 3600) / 60)}${u.m}`;
};
