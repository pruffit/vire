export interface TtlCacheOptions {
  ttlMs: number;
  maxSize: number;
}

export interface TtlCache<K, V> {
  get(key: K, load: () => Promise<V>, now?: number): Promise<V>;
  clear(): void;
}

/**
 * In-memory TTL-кэш на процесс (не для мульти-инстанс деплоя — состояние не
 * шарится). При переполнении выбрасывает протухшие записи, затем самые
 * старые (порядок вставки Map).
 */
export function createTtlCache<K, V>(options: TtlCacheOptions): TtlCache<K, V> {
  const { ttlMs, maxSize } = options;
  const store = new Map<K, { value: V; expiresAt: number }>();

  function makeRoom(now: number): void {
    if (store.size < maxSize) return;
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) store.delete(key);
    }
    while (store.size >= maxSize) {
      const oldestKey = store.keys().next().value;
      if (oldestKey === undefined) break;
      store.delete(oldestKey);
    }
  }

  return {
    async get(key: K, load: () => Promise<V>, now: number = Date.now()): Promise<V> {
      const cached = store.get(key);
      if (cached && cached.expiresAt > now) {
        return cached.value;
      }

      const value = await load();
      if (!store.has(key)) {
        makeRoom(now);
      }
      store.set(key, { value, expiresAt: now + ttlMs });
      return value;
    },
    clear(): void {
      store.clear();
    },
  };
}
