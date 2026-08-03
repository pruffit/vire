// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { InstallAppButton } from './install-app-button';

function stubMatchMedia(standalone: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: standalone && query === '(display-mode: standalone)',
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function fireBeforeInstallPrompt(overrides: Partial<{ prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> }> = {}) {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };
  event.prompt = overrides.prompt ?? vi.fn().mockResolvedValue(undefined);
  event.userChoice = overrides.userChoice ?? Promise.resolve({ outcome: 'accepted', platform: 'web' });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => stubMatchMedia(false));
afterEach(() => cleanup());

describe('InstallAppButton', () => {
  it('уже установлено (standalone) — ничего не рендерит и на событие не реагирует', () => {
    stubMatchMedia(true);
    const { container } = render(<InstallAppButton />);
    fireBeforeInstallPrompt();
    expect(container.firstChild).toBeNull();
  });

  it('до события beforeinstallprompt — ничего не рендерит', () => {
    const { container } = render(<InstallAppButton />);
    expect(container.firstChild).toBeNull();
  });

  it('после beforeinstallprompt — показывает кнопку установки', () => {
    render(<InstallAppButton />);
    act(() => { fireBeforeInstallPrompt(); });
    expect(screen.getByText('Установить приложение')).toBeTruthy();
  });

  it('клик вызывает prompt() и скрывает кнопку при outcome accepted', async () => {
    render(<InstallAppButton />);
    const promptFn = vi.fn().mockResolvedValue(undefined);
    act(() => { fireBeforeInstallPrompt({ prompt: promptFn, userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }) }); });

    await act(async () => {
      fireEvent.click(screen.getByText('Установить приложение'));
    });

    expect(promptFn).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Установить приложение')).toBeNull();
  });

  it('appinstalled — скрывает кнопку', () => {
    render(<InstallAppButton />);
    act(() => { fireBeforeInstallPrompt(); });
    expect(screen.getByText('Установить приложение')).toBeTruthy();

    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    expect(screen.queryByText('Установить приложение')).toBeNull();
  });
});
