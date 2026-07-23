/** Local, per-browser payment memos keyed by tx hash. The chain has no
    memo field; the business still needs "why did I pay this" — same
    device-local model as contacts and vault names. */
const KEY = "verglas-memos";

function all(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function memoFor(txHash: string): string | null {
  return all()[txHash.toLowerCase()] ?? null;
}

export function setMemo(txHash: string, memo: string): void {
  const store = all();
  const key = txHash.toLowerCase();
  if (memo.trim() === "") delete store[key];
  else store[key] = memo.trim();
  localStorage.setItem(KEY, JSON.stringify(store));
}
