import type { ReleaseStatus } from '../catalog/types/release';
import { isReleasePubliclyVisible, isCountdownVisible } from '../catalog/release-visibility';

export interface SmartLinkDisplaySource {
  title: string;
  coverUrl: string | null;
  releaseDate: Date | null;
}

export interface SmartLinkDisplayRelease extends SmartLinkDisplaySource {
  status: ReleaseStatus;
}

export interface SmartLinkDisplay extends SmartLinkDisplaySource {
  cta: 'listen' | 'presave' | null;
}

/**
 * Что смартлинк показывает наружу. Привязанный релиз дополняет пустые поля лендинга,
 * но только если сам публично видим — иначе черновик/архив утечёт в заголовок, обложку и OG.
 */
export function resolveSmartLinkDisplay(
  link: SmartLinkDisplaySource,
  release: SmartLinkDisplayRelease | null,
  now: Date,
): SmartLinkDisplay {
  const cta = release == null
    ? null
    : isReleasePubliclyVisible(release, now)
      ? 'listen'
      : isCountdownVisible(release, now)
        ? 'presave'
        : null;

  const source = cta === null ? null : release;

  return {
    title: link.title || source?.title || '',
    coverUrl: link.coverUrl ?? source?.coverUrl ?? null,
    releaseDate: link.releaseDate ?? source?.releaseDate ?? null,
    cta,
  };
}
