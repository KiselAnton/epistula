export function normalizeLower(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function normalizeUpper(s: string | null | undefined): string {
  return (s ?? '').trim().toUpperCase();
}

export function isDuplicateBy<T>(
  list: T[],
  value: T,
  selector: (x: T) => string | number | null | undefined,
  normalize: (s: string | null | undefined) => string = normalizeLower
): boolean {
  const target = normalize(String(selector(value) ?? ''));
  return list.some((x) => normalize(String(selector(x) ?? '')) === target);
}

export function dedupeBy<T>(
  list: T[],
  selector: (x: T) => string | number | null | undefined,
  normalize: (s: string | null | undefined) => string = normalizeLower
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    const key = normalize(String(selector(item) ?? ''));
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}
