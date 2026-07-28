// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { RankedFeedItem } from '@vire/core';
import { FeedList } from './feed-list';

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        const C = ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
          const dom = Object.fromEntries(
            Object.entries(props).filter(
              ([k]) => !['initial', 'animate', 'exit', 'transition', 'whileTap', 'whileHover', 'layoutId'].includes(k),
            ),
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

function baseItem(overrides: Partial<RankedFeedItem>): RankedFeedItem {
  return {
    kind: 'RELEASE',
    id: 'r1',
    artistProfileId: 'ap1',
    artistSlug: 'artist-one',
    artistName: 'Artist One',
    artistAvatarUrl: null,
    occurredAt: new Date('2026-07-20T00:00:00Z'),
    isFollowed: true,
    genres: [],
    moods: [],
    plays30d: 10,
    title: 'Новый релиз',
    coverUrl: null,
    hasExplicit: false,
    releaseType: 'ALBUM',
    body: null,
    reason: 'follow',
    score: 1,
    ...overrides,
  };
}

describe('FeedList', () => {
  afterEach(() => cleanup());

  it('карточка RELEASE — обложка, название, артист, подпись-причина, ссылка на релиз', () => {
    const item = baseItem({ reason: 'follow' });
    render(<FeedList items={[item]} presavedReleaseIds={[]} />);
    expect(screen.getByText('Новый релиз')).toBeTruthy();
    expect(screen.getByText('Artist One')).toBeTruthy();
    expect(screen.getByText('Вы подписаны')).toBeTruthy();
    const links = screen.getAllByRole('link');
    expect(links.some((a) => a.getAttribute('href') === '/artists/artist-one/releases/r1')).toBe(true);
  });

  it('карточка UPCOMING — отсчёт, пресейв, подпись-причина «taste»', () => {
    const item = baseItem({
      kind: 'UPCOMING',
      id: 'r2',
      reason: 'taste',
      occurredAt: new Date(Date.now() + 5 * 86_400_000),
    });
    render(<FeedList items={[item]} presavedReleaseIds={[]} />);
    expect(screen.getByText('Похоже на ваши вкусы')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Пресейв/ })).toBeTruthy();
  });

  it('пресейвнутый UPCOMING показывает «Сохранено»', () => {
    const item = baseItem({ kind: 'UPCOMING', id: 'r3', occurredAt: new Date(Date.now() + 86_400_000) });
    render(<FeedList items={[item]} presavedReleaseIds={['r3']} />);
    expect(screen.getByRole('button', { name: /Сохранено/ })).toBeTruthy();
  });

  it('карточка POST — аватар, текст анонса, подпись «fresh», ссылка на артиста', () => {
    const item = baseItem({
      kind: 'POST',
      id: 'p1',
      reason: 'fresh',
      title: 'Скоро новости',
      body: 'Готовим кое-что интересное',
      releaseType: null,
      coverUrl: null,
    });
    render(<FeedList items={[item]} presavedReleaseIds={[]} />);
    expect(screen.getByText('Скоро новости')).toBeTruthy();
    expect(screen.getByText('Готовим кое-что интересное')).toBeTruthy();
    expect(screen.getByText('Свежее на площадке')).toBeTruthy();
    const link = screen.getByRole('link', { name: /Скоро новости/ });
    expect(link.getAttribute('href')).toBe('/artists/artist-one');
  });

  it('«Показать ещё» раскрывает элементы сверх первых 12', () => {
    const items = Array.from({ length: 15 }, (_, i) => baseItem({ id: `r${i}`, title: `Релиз ${i}` }));
    render(<FeedList items={items} presavedReleaseIds={[]} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(12);
    expect(screen.getByRole('button', { name: /Показать ещё \(3\)/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Показать ещё/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(15);
    expect(screen.queryByRole('button', { name: /Показать ещё/ })).toBeNull();
  });

  it('без переполнения кнопка «Показать ещё» не рендерится', () => {
    const items = Array.from({ length: 5 }, (_, i) => baseItem({ id: `r${i}` }));
    render(<FeedList items={items} presavedReleaseIds={[]} />);
    expect(screen.queryByRole('button', { name: /Показать ещё/ })).toBeNull();
  });
});
