type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Сессия кончилась безвозвратно: refresh отклонён сервером, токены вычищены.
 *
 * Событие, а не прямой вызов навигации: `lib/api-client.ts` — нижний слой и про экраны
 * знать не должен, а импорт навигации оттуда замкнул бы цикл. Подписчик — `RootNavigator`.
 *
 * До P0 этого не было вовсе: токены чистились, но приложение оставалось на текущем экране
 * и показывало ошибку на каждый запрос — состояние, из которого пользователь выходил
 * только переустановкой.
 */
export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitSessionExpired(): void {
  // Копия — подписчик вправе отписаться прямо из обработчика.
  for (const listener of [...listeners]) listener();
}

/** Только для тестов: модульное состояние не сбрасывается между кейсами само. */
export function __resetSessionListenersForTests(): void {
  listeners.clear();
}
