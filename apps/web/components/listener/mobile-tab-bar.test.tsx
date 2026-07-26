// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/lib/chat-unread', () => ({ useChatUnread: (n: number) => n }));

import { MobileTabBar } from './mobile-tab-bar';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('MobileTabBar', () => {
  it('содержит 5 пунктов включая Друзей', () => {
    render(<MobileTabBar />);
    for (const label of ['Главная', 'Поиск', 'Медиатека', 'Друзья', 'Сообщения']) {
      expect(screen.getByText(label)).not.toBeNull();
    }
    const friends = screen.getByText('Друзья').closest('a');
    expect(friends?.getAttribute('href')).toBe('/friends');
  });

  it('бейдж входящих заявок висит на Друзьях, а не на Медиатеке', () => {
    render(<MobileTabBar incomingCount={3} />);
    const friends = screen.getByText('Друзья').closest('a');
    const library = screen.getByText('Медиатека').closest('a');
    expect(friends?.textContent).toContain('3 новых заявок в друзья');
    expect(library?.textContent).not.toContain('заявок');
  });
});
