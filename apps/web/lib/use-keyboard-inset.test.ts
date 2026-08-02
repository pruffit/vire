// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useKeyboardInset } from './use-keyboard-inset';

interface FakeViewport extends EventTarget {
  height: number;
  offsetTop: number;
}

function stubViewport(height: number): FakeViewport {
  const vv = Object.assign(new EventTarget(), { height, offsetTop: 0 });
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  return vv;
}

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
});

describe('useKeyboardInset', () => {
  it('без visualViewport отдаёт 0', () => {
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);
  });

  it('сжатие вьюпорта клавиатурой отдаётся как перекрытие снизу', () => {
    const vv = stubViewport(window.innerHeight);
    const { result } = renderHook(() => useKeyboardInset());
    expect(result.current).toBe(0);

    act(() => {
      vv.height = window.innerHeight - 320;
      vv.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(320);
  });

  it('снимает подписки при размонтировании', () => {
    const vv = stubViewport(window.innerHeight);
    const { result, unmount } = renderHook(() => useKeyboardInset());
    unmount();

    act(() => {
      vv.height = window.innerHeight - 200;
      vv.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(0);
  });
});
