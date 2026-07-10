'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { toast } from '@/components/toast';
import type { ApiResult } from '@vire/api-client';

interface UseOptimisticToggleOptions {
  id: string;
  initial: boolean;
  initialCount?: number;
  request: (next: boolean) => Promise<ApiResult<unknown>>;
  errorMessage?: string;
}

const DEFAULT_ERROR_MESSAGE = 'Не удалось сохранить. Попробуй ещё раз';

/** Оптимистичный флип флага (+ опционального счётчика) с откатом и тостом при ошибке сети/сервера. */
export function useOptimisticToggle({ id, initial, initialCount = 0, request, errorMessage }: UseOptimisticToggleOptions) {
  const [on, setOn] = useState(initial);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);
  // pending (state) годится только для UI; guard от повторного клика должен читать
  // актуальное значение синхронно — состояние React обновляется асинхронно.
  const pendingRef = useRef(false);

  const [syncedId, setSyncedId] = useState(id);
  const idRef = useRef(id);

  // Next переиспользует инстанс при переходе между соседними динамическими
  // сегментами (трек→трек): пропсы новые, состояние — нет. Сбрасываем в рендере.
  if (id !== syncedId) {
    setSyncedId(id);
    setOn(initial);
    setCount(initialCount);
    setPending(false);
  }

  // React запрещает мутировать рефы во время рендера — синкаем их сразу после коммита,
  // до пейнта, т.е. заведомо раньше, чем пользователь успеет кликнуть по новой сущности.
  useLayoutEffect(() => {
    if (idRef.current !== id) {
      idRef.current = id;
      pendingRef.current = false;
    }
  }, [id]);

  async function toggle() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);

    const requestId = id;
    const next = !on;
    setOn(next);
    setCount((c) => c + (next ? 1 : -1));

    try {
      const res = await request(next);
      if (idRef.current !== requestId) return; // ответ протух, состояние уже пересеяно
      if (!res.ok) {
        setOn(!next);
        setCount((c) => c + (next ? -1 : 1));
        toast.error(errorMessage ?? DEFAULT_ERROR_MESSAGE);
      }
    } finally {
      if (idRef.current === requestId) {
        pendingRef.current = false;
        setPending(false);
      }
    }
  }

  return { on, count, pending, toggle };
}
