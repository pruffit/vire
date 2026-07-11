export interface TtlCacheOptions {
  ttlMs: number;
  maxSize: number;
}

export interface TtlCache<K, V> {
  get(key: K, load: () => Promise<V>, now?: number): Promise<V>;
  clear(): void;
}

// In-memory TTL-кэш на процесс (не для мульти-инстанс — состояние не шарится)
export function createTtlCache<K, V>(options: TtlCacheOptions): TtlCache<K, V> {
  const { ttlMs, maxSize } = options;
  const store = new Map<K, { value: V; expiresAt: number }>();
  const inFlight = new Map<K, Promise<V>>();

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
    get(key: K, load: () => Promise<V>, now: number = Date.now()): Promise<V> {
      const cached = store.get(key);
      if (cached && cached.expiresAt > now) {
        return Promise.resolve(cached.value);
      }

      const pending = inFlight.get(key);
      if (pending) return pending;

      // load() типизирован как () => Promise<V>, но синхронный throw в нём не должен
      // пробивать контракт get(): Promise<V> — оборачиваем в реджект.
      let loaded: Promise<V>;
      try {
        loaded = load();
      } catch (err) {
        return Promise.reject(err);
      }

      // Attach synchronously so concurrent get()s on this key before load()
      // settles all observe inFlight and share this one promise.
      const promise = loaded.then(
        (value) => {
          inFlight.delete(key);
          if (!store.has(key)) {
            makeRoom(now);
          }
          store.set(key, { value, expiresAt: now + ttlMs });
          return value;
        },
        (err: unknown) => {
          inFlight.delete(key);
          throw err;
        },
      );
      inFlight.set(key, promise);
      return promise;
    },
    clear(): void {
      store.clear();
      inFlight.clear();
    },
  };
}
