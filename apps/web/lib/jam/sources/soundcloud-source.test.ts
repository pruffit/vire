// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const API_SRC = 'https://w.soundcloud.com/player/api.js';
const Events = { READY: 'ready', PLAY: 'play', PAUSE: 'pause', FINISH: 'finish', PLAY_PROGRESS: 'progress', ERROR: 'error' };

class FakeWidget {
  static instances: FakeWidget[] = [];
  handlers = new Map<string, (e?: unknown) => void>();
  play = vi.fn();
  pause = vi.fn();
  seekTo = vi.fn();
  setVolume = vi.fn();
  load = vi.fn((_url: string, opts: { callback?: () => void }) => opts.callback?.());
  unbind = vi.fn();

  constructor(public iframe: HTMLIFrameElement) {
    FakeWidget.instances.push(this);
  }

  bind(event: string, listener: (e?: unknown) => void): void {
    this.handlers.set(event, listener);
  }

  emit(event: string, payload?: unknown): void {
    this.handlers.get(event)?.(payload);
  }
}

function installFakeSC(): void {
  const widgetFactory = (iframe: HTMLIFrameElement) => new FakeWidget(iframe);
  (window as unknown as { SC: unknown }).SC = { Widget: Object.assign(widgetFactory, { Events }) };
}

/** Скрипт API вставляется движком — эмулируем его загрузку так же, как это сделал бы браузер. */
function fireScriptLoad(): void {
  installFakeSC();
  document.querySelector<HTMLScriptElement>(`script[src="${API_SRC}"]`)?.dispatchEvent(new Event('load'));
}

beforeEach(() => {
  vi.resetModules();
  FakeWidget.instances = [];
  delete (window as unknown as { SC?: unknown }).SC;
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

async function mount(): Promise<{ engine: import('../jam-audio').JamSourceEngine; container: HTMLElement }> {
  const { createSoundcloudSource } = await import('./soundcloud-source');
  const { setPartyVideoContainer } = await import('./video-container');
  const container = document.createElement('div');
  document.body.appendChild(container);
  setPartyVideoContainer(container);
  return { engine: createSoundcloudSource(), container };
}

describe('createSoundcloudSource', () => {
  it('без зарегистрированного контейнера load() резолвится и не создаёт виджет', async () => {
    const { createSoundcloudSource } = await import('./soundcloud-source');
    const engine = createSoundcloudSource();

    await expect(engine.load('https://soundcloud.com/a/b')).resolves.toBeUndefined();
    expect(FakeWidget.instances).toHaveLength(0);
    expect(document.querySelector(`script[src="${API_SRC}"]`)).toBeNull();
  });

  it('с контейнером — грузит Widget API, вставляет iframe и резолвится на READY', async () => {
    const { engine, container } = await mount();

    const loadPromise = engine.load('https://soundcloud.com/a/b');
    expect(document.querySelector(`script[src="${API_SRC}"]`)).not.toBeNull();

    fireScriptLoad();
    await vi.waitFor(() => expect(FakeWidget.instances).toHaveLength(1));
    FakeWidget.instances[0]!.emit(Events.READY);

    await expect(loadPromise).resolves.toBeUndefined();
    const iframe = container.querySelector('iframe');
    expect(iframe?.src).toContain(encodeURIComponent('https://soundcloud.com/a/b'));
  });

  it('сбой загрузки скрипта не подвешивает load', async () => {
    const { engine } = await mount();

    const loadPromise = engine.load('https://soundcloud.com/a/b');
    document.querySelector<HTMLScriptElement>(`script[src="${API_SRC}"]`)?.dispatchEvent(new Event('error'));

    await expect(loadPromise).resolves.toBeUndefined();
    expect(FakeWidget.instances).toHaveLength(0);
  });

  it('повторный load переиспользует виджет через widget.load', async () => {
    const { engine } = await mount();

    const first = engine.load('https://soundcloud.com/a/b');
    fireScriptLoad();
    await vi.waitFor(() => expect(FakeWidget.instances).toHaveLength(1));
    FakeWidget.instances[0]!.emit(Events.READY);
    await first;

    await engine.load('https://soundcloud.com/c/d');

    expect(FakeWidget.instances).toHaveLength(1);
    expect(FakeWidget.instances[0]!.load).toHaveBeenCalledWith('https://soundcloud.com/c/d', expect.objectContaining({ auto_play: false }));
  });

  it('позиция берётся из PLAY_PROGRESS, первый прогресс после PLAY уведомляет onPlaying и снимает буферизацию', async () => {
    const { engine } = await mount();
    const playingListener = vi.fn();
    const endedListener = vi.fn();
    engine.onPlaying(playingListener);
    engine.onEnded(endedListener);

    const loadPromise = engine.load('https://soundcloud.com/a/b');
    fireScriptLoad();
    await vi.waitFor(() => expect(FakeWidget.instances).toHaveLength(1));
    const widget = FakeWidget.instances[0]!;
    widget.emit(Events.READY);
    await loadPromise;

    widget.emit(Events.PLAY);
    expect(engine.isBuffering()).toBe(true);

    widget.emit(Events.PLAY_PROGRESS, { currentPosition: 4200 });
    expect(engine.isBuffering()).toBe(false);
    expect(engine.currentTimeMs()).toBe(4200);
    expect(playingListener).toHaveBeenCalledTimes(1);

    widget.emit(Events.PLAY_PROGRESS, { currentPosition: 4800 });
    expect(playingListener).toHaveBeenCalledTimes(1);

    widget.emit(Events.FINISH);
    expect(endedListener).toHaveBeenCalledTimes(1);
  });

  it('seek выставляет позицию сразу — коррекция дрейфа не видит устаревшее значение', async () => {
    const { engine } = await mount();

    const loadPromise = engine.load('https://soundcloud.com/a/b');
    fireScriptLoad();
    await vi.waitFor(() => expect(FakeWidget.instances).toHaveLength(1));
    FakeWidget.instances[0]!.emit(Events.READY);
    await loadPromise;

    engine.seek(9000);

    expect(FakeWidget.instances[0]!.seekTo).toHaveBeenCalledWith(9000);
    expect(engine.currentTimeMs()).toBe(9000);
  });

  it('destroy убирает свой узел из контейнера, контейнер остаётся цел', async () => {
    const { engine, container } = await mount();

    const loadPromise = engine.load('https://soundcloud.com/a/b');
    fireScriptLoad();
    await vi.waitFor(() => expect(FakeWidget.instances).toHaveLength(1));
    FakeWidget.instances[0]!.emit(Events.READY);
    await loadPromise;
    expect(container.childElementCount).toBe(1);

    engine.destroy();

    expect(container.childElementCount).toBe(0);
    expect(container.isConnected).toBe(true);
    expect(() => engine.play()).not.toThrow();
  });
});
