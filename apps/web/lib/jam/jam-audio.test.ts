import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createVireSourceMock, createYoutubeSourceMock, createLocalSourceMock } = vi.hoisted(() => ({
  createVireSourceMock: vi.fn(),
  createYoutubeSourceMock: vi.fn(),
  createLocalSourceMock: vi.fn(),
}));
vi.mock('./sources/vire-source', () => ({ createVireSource: createVireSourceMock }));
vi.mock('./sources/youtube-source', () => ({ createYoutubeSource: createYoutubeSourceMock }));
vi.mock('./sources/local-source', () => ({ createLocalSource: createLocalSourceMock }));

import { createJamAudio } from './jam-audio';

interface FakeSourceEngine {
  load: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  seek: ReturnType<typeof vi.fn>;
  currentTimeMs: ReturnType<typeof vi.fn>;
  isBuffering: ReturnType<typeof vi.fn>;
  onEnded: ReturnType<typeof vi.fn>;
  onPlaying: ReturnType<typeof vi.fn>;
  onUserToggle: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function makeFakeSource(): FakeSourceEngine {
  return {
    load: vi.fn(async () => {}),
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    currentTimeMs: vi.fn(() => 0),
    isBuffering: vi.fn(() => false),
    onEnded: vi.fn(() => vi.fn()),
    onPlaying: vi.fn(() => vi.fn()),
    onUserToggle: vi.fn(() => vi.fn()),
    destroy: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createVireSourceMock.mockImplementation(makeFakeSource);
  createYoutubeSourceMock.mockImplementation(makeFakeSource);
  createLocalSourceMock.mockImplementation(makeFakeSource);
});

describe('createJamAudio (dispatcher)', () => {
  it('VIRE-источник создаёт vire-source и грузит trackId', async () => {
    const engine = createJamAudio();
    await engine.load({ kind: 'VIRE', trackId: 'track-1' });

    expect(createVireSourceMock).toHaveBeenCalledTimes(1);
    const source = createVireSourceMock.mock.results[0]!.value as FakeSourceEngine;
    expect(source.load).toHaveBeenCalledWith('track-1');
    expect(createYoutubeSourceMock).not.toHaveBeenCalled();
    expect(createLocalSourceMock).not.toHaveBeenCalled();
  });

  it('YOUTUBE-источник создаёт youtube-source и грузит videoId', async () => {
    const engine = createJamAudio();
    await engine.load({ kind: 'YOUTUBE', videoId: 'yt-1' });

    expect(createYoutubeSourceMock).toHaveBeenCalledTimes(1);
    const source = createYoutubeSourceMock.mock.results[0]!.value as FakeSourceEngine;
    expect(source.load).toHaveBeenCalledWith('yt-1');
  });

  it('LOCAL-источник создаёт local-source и грузит fileId', async () => {
    const engine = createJamAudio();
    await engine.load({ kind: 'LOCAL', fileId: 'file-1' });

    expect(createLocalSourceMock).toHaveBeenCalledTimes(1);
    const source = createLocalSourceMock.mock.results[0]!.value as FakeSourceEngine;
    expect(source.load).toHaveBeenCalledWith('file-1');
  });

  it('смена kind уничтожает предыдущий под-движок и создаёт новый', async () => {
    const engine = createJamAudio();
    await engine.load({ kind: 'VIRE', trackId: 'track-1' });
    const vireSource = createVireSourceMock.mock.results[0]!.value as FakeSourceEngine;

    await engine.load({ kind: 'YOUTUBE', videoId: 'yt-1' });

    expect(vireSource.destroy).toHaveBeenCalledTimes(1);
    expect(createYoutubeSourceMock).toHaveBeenCalledTimes(1);
  });

  it('тот же kind на другой id переиспользует под-движок, не пересоздаёт', async () => {
    const engine = createJamAudio();
    await engine.load({ kind: 'VIRE', trackId: 'track-1' });
    await engine.load({ kind: 'VIRE', trackId: 'track-2' });

    expect(createVireSourceMock).toHaveBeenCalledTimes(1);
    const source = createVireSourceMock.mock.results[0]!.value as FakeSourceEngine;
    expect(source.load).toHaveBeenNthCalledWith(2, 'track-2');
  });

  it('play/pause/seek/currentTimeMs/isBuffering делегируют активному под-движку', async () => {
    const engine = createJamAudio();
    await engine.load({ kind: 'VIRE', trackId: 'track-1' });
    const source = createVireSourceMock.mock.results[0]!.value as FakeSourceEngine;
    source.currentTimeMs.mockReturnValue(1234);
    source.isBuffering.mockReturnValue(true);

    engine.play();
    engine.pause();
    engine.seek(500);

    expect(source.play).toHaveBeenCalledTimes(1);
    expect(source.pause).toHaveBeenCalledTimes(1);
    expect(source.seek).toHaveBeenCalledWith(500);
    expect(engine.currentTimeMs()).toBe(1234);
    expect(engine.isBuffering()).toBe(true);
  });

  it('без активного под-движка — безопасные дефолты, без throw', () => {
    const engine = createJamAudio();
    expect(() => engine.play()).not.toThrow();
    expect(() => engine.pause()).not.toThrow();
    expect(() => engine.seek(100)).not.toThrow();
    expect(engine.currentTimeMs()).toBe(0);
    expect(engine.isBuffering()).toBe(false);
  });

  it('onEnded/onPlaying переживают смену под-движка — подписка на диспетчере, не на конкретном движке', async () => {
    const engine = createJamAudio();
    const endedListener = vi.fn();
    const playingListener = vi.fn();
    engine.onEnded(endedListener);
    engine.onPlaying(playingListener);

    await engine.load({ kind: 'VIRE', trackId: 'track-1' });
    const vireSource = createVireSourceMock.mock.results[0]!.value as FakeSourceEngine;
    const vireEndedHandler = vireSource.onEnded.mock.calls[0]![0] as () => void;
    vireEndedHandler();
    expect(endedListener).toHaveBeenCalledTimes(1);

    await engine.load({ kind: 'YOUTUBE', videoId: 'yt-1' });
    const ytSource = createYoutubeSourceMock.mock.results[0]!.value as FakeSourceEngine;
    const ytPlayingHandler = ytSource.onPlaying.mock.calls[0]![0] as () => void;
    ytPlayingHandler();
    expect(playingListener).toHaveBeenCalledTimes(1);
  });

  it('destroy уничтожает активный под-движок и очищает слушателей', async () => {
    const engine = createJamAudio();
    await engine.load({ kind: 'VIRE', trackId: 'track-1' });
    const source = createVireSourceMock.mock.results[0]!.value as FakeSourceEngine;

    engine.destroy();

    expect(source.destroy).toHaveBeenCalledTimes(1);
    expect(() => engine.play()).not.toThrow();
  });
});
