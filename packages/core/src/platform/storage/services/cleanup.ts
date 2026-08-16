import type { IFileStorage } from '../repositories/storage';
import type { IOrphanedStorageRepository, StorageBucket } from '../repositories/orphan';

/** Сутки отсрочки: ошибочное удаление успевают заметить, пока файлы ещё на месте. */
export const ORPHAN_CLEANUP_GRACE_MS = 24 * 60 * 60 * 1000;
export const ORPHAN_CLEANUP_BATCH = 100;
/** После стольких неудач запись перестаёт разбираться автоматически — разбор руками. */
export const ORPHAN_CLEANUP_MAX_ATTEMPTS = 5;

export interface StorageCleanupResult {
  processed: number;
  removedKeys: number;
  failed: number;
  skipped: number;
}

export class StorageCleanupService {
  constructor(
    private readonly repo: IOrphanedStorageRepository,
    private readonly storages: Record<StorageBucket, IFileStorage>,
    private readonly graceMs: number = ORPHAN_CLEANUP_GRACE_MS,
  ) {}

  async run(now: Date, limit: number = ORPHAN_CLEANUP_BATCH): Promise<StorageCleanupResult> {
    const due = await this.repo.listDue(now, this.graceMs, limit);
    const cleaned: string[] = [];
    const result: StorageCleanupResult = { processed: 0, removedKeys: 0, failed: 0, skipped: 0 };

    for (const entry of due) {
      if (entry.attempts >= ORPHAN_CLEANUP_MAX_ATTEMPTS) {
        result.skipped += 1;
        continue;
      }
      result.processed += 1;
      try {
        const storage = this.storages[entry.bucket];
        const keys = await storage.listKeys(entry.prefix);
        if (keys.length > 0) await storage.remove(keys);
        result.removedKeys += keys.length;
        cleaned.push(entry.id);
      } catch (err) {
        // Одна битая запись не должна останавливать пачку: помечаем и идём дальше.
        result.failed += 1;
        await this.repo.markFailed(entry.id, (err as Error).message);
      }
    }

    if (cleaned.length > 0) await this.repo.markCleaned(cleaned, now);
    return result;
  }
}
