// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';

const prefetchMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ prefetch: prefetchMock }) }));

vi.mock('@/lib/offline/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/offline/db')>();
  return { ...actual, purgeOfflineLibrary: vi.fn().mockResolvedValue(undefined) };
});

import { purgeOfflineLibrary } from '@/lib/offline/db';
import { ServiceWorkerRegistrar } from './service-worker-registrar';

const OWNER_KEY = 'vire-offline-owner';

function stubServiceWorker(registerImpl: () => Promise<{ active: { postMessage: ReturnType<typeof vi.fn> } | null; waiting: null; installing: null }>) {
  Object.defineProperty(window.navigator, 'serviceWorker', {
    value: { register: vi.fn(registerImpl) },
    configurable: true,
  });
}

beforeEach(() => {
  prefetchMock.mockClear();
  vi.mocked(purgeOfflineLibrary).mockClear();
  localStorage.clear();
  Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window.navigator, 'serviceWorker');
});

describe('ServiceWorkerRegistrar', () => {
  it('после успешной регистрации прогревает /offline через router.prefetch', async () => {
    const postMessage = vi.fn();
    stubServiceWorker(async () => ({ active: { postMessage }, waiting: null, installing: null }));

    render(<ServiceWorkerRegistrar userId="u1" />);

    await waitFor(() => expect(prefetchMock).toHaveBeenCalledWith('/offline'));
    expect(postMessage).toHaveBeenCalledWith({ type: 'SET_OWNER', id: 'u1' });
  });

  it('serviceWorker недоступен в браузере — не прогревает и не падает', () => {
    Reflect.deleteProperty(window.navigator, 'serviceWorker');
    render(<ServiceWorkerRegistrar userId={null} />);
    expect(prefetchMock).not.toHaveBeenCalled();
  });

  it('регистрация упала — prefetch не вызывается', async () => {
    stubServiceWorker(async () => { throw new Error('no sw'); });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ServiceWorkerRegistrar userId="u1" />);

    await waitFor(() => expect(errSpy).toHaveBeenCalled());
    expect(prefetchMock).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('владелец сменился — чистит офлайн-библиотеку перед регистрацией и запоминает нового', async () => {
    localStorage.setItem(OWNER_KEY, 'u1');
    const postMessage = vi.fn();
    stubServiceWorker(async () => ({ active: { postMessage }, waiting: null, installing: null }));

    render(<ServiceWorkerRegistrar userId="u2" />);

    await waitFor(() => expect(prefetchMock).toHaveBeenCalledWith('/offline'));
    expect(purgeOfflineLibrary).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(OWNER_KEY)).toBe('u2');
  });

  it('тот же владелец — не чистит офлайн-библиотеку', async () => {
    localStorage.setItem(OWNER_KEY, 'u1');
    const postMessage = vi.fn();
    stubServiceWorker(async () => ({ active: { postMessage }, waiting: null, installing: null }));

    render(<ServiceWorkerRegistrar userId="u1" />);

    await waitFor(() => expect(prefetchMock).toHaveBeenCalledWith('/offline'));
    expect(purgeOfflineLibrary).not.toHaveBeenCalled();
  });

  it('первый заход анонима — сохранённого владельца нет, не чистит, запоминает anon', async () => {
    const postMessage = vi.fn();
    stubServiceWorker(async () => ({ active: { postMessage }, waiting: null, installing: null }));

    render(<ServiceWorkerRegistrar userId={null} />);

    await waitFor(() => expect(prefetchMock).toHaveBeenCalledWith('/offline'));
    expect(purgeOfflineLibrary).not.toHaveBeenCalled();
    expect(localStorage.getItem(OWNER_KEY)).toBe('anon');
  });
});
