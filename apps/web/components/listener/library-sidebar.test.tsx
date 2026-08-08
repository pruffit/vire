// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { LibrarySidebar } from './library-sidebar';

afterEach(() => cleanup());

const BASE_PROPS = {
  playlists: [],
  artists: [],
  likedCount: 0,
  isGuest: false,
};

describe('LibrarySidebar — подписи строк', () => {
  it('«Друзья» без входящих заявок — без подписи (не дублирует заголовок)', () => {
    render(<LibrarySidebar {...BASE_PROPS} incomingCount={0} />);
    const row = screen.getByText('Друзья').closest('a');
    expect(row?.textContent).toBe('Друзья');
  });

  it('«Друзья» с входящими заявками — подпись с числом', () => {
    render(<LibrarySidebar {...BASE_PROPS} incomingCount={3} />);
    expect(screen.getByText('3 новых заявок')).toBeTruthy();
  });

  it('свёрнутый рейл: «Друзья» без заявок — title без дублирования', () => {
    render(<LibrarySidebar {...BASE_PROPS} incomingCount={0} collapsed />);
    expect(screen.getByTitle('Друзья')).toBeTruthy();
    expect(screen.queryByTitle('Друзья · Друзья')).toBeNull();
  });
});
