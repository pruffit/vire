// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { WindowsDownloadCta } from './windows-download-cta';

afterEach(() => {
  cleanup();
  delete (window as unknown as { __VIRE_DESKTOP__?: boolean }).__VIRE_DESKTOP__;
});

describe('WindowsDownloadCta', () => {
  it('без флага десктопа и с windowsUrl — рендерит рабочую ссылку', () => {
    render(<WindowsDownloadCta windowsUrl="https://cdn.viremusic.ru/downloads/desktop/windows/VireMusic-Setup-x64.exe" />);
    const link = screen.getByText('Скачать для Windows').closest('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('https://cdn.viremusic.ru/downloads/desktop/windows/VireMusic-Setup-x64.exe');
  });

  it('без флага десктопа и без windowsUrl — рендерит disabled-заглушку', () => {
    render(<WindowsDownloadCta windowsUrl={null} />);
    const span = screen.getByText('Скачать для Windows');
    expect(span.closest('a')).toBeNull();
    expect(span.closest('span')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('внутри десктоп-приложения — после маунта показывает "уже установлено", без ссылки', async () => {
    (window as unknown as { __VIRE_DESKTOP__?: boolean }).__VIRE_DESKTOP__ = true;
    await act(async () => {
      render(<WindowsDownloadCta windowsUrl="https://cdn.viremusic.ru/downloads/desktop/windows/VireMusic-Setup-x64.exe" />);
    });
    expect(screen.getByText('Вы уже используете это приложение')).toBeTruthy();
    expect(screen.queryByText('Скачать для Windows')).toBeNull();
  });
});
