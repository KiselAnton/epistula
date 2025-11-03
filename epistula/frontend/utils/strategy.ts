export type Strategy = 'replace' | 'merge' | 'skip_existing';
export type StrategyMap = Record<string, Strategy>;

const keyFor = (universityId: number) => `dt-strategy:univ:${universityId}`;

export function loadStrategies(universityId: number): StrategyMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(keyFor(universityId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StrategyMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStrategies(universityId: number, map: StrategyMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(keyFor(universityId), JSON.stringify(map ?? {}));
  } catch {
    // ignore
  }
}

export function getStrategyFor(map: StrategyMap, entityKey: string): Strategy {
  const v = map?.[entityKey];
  return (v === 'replace' || v === 'merge' || v === 'skip_existing') ? v : 'merge';
}

export function applyToAll(entityKeys: string[], strategy: Strategy): StrategyMap {
  const out: StrategyMap = {};
  for (const k of entityKeys) out[k] = strategy;
  return out;
}
