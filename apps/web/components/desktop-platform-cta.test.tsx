// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { DesktopPlatformCta } from './desktop-platform-cta';

afterEach(() => {
  cleanup();
  delete (window as unknown as { __VIRE_DESKTOP__?: boolean }).__VIRE_DESKTOP__;
});

describe('DesktopPlatformCta', () => {
  describe('platform="windows"', () => {
    it('без флага десктопа и с downloadUrl — рендерит рабочую ссылку', () => {
      render(<DesktopPlatformCta platform="windows" downloadUrl="https://cdn.viremusic.ru/downloads/desktop/windows/VireMusic-Setup-x64.exe" />);
      const link = screen.getByText('Скачать для Windows').closest('a');
      expect(link).toBeTruthy();
      expect(link?.getAttribute('href')).toBe('https://cdn.viremusic.ru/downloads/desktop/windows/VireMusic-Setup-x64.exe');
    });

    it('без флага десктопа и без downloadUrl — рендерит disabled-заглушку', () => {
      render(<DesktopPlatformCta platform="windows" downloadUrl={null} />);
      const span = screen.getByText('Скачать для Windows');
      expect(span.closest('a')).toBeNull();
      expect(span.closest('span')?.getAttribute('aria-disabled')).toBe('true');
    });

    it('внутри десктоп-приложения — после маунта показывает "уже установлено", без ссылки', async () => {
      (window as unknown as { __VIRE_DESKTOP__?: boolean }).__VIRE_DESKTOP__ = true;
      await act(async () => {
        render(<DesktopPlatformCta platform="windows" downloadUrl="https://cdn.viremusic.ru/downloads/desktop/windows/VireMusic-Setup-x64.exe" />);
      });
      expect(screen.getByText('Вы уже используете это приложение')).toBeTruthy();
      expect(screen.queryByText('Скачать для Windows')).toBeNull();
    });
  });

  describe('platform="linux"', () => {
    it('без флага десктопа и с downloadUrl — рендерит рабочую ссылку', () => {
      render(<DesktopPlatformCta platform="linux" downloadUrl="https://cdn.viremusic.ru/downloads/desktop/linux/VireMusic-x86_64.AppImage" />);
      const link = screen.getByText('Скачать для Linux').closest('a');
      expect(link).toBeTruthy();
      expect(link?.getAttribute('href')).toBe('https://cdn.viremusic.ru/downloads/desktop/linux/VireMusic-x86_64.AppImage');
    });

    it('без флага десктопа и без downloadUrl — рендерит disabled-заглушку', () => {
      render(<DesktopPlatformCta platform="linux" downloadUrl={null} />);
      const span = screen.getByText('Скачать для Linux');
      expect(span.closest('a')).toBeNull();
      expect(span.closest('span')?.getAttribute('aria-disabled')).toBe('true');
    });

    it('внутри десктоп-приложения — после маунта показывает "уже установлено", без ссылки', async () => {
      (window as unknown as { __VIRE_DESKTOP__?: boolean }).__VIRE_DESKTOP__ = true;
      await act(async () => {
        render(<DesktopPlatformCta platform="linux" downloadUrl="https://cdn.viremusic.ru/downloads/desktop/linux/VireMusic-x86_64.AppImage" />);
      });
      expect(screen.getByText('Вы уже используете это приложение')).toBeTruthy();
      expect(screen.queryByText('Скачать для Linux')).toBeNull();
    });
  });
});
