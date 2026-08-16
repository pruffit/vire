export type StorageBucket = 'vault' | 'stream';

/** Что удалять: префикс, а не точный ключ — расширение файла и набор HLS-сегментов заранее неизвестны. */
export interface OrphanedPrefix {
  bucket: StorageBucket;
  prefix: string;
  reason: string;
  entityId: string;
}

export interface OrphanedEntry extends OrphanedPrefix {
  id: string;
  createdAt: Date;
  attempts: number;
}

export interface IOrphanedStorageRepository {
  /** Регистрация намерения удалить файлы. Вызывается ДО удаления строк — иначе ключи потеряны. */
  enqueue(entries: OrphanedPrefix[]): Promise<void>;
  /** Записи старше grace-периода, ещё не убранные. */
  listDue(now: Date, graceMs: number, limit: number): Promise<OrphanedEntry[]>;
  markCleaned(ids: string[], now: Date): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}
