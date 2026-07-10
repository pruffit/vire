// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useStableListKeys } from '../use-stable-list-keys';

describe('useStableListKeys', () => {
  it('выдаёт разные ключи для каждого элемента', () => {
    const { result } = renderHook(() => useStableListKeys(3));
    const { keys } = result.current;
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
  });

  it('add() добавляет новый уникальный ключ в конец', () => {
    const { result, rerender } = renderHook(({ length }) => useStableListKeys(length), {
      initialProps: { length: 2 },
    });
    const before = result.current.keys;

    act(() => {
      result.current.add();
    });
    rerender({ length: 3 });

    const after = result.current.keys;
    expect(after).toHaveLength(3);
    expect(after.slice(0, 2)).toEqual(before);
    expect(after[2]).not.toBe(before[0]);
    expect(after[2]).not.toBe(before[1]);
  });

  it('remove(i) из середины сохраняет ключи оставшихся элементов', () => {
    const { result, rerender } = renderHook(({ length }) => useStableListKeys(length), {
      initialProps: { length: 3 },
    });
    const before = result.current.keys;

    act(() => {
      result.current.remove(1);
    });
    rerender({ length: 2 });

    const after = result.current.keys;
    expect(after).toEqual([before[0], before[2]]);
  });

  it('внешнее укорочение списка (без remove) усекает ключи с конца', () => {
    const { result, rerender } = renderHook(({ length }) => useStableListKeys(length), {
      initialProps: { length: 4 },
    });
    const before = result.current.keys;

    rerender({ length: 2 });

    expect(result.current.keys).toEqual(before.slice(0, 2));
  });

  it('внешний рост длины (без add) дозаполняет новыми ключами', () => {
    const { result, rerender } = renderHook(({ length }) => useStableListKeys(length), {
      initialProps: { length: 1 },
    });
    const before = result.current.keys;

    rerender({ length: 3 });

    const after = result.current.keys;
    expect(after).toHaveLength(3);
    expect(after[0]).toBe(before[0]);
    expect(new Set(after).size).toBe(3);
  });
});
