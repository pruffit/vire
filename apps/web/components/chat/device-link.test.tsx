// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { identityMock, resetIdentityMock } = vi.hoisted(() => ({
  identityMock: vi.fn(),
  resetIdentityMock: vi.fn(() => Promise.resolve({ pub: new Uint8Array([3]), priv: new Uint8Array([4]) })),
}));

vi.mock('@/lib/e2ee-client', () => ({ useIdentity: identityMock }));
vi.mock('@/lib/e2ee', () => ({
  newEphemeral: () => ({ pub: new Uint8Array([1]), priv: new Uint8Array([2]) }),
  deriveLinkSecret: () => new Uint8Array([9]),
  sasDigits6: () => '654321',
  unwrapPriv: () => new Uint8Array([7]),
  hashCommit: () => 'commit==',
  importIdentity: vi.fn(),
  resetIdentity: resetIdentityMock,
  toB64: () => 'b64==',
  fromB64: () => new Uint8Array([0]),
}));

import { DeviceLink } from './device-link';

const LINK_ID = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  identityMock.mockReturnValue({ ready: true, pub: null, priv: null, needsLink: true, error: false });
});
afterEach(() => cleanup());

describe('DeviceLink — устройство B: привязка нового устройства', () => {
  it('poll 404 сразу после старта → «отклонена на другом устройстве», без ожидания TTL', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/keys/link/start')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ linkId: LINK_ID }) } as Response);
      }
      if (url.includes('/keys/link/poll')) {
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: 'Not found' }) } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DeviceLink viewerId="u2" />);
    fireEvent.click(screen.getByText('Привязать это устройство'));

    await screen.findByText('Привязка отклонена на другом устройстве.');
    expect(screen.queryByText(/Код для привязки/)).toBeNull();
  });

  it('после старта показывает статус ожидания, «Отмена» шлёт abort и возвращает исходный экран', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/keys/link/start')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ linkId: LINK_ID }) } as Response);
      }
      if (url.includes('/keys/link/poll')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ commitB: 'commit==', status: 'pending' }) } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DeviceLink viewerId="u2" />);
    fireEvent.click(screen.getByText('Привязать это устройство'));

    await screen.findByText('Ожидание подтверждения');
    fireEvent.click(screen.getByText('Отмена'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/keys/link/abort',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ linkId: LINK_ID }) }),
      );
    });
    await screen.findByText('Привязать это устройство');
  });

  it('сброс шифрования: подтверждение с предупреждением → resetIdentity + POST нового ikPub', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) } as Response),
    );
    vi.stubGlobal('fetch', fetchMock);
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...window.location, reload }, writable: true });

    render(<DeviceLink viewerId="u2" />);
    fireEvent.click(screen.getByText('Сбросить шифрование…'));

    await screen.findByText('Старая переписка станет нечитаемой у вас и у собеседников. Отменить нельзя.');
    fireEvent.click(screen.getByText('Сбросить шифрование'));

    await waitFor(() => {
      expect(resetIdentityMock).toHaveBeenCalledWith('u2');
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/keys',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ ikPub: 'b64==' }) }),
      );
      expect(reload).toHaveBeenCalled();
    });
  });

  it('отмена подтверждения сброса не трогает личность', async () => {
    render(<DeviceLink viewerId="u2" />);
    fireEvent.click(screen.getByText('Сбросить шифрование…'));
    await screen.findByText('Старая переписка станет нечитаемой у вас и у собеседников. Отменить нельзя.');

    fireEvent.click(screen.getByText('Отмена'));
    await screen.findByText('Сбросить шифрование…');
    expect(resetIdentityMock).not.toHaveBeenCalled();
  });
});
