// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { identityMock, useRealtimeMock, commitMatchesMock } = vi.hoisted(() => ({
  identityMock: vi.fn(),
  useRealtimeMock: vi.fn(),
  commitMatchesMock: vi.fn(() => true),
}));

vi.mock('@/lib/e2ee-client', () => ({ useIdentity: identityMock }));
vi.mock('@/lib/use-realtime', () => ({ useRealtime: useRealtimeMock }));
vi.mock('@/lib/e2ee', () => ({
  newEphemeral: () => ({ pub: new Uint8Array([1]), priv: new Uint8Array([2]) }),
  deriveLinkSecret: () => new Uint8Array([9]),
  sasDigits6: () => '654321',
  wrapPriv: () => ({ wrapped: 'wrapped==', nonce: 'nonce==' }),
  unwrapPriv: () => new Uint8Array([7]),
  hashCommit: () => 'commit==',
  commitMatches: commitMatchesMock,
  importIdentity: vi.fn(),
  toB64: () => 'b64==',
  fromB64: () => new Uint8Array([0]),
}));

import { DeviceLink } from './device-link';

const LINK_ID = '11111111-1111-1111-1111-111111111111';

function lastRealtimeHandlers() {
  const call = useRealtimeMock.mock.calls.at(-1) as [Record<string, (e: Record<string, unknown>) => void>];
  return call[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  commitMatchesMock.mockReturnValue(true);
});
afterEach(() => cleanup());

describe('DeviceLink — устройство A: одобрение привязки', () => {
  function ownerFetchMock(pollBody: () => Record<string, unknown>) {
    return vi.fn((url: string) => {
      if (url.includes('/keys/link/poll')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(pollBody()) } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) } as Response);
    });
  }

  beforeEach(() => {
    identityMock.mockReturnValue({
      ready: true, pub: new Uint8Array([1]), priv: new Uint8Array([2]), needsLink: false, error: false,
    });
  });

  it('Отмена в панели подтверждения шлёт abort и закрывает панель', async () => {
    let step = 0;
    const fetchMock = ownerFetchMock(() => {
      step += 1;
      return step === 1
        ? { commitB: 'commit==', status: 'pending' }
        : { commitB: 'commit==', eaPub: 'b64==', ebPub: 'b64==', status: 'pending' };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DeviceLink viewerId="u1" />);
    await act(async () => {
      await lastRealtimeHandlers()['link-request']?.({ linkId: LINK_ID });
    });

    await screen.findByText('Новое устройство хочет доступ к переписке');
    fireEvent.click(screen.getByText('Отмена'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/keys/link/abort',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ linkId: LINK_ID }) }),
      );
    });
    expect(screen.queryByText('Новое устройство хочет доступ к переписке')).toBeNull();
  });

  it('несовпадение кода шлёт abort перед сбросом состояния', async () => {
    let step = 0;
    const fetchMock = ownerFetchMock(() => {
      step += 1;
      return step === 1
        ? { commitB: 'commit==', status: 'pending' }
        : { commitB: 'commit==', eaPub: 'b64==', ebPub: 'b64==', status: 'pending' };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DeviceLink viewerId="u1" />);
    await act(async () => {
      await lastRealtimeHandlers()['link-request']?.({ linkId: LINK_ID });
    });
    await screen.findByText('Новое устройство хочет доступ к переписке');

    fireEvent.change(screen.getByPlaceholderText('______'), { target: { value: '000000' } });
    fireEvent.click(screen.getByText('Подтвердить'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/keys/link/abort',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ linkId: LINK_ID }) }),
      );
    });
    await screen.findByText('Код не совпадает. Привязка отменена.');
  });

  it('несошедшийся коммитмент (подмена ключа) шлёт abort, не оставляя B ждать TTL', async () => {
    commitMatchesMock.mockReturnValue(false);
    let step = 0;
    const fetchMock = ownerFetchMock(() => {
      step += 1;
      return step === 1
        ? { commitB: 'commit==', status: 'pending' }
        : { commitB: 'commit==', eaPub: 'b64==', ebPub: 'b64==', status: 'pending' };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<DeviceLink viewerId="u1" />);
    await act(async () => {
      await lastRealtimeHandlers()['link-request']?.({ linkId: LINK_ID });
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/keys/link/abort',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ linkId: LINK_ID }) }),
      );
    });
    await screen.findByText('Привязка отклонена: не сошёлся ключ (возможна подмена).');
    expect(screen.queryByText('Новое устройство хочет доступ к переписке')).toBeNull();
  });
});

describe('DeviceLink — устройство B: поллинг различает 404 и обрывает ожидание сразу', () => {
  beforeEach(() => {
    identityMock.mockReturnValue({
      ready: true, pub: null, priv: null, needsLink: true, error: false,
    });
  });

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
});
