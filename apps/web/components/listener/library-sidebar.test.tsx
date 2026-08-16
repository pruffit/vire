// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { getTranslator } from '@vire/i18n/translator';

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { LibrarySidebar } from './library-sidebar';

afterEach(() => cleanup());

const t = await getTranslator('ru', 'nav.sidebar');
const friendsLabel = t('friends');
const friendsNewRequests = (count: number) => t('friendsNewRequests', { count });

const BASE_PROPS = {
  playlists: [],
  artists: [],
  likedCount: 0,
  isGuest: false,
};

describe('LibrarySidebar — подписи строк', () => {
  it('«Друзья» без входящих заявок — без подписи (не дублирует заголовок)', () => {
    render(<LibrarySidebar {...BASE_PROPS} incomingCount={0} />);
    const row = screen.getByText(friendsLabel).closest('a');
    expect(row?.textContent).toBe(friendsLabel);
  });

  it('«Друзья» с входящими заявками — подпись с числом', () => {
    render(<LibrarySidebar {...BASE_PROPS} incomingCount={3} />);
    expect(screen.getByText(friendsNewRequests(3))).toBeTruthy();
  });

  it('свёрнутый рейл: «Друзья» без заявок — title без дублирования', () => {
    render(<LibrarySidebar {...BASE_PROPS} incomingCount={0} collapsed />);
    expect(screen.getByTitle(friendsLabel)).toBeTruthy();
    expect(screen.queryByTitle(`${friendsLabel} · ${friendsLabel}`)).toBeNull();
  });
});

describe('LibrarySidebar — скролл', () => {
  it('список библиотеки клипает ось X: рядом с overflow-y-auto она иначе считается auto и даёт лишнюю полосу', () => {
    const { container } = render(<LibrarySidebar {...BASE_PROPS} />);
    const scrollPane = container.querySelector('.overflow-y-auto');

    expect(scrollPane).toBeTruthy();
    expect(scrollPane?.className).toContain('overflow-x-clip');
  });

  it('то же в свёрнутом рейле — там бейджи и ring вылезают за край сильнее всего', () => {
    const { container } = render(<LibrarySidebar {...BASE_PROPS} incomingCount={3} collapsed />);
    const scrollPane = container.querySelector('.overflow-y-auto');

    expect(scrollPane?.className).toContain('overflow-x-clip');
  });

  it('полоса прокрутки в панели скрыта: узкий рейл не место для системного скроллбара', () => {
    const { container } = render(<LibrarySidebar {...BASE_PROPS} collapsed />);
    const scrollPane = container.querySelector('.overflow-y-auto');

    expect(scrollPane?.className).toContain('no-scrollbar');
    expect(scrollPane?.className).not.toContain('scrollbar-width');
  });
});

describe('LibrarySidebar — джем в общем списке', () => {
  it('джем стоит внутри прокручиваемого списка, а не закреплён над ним', () => {
    const { container } = render(<LibrarySidebar {...BASE_PROPS} />);
    const scrollPane = container.querySelector('.overflow-y-auto');
    const jam = container.querySelector('a[href="/jam"]');

    expect(jam).toBeTruthy();
    expect(scrollPane?.contains(jam!)).toBe(true);
  });

  it('идёт после постоянных разделов, перед накопленным контентом', () => {
    const { container } = render(
      <LibrarySidebar {...BASE_PROPS} playlists={[{ id: 'p1', name: 'Мой', coverUrl: null }]} />,
    );
    const hrefs = [...container.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));

    expect(hrefs.indexOf('/jam')).toBeGreaterThan(hrefs.indexOf('/messages'));
    expect(hrefs.indexOf('/jam')).toBeLessThan(hrefs.indexOf('/playlists/p1'));
  });

  it('гость по-прежнему может попасть в джем', () => {
    const { container } = render(<LibrarySidebar {...BASE_PROPS} isGuest />);
    expect(container.querySelector('a[href="/jam"]')).toBeTruthy();
  });

  it('в свёрнутом рейле у гостя джем тоже доступен', () => {
    const { container } = render(<LibrarySidebar {...BASE_PROPS} isGuest collapsed />);
    expect(container.querySelector('a[href="/jam"]')).toBeTruthy();
  });
});
