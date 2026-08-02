// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { JamQueueItem } from '@vire/core';
import type { JamSessionValue } from './jam-session-provider';

const { useJamSessionMock, setPartyVideoContainerMock } = vi.hoisted(() => ({
  useJamSessionMock: vi.fn(),
  setPartyVideoContainerMock: vi.fn(),
}));

vi.mock('./jam-session-provider', () => ({ useJamSession: useJamSessionMock }));
vi.mock('@/lib/jam/sources/video-container', () => ({ setPartyVideoContainer: setPartyVideoContainerMock }));

import { PartyVideoDock } from './party-video-dock';
import { setPartyVideoSlot } from '@/lib/jam/sources/video-slot';

function item(overrides: Partial<JamQueueItem> & Pick<JamQueueItem, 'id' | 'source'>): JamQueueItem {
  return {
    trackId: null, externalId: 'x', externalUrl: null, position: 0,
    addedByParticipantId: null, addedAt: new Date('2026-08-02T12:00:00Z'),
    title: 'Song', durationSec: null, artistName: 'Artist', artistSlug: null, releaseId: null,
    coverUrl: null, accentColor: null, isExplicit: null, version: null, feat: null,
    ...overrides,
  };
}

function session(queue: JamQueueItem[], activeItemId: string | null, isAudioDevice: boolean): JamSessionValue {
  return { room: { queue }, activeItemId, isAudioDevice } as unknown as JamSessionValue;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('PartyVideoDock', () => {
  it('без активной сессии поверхность не поднимается', () => {
    useJamSessionMock.mockReturnValue(null);
    render(<PartyVideoDock />);
    expect(setPartyVideoContainerMock).not.toHaveBeenCalled();
  });

  it('на устройстве-колонке при встраиваемом источнике регистрирует контейнер', () => {
    useJamSessionMock.mockReturnValue(session([item({ id: 'e1', source: 'YOUTUBE' })], 'e1', true));
    render(<PartyVideoDock />);
    expect(setPartyVideoContainerMock).toHaveBeenCalledWith(expect.any(HTMLElement));
  });

  it('SoundCloud тоже требует поверхность', () => {
    useJamSessionMock.mockReturnValue(session([item({ id: 'e1', source: 'SOUNDCLOUD' })], 'e1', true));
    render(<PartyVideoDock />);
    expect(setPartyVideoContainerMock).toHaveBeenCalledWith(expect.any(HTMLElement));
  });

  it('пульт чужой плеер не поднимает', () => {
    useJamSessionMock.mockReturnValue(session([item({ id: 'e1', source: 'YOUTUBE' })], 'e1', false));
    render(<PartyVideoDock />);
    expect(setPartyVideoContainerMock).not.toHaveBeenCalled();
  });

  it('каталожная позиция поверхность не поднимает', () => {
    useJamSessionMock.mockReturnValue(session([item({ id: 'a', source: 'VIRE', trackId: 't-a' })], 'a', true));
    render(<PartyVideoDock />);
    expect(setPartyVideoContainerMock).not.toHaveBeenCalled();
  });

  it('со слотом на странице док встаёт по его прямоугольнику, а не поверх интерфейса', () => {
    useJamSessionMock.mockReturnValue(session([item({ id: 'e1', source: 'YOUTUBE' })], 'e1', true));
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const slot = document.createElement('div');
    slot.getBoundingClientRect = () =>
      ({ left: 40, top: 60, width: 320, height: 180, right: 360, bottom: 240, x: 40, y: 60, toJSON: () => ({}) }) as DOMRect;
    setPartyVideoSlot(slot);

    const { container } = render(<PartyVideoDock />);
    const dock = container.firstElementChild as HTMLElement;

    expect(dock.style.transform).toBe('translate(40px, 60px)');
    expect(dock.style.width).toBe('320px');
    expect(dock.style.height).toBe('180px');

    setPartyVideoSlot(null);
    vi.unstubAllGlobals();
  });

  it('слот вне зоны видимости — док остаётся уголковым PiP', () => {
    useJamSessionMock.mockReturnValue(session([item({ id: 'e1', source: 'YOUTUBE' })], 'e1', true));
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const slot = document.createElement('div');
    const offscreen = window.innerHeight + 200;
    slot.getBoundingClientRect = () =>
      ({ left: 0, top: offscreen, width: 320, height: 180, right: 320, bottom: offscreen + 180, x: 0, y: offscreen, toJSON: () => ({}) }) as DOMRect;
    setPartyVideoSlot(slot);

    const { container } = render(<PartyVideoDock />);
    const dock = container.firstElementChild as HTMLElement;

    expect(dock.getAttribute('style')).toBeNull();

    setPartyVideoSlot(null);
    vi.unstubAllGlobals();
  });

  it('размонтирование снимает контейнер с реестра', () => {
    useJamSessionMock.mockReturnValue(session([item({ id: 'e1', source: 'YOUTUBE' })], 'e1', true));
    const { unmount } = render(<PartyVideoDock />);
    setPartyVideoContainerMock.mockClear();

    unmount();

    expect(setPartyVideoContainerMock).toHaveBeenCalledWith(null);
  });
});
