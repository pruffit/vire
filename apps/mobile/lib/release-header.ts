import type { ReleaseDetailResponse } from '@vire/api-contracts';

export type ReleaseHeaderParams = {
  releaseId: string;
  title?: string;
  artistName?: string;
  coverUrl?: string | null;
};

export type ReleaseHeaderInfo = {
  title: string;
  artistName: string;
  coverUrl: string | null;
};

// Таб-переход в /releases/[id] всегда даёт params сразу (карточка релиза уже их знает) —
// используем как есть без ожидания ответа API, чтобы не терять мгновенную отрисовку.
// Диплинк (vire://release/:releaseId) даёт только releaseId — тогда источник правды
// смещается на ответ GET /api/v1/releases/{releaseId}; имя артиста там не приходит
// (releaseSchema не джойнит артиста), так что для диплинка artistName остаётся пустым.
export function resolveReleaseHeader(
  params: ReleaseHeaderParams,
  release: ReleaseDetailResponse['release'] | null
): ReleaseHeaderInfo {
  if (params.title !== undefined) {
    return {
      title: params.title,
      artistName: params.artistName ?? '',
      coverUrl: params.coverUrl ?? null,
    };
  }

  if (release) {
    return {
      title: release.title,
      artistName: params.artistName ?? '',
      coverUrl: release.coverUrl,
    };
  }

  return { title: '', artistName: params.artistName ?? '', coverUrl: params.coverUrl ?? null };
}
