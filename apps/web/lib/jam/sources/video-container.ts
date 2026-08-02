type ContainerListener = (el: HTMLElement | null) => void;

let container: HTMLElement | null = null;
const listeners = new Set<ContainerListener>();

/**
 * Экран вечеринки — единственный владелец видео-поверхности. Регистрирует/снимает свой
 * контейнер (как `setJamTransport` для транспорта); без него встраиваемые источники
 * (YouTube, SoundCloud) недоступны ни на одном устройстве — ToS требуют видимый плеер,
 * второй поверхности мы не заводим.
 */
export function setPartyVideoContainer(el: HTMLElement | null): void {
  container = el;
  listeners.forEach((l) => l(el));
}

export function getPartyVideoContainer(): HTMLElement | null {
  return container;
}

export function onPartyVideoContainerChange(listener: ContainerListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Свой узел под плеер внутри контейнера. Отдавать адаптерам сам контейнер нельзя:
 * `YT.Player` ПОДМЕНЯЕТ переданный элемент на iframe — React-узел исчез бы из DOM
 * навсегда, и следующий видео-трек рисовать было бы уже некуда.
 */
export function createVideoMount(): { host: HTMLElement; mount: HTMLElement } | null {
  const parent = container;
  if (!parent) return null;
  const host = document.createElement('div');
  host.style.width = '100%';
  host.style.height = '100%';
  const mount = document.createElement('div');
  host.appendChild(mount);
  parent.appendChild(host);
  return { host, mount };
}
