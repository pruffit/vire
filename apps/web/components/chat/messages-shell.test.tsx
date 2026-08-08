// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { usePathnameMock } = vi.hoisted(() => ({ usePathnameMock: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({ usePathname: usePathnameMock }));

import { MessagesShell } from './messages-shell';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('MessagesShell — видимость панелей по пути', () => {
  it('на /messages список показан, тред скрыт (мобильные классы)', () => {
    usePathnameMock.mockReturnValue('/messages');
    render(<MessagesShell sidebar={<div>Список</div>}><div>Тред</div></MessagesShell>);

    expect(screen.getByText('Список').closest('aside')!.className).toContain('flex flex-1');
    expect(screen.getByText('Тред').parentElement!.className).toContain('hidden');
  });

  it('на /messages/conv-1 тред показан, список скрыт (мобильные классы)', () => {
    usePathnameMock.mockReturnValue('/messages/conv-1');
    render(<MessagesShell sidebar={<div>Список</div>}><div>Тред</div></MessagesShell>);

    expect(screen.getByText('Список').closest('aside')!.className).toContain('hidden');
    expect(screen.getByText('Тред').parentElement!.className).toContain('flex flex-1');
  });

  it('обе панели всегда несут md:flex — видны одновременно на десктопе', () => {
    usePathnameMock.mockReturnValue('/messages');
    render(<MessagesShell sidebar={<div>Список</div>}><div>Тред</div></MessagesShell>);

    expect(screen.getByText('Список').closest('aside')!.className).toContain('md:flex');
    expect(screen.getByText('Тред').parentElement!.className).toContain('md:flex');
  });
});
