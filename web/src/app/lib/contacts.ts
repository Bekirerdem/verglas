import type { Address } from "viem";

/** Local, per-browser address book. The chain knows addresses; the owner
    knows people. Names never leave the device — same model as vault names. */
const KEY = "verglas-contacts";

export function contacts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function contactName(addr: Address | string | null | undefined): string | null {
  if (!addr) return null;
  return contacts()[addr.toLowerCase()] ?? null;
}

export function setContactName(addr: Address | string, name: string): void {
  const all = contacts();
  const key = addr.toLowerCase();
  if (name.trim() === "") delete all[key];
  else all[key] = name.trim();
  localStorage.setItem(KEY, JSON.stringify(all));
}

/** Two-letter avatar initials from a contact name (or address tail). */
export function initials(name: string | null, addr: string): string {
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
  }
  return addr.slice(2, 4).toUpperCase();
}
