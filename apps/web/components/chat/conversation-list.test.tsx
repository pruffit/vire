// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ConversationSummary } from '@vire/core';

const { identityMock, usePathnameMock } = vi.hoisted(() => ({
  identityMock: vi.fn(() => ({ ready: true, pub: null, priv: null, needsLink: false, error: false })),
  usePathnameMock: vi.fn(() => '/messages'),
}));

vi.mock('@/lib/e2ee-client', () => ({ useIdentity: identityMock }));
vi.mock('next/navigation', () => ({ usePathname: usePathnameMock }));

import { ConversationList } from './conversation-list';

const CONVERSATIONS: ConversationSummary[] = [
  {
    id: 'conv-1',
    otherUserId: 'u2',
    otherUserName: 'Аня',
    otherUserImage: null,
    otherIkPub: null,
    lastMessageBody: null,
    lastMessageNonce: null,
    lastMessageSenderId: null,
    lastMessageAt: null,
    unread: false,
  },
];

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('ConversationList', () => {
  it('пустой список диалогов → EmptyState', () => {
    usePathnameMock.mockReturnValue('/messages');
    render(<ConversationList conversations={[]} viewerId="u1" />);
    expect(screen.getByText('Пока нет диалогов')).toBeTruthy();
  });

  it('активный диалог (текущий путь) подсвечен', () => {
    usePathnameMock.mockReturnValue('/messages/conv-1');
    render(<ConversationList conversations={CONVERSATIONS} viewerId="u1" />);
    expect(screen.getByRole('link', { name: /Аня/ }).className).toContain('bg-foreground/[0.08]');
  });

  it('на индексе диалог не подсвечен', () => {
    usePathnameMock.mockReturnValue('/messages');
    render(<ConversationList conversations={CONVERSATIONS} viewerId="u1" />);
    expect(screen.getByRole('link', { name: /Аня/ }).className).not.toContain('bg-foreground/[0.08]');
  });
});
