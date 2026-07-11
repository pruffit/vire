export interface ThrottleGateOptions {
  /** Одинаковый ключ пропускается не чаще раза в этот интервал. */
  ttlMs: number;
  /** Потолок записей: защита от неограниченного роста на уникальных ключах. */
  maxSize: number;
}

export interface ThrottleGate {
  /** true — пропустить (и запомнить); false — подавить как повтор. */
  shouldPass(key: string, now?: number): boolean;
  size(): number;
}

// Анти-шторм для алертов: дедуп по ключу с TTL. Потолок обязателен — ключ алерта
// почти всегда уникален (jobId/сообщение), обычная Map росла бы неделями между деплоями.
export function createThrottleGate(options: ThrottleGateOptions): ThrottleGate {
  const { ttlMs, maxSize } = options;
  const seen = new Map<string, number>();

  function evict(now: number): void {
    for (const [key, at] of seen) {
      if (now - at >= ttlMs) seen.delete(key);
    }
    // Протухшего не хватило — выбрасываем самые старые (порядок вставки Map).
    while (seen.size >= maxSize) {
      const oldest = seen.keys().next().value;
      if (oldest === undefined) break;
      seen.delete(oldest);
    }
  }

  return {
    shouldPass(key: string, now: number = Date.now()): boolean {
      const prev = seen.get(key);
      if (prev !== undefined && now - prev < ttlMs) return false;

      if (!seen.has(key)) evict(now);
      seen.set(key, now);
      return true;
    },
    size(): number {
      return seen.size;
    },
  };
}
