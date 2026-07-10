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
 * Стабильные React-ключи для мутируемых списков (add/remove по индексу) —
 * без `key={i}`, из-за которого удаление из середины переиспользует DOM/фокус
 * соседних строк. `add`/`remove` держат состояние в синхроне с операциями
 * списка; при внешнем рассинхроне длины (сброс формы) — дозаполнение/усечение
 * с конца через сеттер прямо в рендере (санкционированный React-паттерн
 * «adjusting state during render» — не ref, эффекта не требуется, лишнего
 * коммита тоже: React перерендеривает синхронно до пейнта).
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
