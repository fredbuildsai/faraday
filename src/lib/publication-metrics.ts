export function openAccessPercentage(total: number | null, open: number | null): number | null {
  if (total == null || open == null || !Number.isFinite(total) || !Number.isFinite(open) || total <= 0 || open < 0 || open > total) return null;
  return Math.round(open / total * 100);
}