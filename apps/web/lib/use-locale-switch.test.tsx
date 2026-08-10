// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/releases',
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

import { useLocaleSwitch } from './use-locale-switch';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NextIntlClientProvider locale="ru" messages={{}}>{children}</NextIntlClientProvider>
);

describe('useLocaleSwitch', () => {
  beforeEach(() => {
    replace.mockClear();
    refresh.mockClear();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null))));
  });

  it('меняет локаль на текущем пути', async () => {
    const { result } = renderHook(() => useLocaleSwitch(), { wrapper });
    await act(async () => result.current.switchLocale('en'));
    expect(replace).toHaveBeenCalledWith('/releases', { locale: 'en' });
  });

  // корневой layout (провайдер next-intl, <html lang>) не входит в дифф soft-навигации
  it('обновляет дерево, иначе клиентские переводы остаются на старой локали', async () => {
    const { result } = renderHook(() => useLocaleSwitch(), { wrapper });
    await act(async () => result.current.switchLocale('en'));
    expect(refresh).toHaveBeenCalled();
  });

  it('сохраняет выбор в профиль', async () => {
    const { result } = renderHook(() => useLocaleSwitch(), { wrapper });
    await act(async () => result.current.switchLocale('en'));
    expect(fetch).toHaveBeenCalledWith('/api/v1/user/profile', expect.objectContaining({ method: 'PATCH' }));
    expect((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body).toBe(JSON.stringify({ locale: 'en' }));
  });

  it('на текущей локали ничего не делает', async () => {
    const { result } = renderHook(() => useLocaleSwitch(), { wrapper });
    await act(async () => result.current.switchLocale('ru'));
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
