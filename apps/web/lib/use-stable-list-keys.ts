'use client';

import { useState } from 'react';

let nextKeyId = 0;

/** Экспортируется для теста — чистая логика ресинка без React. */
export function syncListKeys(keys: number[], length: number): number[] {
  if (keys.length === length) return keys;
  if (keys.length < length) {
    const grown = keys.slice();
    while (grown.length < length) grown.push(nextKeyId++);
    return grown;
  }
  return keys.slice(0, length);
}

/**
 * Стабильные React-ключи для мутируемых списков — вместо `key={i}`, из-за которого удаление
 * из середины переиспользует DOM/фокус соседей. Ресинк длины — сеттером прямо в рендере
 * (паттерн «adjusting state during render»: React перерендеривает синхронно до пейнта).
 */
export function useStableListKeys(length: number) {
  const [keys, setKeys] = useState<number[]>(() => syncListKeys([], length));

  if (keys.length !== length) {
    setKeys(syncListKeys(keys, length));
  }

  return {
    keys,
    add: () => setKeys((k) => [...k, nextKeyId++]),
    remove: (i: number) => setKeys((k) => k.filter((_, j) => j !== i)),
  };
}
