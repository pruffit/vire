// Насыщающие кривые для скоринга — сигнал не растёт линейно с n, у роста есть отдача.

/** Линейный клэмп: растёт до 1 ровно к n=k, дальше не растёт. */
export function saturateLinear(n: number, k: number): number {
  return Math.min(1, Math.max(0, n) / k);
}

/** Лог-асимптотика: тот же принцип, но без жёсткого потолка — k задаёт крутизну подхода к 1. */
export function saturateLog(n: number, k: number): number {
  return n <= 0 ? 0 : Math.log1p(n) / Math.log1p(n + k);
}
