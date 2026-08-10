// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { getTranslator } from '@vire/i18n/translator';

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/',
  Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock('@/lib/chat-unread', () => ({ useChatUnread: (n: number) => n }));

import { MobileTabBar } from './mobile-tab-bar';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const t = await getTranslator('ru', 'nav.tabBar');
const labels = { home: t('home'), search: t('search'), library: t('library'), friends: t('friends'), messages: t('messages') };

describe('MobileTabBar', () => {
  it('содержит 5 пунктов включая Друзей', () => {
    render(<MobileTabBar />);
    for (const label of Object.values(labels)) {
      expect(screen.getByText(label)).not.toBeNull();
    }
    const friends = screen.getByText(labels.friends).closest('a');
    expect(friends?.getAttribute('href')).toBe('/friends');
  });

  it('бейдж входящих заявок висит на Друзьях, а не на Медиатеке', () => {
    render(<MobileTabBar incomingCount={3} />);
    const friends = screen.getByText(labels.friends).closest('a');
    const library = screen.getByText(labels.library).closest('a');
    expect(friends?.textContent).toContain(t('friendRequestsSr', { count: 3 }));
    expect(library?.textContent).toBe(labels.library);
  });
});
