import { useCallback, useEffect, useRef } from 'react';

/**
 * Гасит поток значений жеста до ОДНОГО на кадр.
 *
 * Колбэк `runOnJS`-жеста прилетает отдельным событием, и React сводит каждое в собственный
 * рендер. На тяжёлом дереве очередь растёт быстрее, чем разгребается: палец уже ушёл, а
 * экран доигрывает старые кадры — движение читается ступенями, хотя ни один кадр не потерян.
 * Здесь держится только последнее значение, остальные просто теряются: для перетаскивания
 * промежуточные положения пальца не нужны.
 */
export function useFrameThrottle<T>(apply: (value: T) => void): (value: T) => void {
  const pending = useRef<{ value: T } | null>(null);
  const frame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const target = useRef(apply);
  target.current = apply;

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return useCallback((value: T) => {
    pending.current = { value };
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const next = pending.current;
      pending.current = null;
      if (next) target.current(next.value);
    });
  }, []);
}
