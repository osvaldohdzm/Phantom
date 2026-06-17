/** Orden: Crítica → Alta → Media → Baja → Info */
export const SEVERITY_SORT_RANK: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
  Info: 4,
};

export function compareBySeverity(a: string, b: string): number {
  const ra = SEVERITY_SORT_RANK[a] ?? 99;
  const rb = SEVERITY_SORT_RANK[b] ?? 99;
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b);
}

export function sortBySeverity<T>(items: T[], getSeverity: (item: T) => string): T[] {
  return [...items].sort((x, y) => compareBySeverity(getSeverity(x), getSeverity(y)));
}
