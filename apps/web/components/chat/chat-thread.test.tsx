// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { identityMock, useRealtimeMock } = vi.hoisted(() => ({
  identityMock: vi.fn(),
  useRealtimeMock: vi.fn(),
}));

vi.mock('@/lib/e2ee-client', () => ({ useIdentity: identityMock }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: useRealtimeMock }));
vi.mock('@/lib/e2ee', () => ({
  deriveCK: vi.fn(() => new Uint8Array([1])),
  encryptMessage: vi.fn(() => ({ ciphertext: 'ct==', nonce: 'n==' })),
  decryptMessage: vi.fn(() => 'привет'),
  fromB64: vi.fn(() => new Uint8Array([0])),
}));

import { ChatThread } from './chat-thread';

const BASE_PROPS = {
  conversationId: 'conv-1',
  viewerId: 'u1',
  otherUserId: 'u2',
  otherName: 'Аня',
  initialMessages: [],
  canSend: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ikPub: null }) } as Response)));
});
afterEach(() => cleanup());

describe('ChatThread — блокирующие состояния треда', () => {
  it('ошибка бутстрапа личности → центрированное состояние, без композера', () => {
    identityMock.mockReturnValue({ ready: false, pub: null, priv: null, needsLink: false, error: true });
    render(<ChatThread {...BASE_PROPS} otherIkPub={null} />);

    expect(screen.getByText('Не удалось загрузить шифрование')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Сообщение')).toBeNull();
  });

  it('needsLink → просит привязать устройство, ссылка на /messages', () => {
    identityMock.mockReturnValue({ ready: true, pub: null, priv: null, needsLink: true, error: false });
    render(<ChatThread {...BASE_PROPS} otherIkPub={null} />);

    expect(screen.getByText('Подтвердите это устройство')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Привязать устройство' }).getAttribute('href')).toBe('/messages');
    expect(screen.queryByPlaceholderText('Сообщение')).toBeNull();
  });

  it('нет ключа собеседника → сообщение по имени, без композера', () => {
    identityMock.mockReturnValue({ ready: true, pub: new Uint8Array([1]), priv: new Uint8Array([2]), needsLink: false, error: false });
    render(<ChatThread {...BASE_PROPS} otherIkPub={null} />);

    expect(screen.getByText('Аня ещё не открывал(а) Vire')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Сообщение')).toBeNull();
  });

  it('всё готово (ck собран) → пустой тред с приглашением написать, композер виден', () => {
    identityMock.mockReturnValue({ ready: true, pub: new Uint8Array([1]), priv: new Uint8Array([2]), needsLink: false, error: false });
    render(<ChatThread {...BASE_PROPS} otherIkPub="b64pub==" />);

    expect(screen.getByText('Напишите первое сообщение')).toBeTruthy();
    expect(screen.getByPlaceholderText('Сообщение')).toBeTruthy();
  });
});
