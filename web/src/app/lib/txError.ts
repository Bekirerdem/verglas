/** A wallet error is only actionable if the user can read WHY. viem stacks are
    long, so surface the line that carries the actual cause. */
export function txErrorReason(e: unknown): string {
  if (!(e instanceof Error)) return String(e).slice(0, 160);
  const lines = e.message
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const detail =
    lines.find((l) => /details:|reason:/i.test(l)) ??
    lines.find((l) => /reverted|rejected|denied|insufficient|chain/i.test(l));
  return (detail ?? lines[0] ?? e.message).slice(0, 200);
}
