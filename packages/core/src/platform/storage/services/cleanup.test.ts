import { describe, it, expect, vi } from 'vitest';
import {
  StorageCleanupService,
  ORPHAN_CLEANUP_GRACE_MS,
  ORPHAN_CLEANUP_MAX_ATTEMPTS,
} from './cleanup';
import type { IFileStorage } from '../repositories/storage';
import type { IOrphanedStorageRepository, OrphanedEntry, StorageBucket } from '../repositories/orphan';

const NOW = new Date('2026-08-16T12:00:00Z');

function entry(over: Partial<OrphanedEntry> = {}): OrphanedEntry {
  return {
    id: 'o1',
    bucket: 'vault',
    prefix: 'tracks/t1/',
    reason: 'track.deleted',
    entityId: 't1',
    createdAt: new Date('2026-08-15T00:00:00Z'),
    attempts: 0,
    ...over,
  };
}

function makeRepo(due: OrphanedEntry[]): IOrphanedStorageRepository {
  return {
    enqueue: vi.fn().mockResolvedValue(undefined),
    listDue: vi.fn().mockResolvedValue(due),
    markCleaned: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  };
}

function makeStorage(keys: string[] = []): IFileStorage {
  return {
    upload: vi.fn(),
    uploadFile: vi.fn(),
    downloadToFile: vi.fn(),
    presignDownload: vi.fn(),
    listKeys: vi.fn().mockResolvedValue(keys),
    remove: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn(),
  };
}

function makeStorages(over?: Partial<Record<StorageBucket, IFileStorage>>): Record<StorageBucket, IFileStorage> {
  return { vault: makeStorage(), stream: makeStorage(), ...over };
}

describe('StorageCleanupService.run', () => {
  it('удаляет всё под префиксом и помечает запись убранной', async () => {
    const repo = makeRepo([entry()]);
    const vault = makeStorage(['tracks/t1/source.flac']);
    const service = new StorageCleanupService(repo, makeStorages({ vault }));

    const result = await service.run(NOW);

    expect(vault.listKeys).toHaveBeenCalledWith('tracks/t1/');
    expect(vault.remove).toHaveBeenCalledWith(['tracks/t1/source.flac']);
    expect(repo.markCleaned).toHaveBeenCalledWith(['o1'], NOW);
    expect(result).toMatchObject({ processed: 1, removedKeys: 1, failed: 0 });
  });

  it('пустой префикс закрывается без запроса на удаление', async () => {
    const repo = makeRepo([entry()]);
    const vault = makeStorage([]);
    const service = new StorageCleanupService(repo, makeStorages({ vault }));

    await service.run(NOW);

    expect(vault.remove).not.toHaveBeenCalled();
    expect(repo.markCleaned).toHaveBeenCalledWith(['o1'], NOW);
  });

  it('идёт в бакет, указанный в записи', async () => {
    const stream = makeStorage(['tracks/t1/hls/index.m3u8']);
    const service = new StorageCleanupService(makeRepo([entry({ bucket: 'stream' })]), makeStorages({ stream }));

    await service.run(NOW);

    expect(stream.remove).toHaveBeenCalledWith(['tracks/t1/hls/index.m3u8']);
  });

  it('grace-период передаётся в запрос записей', async () => {
    const repo = makeRepo([]);
    await new StorageCleanupService(repo, makeStorages()).run(NOW, 50);
    expect(repo.listDue).toHaveBeenCalledWith(NOW, ORPHAN_CLEANUP_GRACE_MS, 50);
  });

  it('сбой одной записи не останавливает пачку', async () => {
    const repo = makeRepo([entry({ id: 'bad' }), entry({ id: 'good', bucket: 'stream' })]);
    const vault = makeStorage();
    vault.listKeys = vi.fn().mockRejectedValue(new Error('S3 down'));
    const stream = makeStorage(['k']);
    const service = new StorageCleanupService(repo, makeStorages({ vault, stream }));

    const result = await service.run(NOW);

    expect(repo.markFailed).toHaveBeenCalledWith('bad', 'S3 down');
    expect(repo.markCleaned).toHaveBeenCalledWith(['good'], NOW);
    expect(result).toMatchObject({ processed: 2, failed: 1, removedKeys: 1 });
  });

  it('исчерпавшая попытки запись пропускается — разбор руками, а не вечный ретрай', async () => {
    const repo = makeRepo([entry({ attempts: ORPHAN_CLEANUP_MAX_ATTEMPTS })]);
    const vault = makeStorage(['k']);
    const service = new StorageCleanupService(repo, makeStorages({ vault }));

    const result = await service.run(NOW);

    expect(vault.listKeys).not.toHaveBeenCalled();
    expect(repo.markCleaned).not.toHaveBeenCalled();
    expect(result).toMatchObject({ processed: 0, skipped: 1 });
  });
});
