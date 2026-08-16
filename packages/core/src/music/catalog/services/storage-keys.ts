import type { OrphanedPrefix } from '../../../platform/storage/repositories/orphan';

// Раскладка ключей задаётся здесь и в местах загрузки; менять только парой.
// vault: tracks/{id}/source.{ext} · stream: tracks/{id}/hls/*, covers/{releaseId}.{ext}
export function trackStoragePrefixes(trackId: string, reason = 'track.deleted'): OrphanedPrefix[] {
  const prefix = `tracks/${trackId}/`;
  return [
    { bucket: 'vault', prefix, reason, entityId: trackId },
    { bucket: 'stream', prefix, reason, entityId: trackId },
  ];
}

/** Точка в конце обязательна: `covers/{id}.` не заденет обложку релиза с id-префиксом. */
export function releaseStoragePrefixes(releaseId: string, trackIds: string[]): OrphanedPrefix[] {
  return [
    { bucket: 'stream', prefix: `covers/${releaseId}.`, reason: 'release.deleted', entityId: releaseId },
    ...trackIds.flatMap((trackId) => trackStoragePrefixes(trackId, 'release.deleted')),
  ];
}
