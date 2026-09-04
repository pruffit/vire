// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class FakePlayer {
  destroy = vi.fn();
  playVideo = vi.fn();
  pauseVideo = vi.fn();
  seekTo = vi.fn();
  setVolume = vi.fn();
  loadVideoById = vi.fn();
  getCurrentTime = vi.fn(() => 0);
  getIframe = vi.fn(() => ({ style: {} }) as unknown as HTMLIFrameElement);
  events: { onReady?: (e: unknown) => void; onStateChange?: (e: unknown) => void; onError?: (e: unknown) => void };

  constructor(public el: HTMLElement, public opts: { videoId: string; events?: typeof FakePlayer.prototype.events }) {
    this.events = opts.events ?? {};
  }
}

const PlayerState = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 };

// Массив пересоздаётся на каждый тест, а подкласс захватывает текущий: плеер от
// оборванного таймаутом теста попадёт в старый массив и не отравит следующий.
let players: FakePlayer[] = [];

function installFakeYT(): void {
  const bucket = players;
  class BoundPlayer extends FakePlayer {
    constructor(el: HTMLElement, opts: ConstructorParameters<typeof FakePlayer>[1]) {
      super(el, opts);
      bucket.push(this);
    }
  }
  (window as unknown as { YT: unknown }).YT = { Player: BoundPlayer, PlayerState };
}

function fireApiReady(): void {
  installFakeYT();
  (window as unknown as { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady?.();
}

beforeEach(() => {
  vi.resetModules();
  players = [];
  delete (window as unknown as { YT?: unknown }).YT;
  delete (window as unknown as { onYouTubeIframeAPIReady?: unknown }).onYouTubeIframeAPIReady;
  document.head.innerHTML = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createYoutubeSource', () => {
  it('без зарегистрированного контейнера load() резолвится и не создаёт плеер', async () => {
    const { createYoutubeSource } = await import('./youtube-source');
    const engine = createYoutubeSource();

    await expect(engine.load('vid-1')).resolves.toBeUndefined();
    expect(players).toHaveLength(0);
    expect(document.querySelector('script[src="https://www.youtube.com/iframe_api"]')).toBeNull();
  });

  it('с контейнером — грузит IFrame API один раз и создаёт YT.Player, резолвится на onReady', async () => {
    const { createYoutubeSource } = await import('./youtube-source');
    const { setPartyVideoContainer } = await import('./video-container');
    const el = document.createElement('div');
    setPartyVideoContainer(el);
    const engine = createYoutubeSource();

    const loadPromise = engine.load('vid-1');
    expect(document.querySelector('script[src="https://www.youtube.com/iframe_api"]')).not.toBeNull();

    fireApiReady();
    await vi.waitFor(() => expect(players).toHaveLength(1));
    players[0]!.events.onReady?.({ target: players[0] });

    await expect(loadPromise).resolves.toBeUndefined();
    // Плееру отдаётся собственный дочерний узел, а не React-контейнер: YT.Player подменяет элемент на iframe.
    expect(players[0]!.el).not.toBe(el);
    expect(el.contains(players[0]!.el)).toBe(true);
    expect(players[0]!.opts.videoId).toBe('vid-1');
  });

  it('destroy убирает свой узел из контейнера — React-контейнер остаётся цел', async () => {
    const { createYoutubeSource } = await import('./youtube-source');
    const { setPartyVideoContainer } = await import('./video-container');
    const el = document.createElement('div');
    document.body.appendChild(el);
    setPartyVideoContainer(el);
    const engine = createYoutubeSource();

    const loadPromise = engine.load('vid-1');
    fireApiReady();
    await vi.waitFor(() => expect(players).toHaveLength(1));
    players[0]!.events.onReady?.({ target: players[0] });
    await loadPromise;
    expect(el.childElementCount).toBe(1);

    engine.destroy();

    expect(el.childElementCount).toBe(0);
    expect(el.isConnected).toBe(true);
    el.remove();
  });

  it('повторный load на существующем плеере вызывает loadVideoById, не пересоздаёт плеер', async () => {
    const { createYoutubeSource } = await import('./youtube-source');
    const { setPartyVideoContainer } = await import('./video-container');
    setPartyVideoContainer(document.createElement('div'));
    const engine = createYoutubeSource();

    const first = engine.load('vid-1');
    fireApiReady();
    await vi.waitFor(() => expect(players).toHaveLength(1));
    players[0]!.events.onReady?.({ target: players[0] });
    await first;

    await engine.load('vid-2');

    expect(players).toHaveLength(1);
    expect(players[0]!.loadVideoById).toHaveBeenCalledWith('vid-2');
  });

  it('play/pause/seek/currentTimeMs делегируют плееру', async () => {
    const { createYoutubeSource } = await import('./youtube-source');
    const { setPartyVideoContainer } = await import('./video-container');
    setPartyVideoContainer(document.createElement('div'));
    const engine = createYoutubeSource();

    const loadPromise = engine.load('vid-1');
    fireApiReady();
    await vi.waitFor(() => expect(players).toHaveLength(1));
    const player = players[0]!;
    player.events.onReady?.({ target: player });
    await loadPromise;

    engine.play();
    engine.pause();
    engine.seek(3000);
    player.getCurrentTime.mockReturnValue(4);

    expect(player.playVideo).toHaveBeenCalledTimes(1);
    expect(player.pauseVideo).toHaveBeenCalledTimes(1);
    expect(player.seekTo).toHaveBeenCalledWith(3, true);
    expect(engine.currentTimeMs()).toBe(4000);
  });

  it('onStateChange ENDED/PLAYING уведомляют подписчиков, BUFFERING держит isBuffering до PLAYING', async () => {
    const { createYoutubeSource } = await import('./youtube-source');
    const { setPartyVideoContainer } = await import('./video-container');
    setPartyVideoContainer(document.createElement('div'));
    const engine = createYoutubeSource();
    const endedListener = vi.fn();
    const playingListener = vi.fn();
    engine.onEnded(endedListener);
    engine.onPlaying(playingListener);

    const loadPromise = engine.load('vid-1');
    fireApiReady();
    await vi.waitFor(() => expect(players).toHaveLength(1));
    const player = players[0]!;
    player.events.onReady?.({ target: player });
    await loadPromise;

    player.events.onStateChange?.({ target: player, data: PlayerState.BUFFERING });
    expect(engine.isBuffering()).toBe(true);

    player.events.onStateChange?.({ target: player, data: PlayerState.PLAYING });
    expect(engine.isBuffering()).toBe(false);
    expect(playingListener).toHaveBeenCalledTimes(1);

    player.events.onStateChange?.({ target: player, data: PlayerState.ENDED });
    expect(endedListener).toHaveBeenCalledTimes(1);
  });

  it('onError (недоступный/битый ролик) уведомляет как ended — джем не виснет на нём', async () => {
    const { createYoutubeSource } = await import('./youtube-source');
    const { setPartyVideoContainer } = await import('./video-container');
    setPartyVideoContainer(document.createElement('div'));
    const engine = createYoutubeSource();
    const endedListener = vi.fn();
    engine.onEnded(endedListener);

    const loadPromise = engine.load('vid-1');
    fireApiReady();
    await vi.waitFor(() => expect(players).toHaveLength(1));
    const player = players[0]!;
    player.events.onReady?.({ target: player });
    await loadPromise;

    player.events.onStateChange?.({ target: player, data: PlayerState.BUFFERING });
    player.events.onError?.({ target: player });

    expect(engine.isBuffering()).toBe(false);
    expect(endedListener).toHaveBeenCalledTimes(1);
  });

  it('onError до onReady — load() всё равно резолвится, не виснет навсегда', async () => {
    const { createYoutubeSource } = await import('./youtube-source');
    const { setPartyVideoContainer } = await import('./video-container');
    setPartyVideoContainer(document.createElement('div'));
    const engine = createYoutubeSource();
    const endedListener = vi.fn();
    engine.onEnded(endedListener);

    const loadPromise = engine.load('vid-1');
    fireApiReady();
    await vi.waitFor(() => expect(players).toHaveLength(1));
    const player = players[0]!;
    player.events.onError?.({ target: player });

    await expect(loadPromise).resolves.toBeUndefined();
    expect(endedListener).toHaveBeenCalledTimes(1);
  });

  it('пауза в самом плеере YouTube доезжает до джема, наша собственная — нет', async () => {
    const { createYoutubeSource } = await import('./youtube-source');
    const { setPartyVideoContainer } = await import('./video-container');
    setPartyVideoContainer(document.createElement('div'));
    const engine = createYoutubeSource();
    const toggleListener = vi.fn();
    engine.onUserToggle(toggleListener);

    const loadPromise = engine.load('vid-1');
    fireApiReady();
    await vi.waitFor(() => expect(players).toHaveLength(1));
    const player = players[0]!;
    player.events.onReady?.({ target: player });
    await loadPromise;

    engine.play();
    player.events.onStateChange?.({ target: player, data: PlayerState.PLAYING });
    expect(toggleListener).not.toHaveBeenCalled();

    // Пользователь нажал паузу внутри плеера.
    player.events.onStateChange?.({ target: player, data: PlayerState.PAUSED });
    expect(toggleListener).toHaveBeenCalledWith(false);

    // Наша собственная пауза эха не даёт.
    toggleListener.mockClear();
    engine.play();
    player.events.onStateChange?.({ target: player, data: PlayerState.PLAYING });
    toggleListener.mockClear();
    engine.pause();
    player.events.onStateChange?.({ target: player, data: PlayerState.PAUSED });
    expect(toggleListener).not.toHaveBeenCalled();
  });

  it('контейнер снят (экран вечеринки закрыт) — плеер уничтожается, движок не падает', async () => {
    const { createYoutubeSource } = await import('./youtube-source');
    const { setPartyVideoContainer } = await import('./video-container');
    setPartyVideoContainer(document.createElement('div'));
    const engine = createYoutubeSource();

    const loadPromise = engine.load('vid-1');
    fireApiReady();
    await vi.waitFor(() => expect(players).toHaveLength(1));
    const player = players[0]!;
    player.events.onReady?.({ target: player });
    await loadPromise;

    setPartyVideoContainer(null);

    expect(player.destroy).toHaveBeenCalledTimes(1);
    expect(() => engine.play()).not.toThrow();
  });

  it('контейнер появился после старта позиции — плеер догоняет позицию и играет, а не встаёт на нуле', async () => {
    const { createYoutubeSource } = await import('./youtube-source');
    const { setPartyVideoContainer } = await import('./video-container');
    const engine = createYoutubeSource();

    await engine.load('vid-1');
    engine.seek(42_000);
    engine.play();
    expect(players).toHaveLength(0);

    setPartyVideoContainer(document.createElement('div'));
    fireApiReady();
    await vi.waitFor(() => expect(players).toHaveLength(1));
    const player = players[0]!;
    player.events.onReady?.({ target: player });

    expect(player.seekTo).toHaveBeenCalledWith(42, true);
    expect(player.playVideo).toHaveBeenCalledTimes(1);
  });

  it('контейнер появился, когда позиция на паузе — плеер не запускается сам', async () => {
    const { createYoutubeSource } = await import('./youtube-source');
    const { setPartyVideoContainer } = await import('./video-container');
    const engine = createYoutubeSource();

    await engine.load('vid-1');
    engine.seek(10_000);
    engine.play();
    engine.pause();

    setPartyVideoContainer(document.createElement('div'));
    fireApiReady();
    await vi.waitFor(() => expect(players).toHaveLength(1));
    const player = players[0]!;
    player.events.onReady?.({ target: player });

    expect(player.seekTo).toHaveBeenCalledWith(10, true);
    expect(player.playVideo).not.toHaveBeenCalled();
  });

  it('destroy отписывается от реестра контейнера и уничтожает плеер', async () => {
    const { createYoutubeSource } = await import('./youtube-source');
    const { setPartyVideoContainer } = await import('./video-container');
    const el = document.createElement('div');
    setPartyVideoContainer(el);
    const engine = createYoutubeSource();

    const loadPromise = engine.load('vid-1');
    fireApiReady();
    await vi.waitFor(() => expect(players).toHaveLength(1));
    const player = players[0]!;
    player.events.onReady?.({ target: player });
    await loadPromise;

    engine.destroy();
    expect(player.destroy).toHaveBeenCalledTimes(1);

    // после destroy() смена контейнера не должна пытаться пересоздать плеер этого движка
    setPartyVideoContainer(null);
    setPartyVideoContainer(el);
    expect(players).toHaveLength(1);
  });
});
