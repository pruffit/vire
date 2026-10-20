import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const request = vi.hoisted(() => ({ locale: 'ru' }));

// Глобальный мок из vitest.setup подменяет Link и прячет как раз зависимость от провайдера.
vi.unmock('@/i18n/navigation');

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-next-intl-locale': request.locale }),
}));

import NotFound from '../not-found';

// Ответ not-found на action Next рисует деревом без корневого layout: провайдеров оттуда нет.
describe('корневой not-found без корневого layout', () => {
  it.each([
    ['ru', ''],
    ['en', '/en'],
  ])('рендерится в %s сам и локализует ссылки', async (locale, prefix) => {
    request.locale = locale;
    const html = renderToStaticMarkup(await NotFound());
    expect(html).toContain('404');
    for (const path of ['/search', '/releases']) expect(html).toContain(`href="${prefix}${path}"`);
  });
});
