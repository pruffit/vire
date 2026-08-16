// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DesktopDownloadBanner } from './desktop-download-banner';

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        const C = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
          const dom = Object.fromEntries(
            Object.entries(props).filter(([k]) => !['initial', 'animate', 'exit', 'transition'].includes(k)),
          );
          const Tag = tag as 'div';
          return <Tag {...dom}>{children}</Tag>;
        };
        C.displayName = `motion.${tag}`;
        return C;
      },
    },
  ),
}));

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

describe('DesktopDownloadBanner', () => {
  const windowsUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    delete (window as unknown as { __VIRE_DESKTOP__?: boolean }).__VIRE_DESKTOP__;
  });

  it('показывается посетителю с Windows', () => {
    setUserAgent(windowsUa);
    render(<DesktopDownloadBanner />);
    expect(screen.getByRole('region')).toBeTruthy();
  });

  it('не показывается на других платформах', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    render(<DesktopDownloadBanner />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('закрытие пишет флаг в localStorage и скрывает баннер', () => {
    setUserAgent(windowsUa);
    render(<DesktopDownloadBanner />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('region')).toBeNull();
    expect(localStorage.getItem('vire_desktop_banner_dismissed_v1')).toBe('1');
  });

  it('не показывается повторно в новом маунте после закрытия', () => {
    setUserAgent(windowsUa);
    const first = render(<DesktopDownloadBanner />);
    fireEvent.click(screen.getByRole('button'));
    first.unmount();

    render(<DesktopDownloadBanner />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('не показывается внутри десктоп-приложения даже с Windows UA', () => {
    setUserAgent(windowsUa);
    (window as unknown as { __VIRE_DESKTOP__?: boolean }).__VIRE_DESKTOP__ = true;
    render(<DesktopDownloadBanner />);
    expect(screen.queryByRole('region')).toBeNull();
  });
});
