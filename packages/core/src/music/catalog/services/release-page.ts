import { err, ok, NotFoundError, type Result } from '../../../errors';
import { can, type PlatformRole } from '../../../platform/access';
import type { Clock } from '../../../platform/ports/effects';
import type { IReleaseReadRepository } from '../repositories/release-read';
import { isReleasePubliclyVisible, isCountdownVisible } from '../release-visibility';
import type { ArtistProfile } from '../types/artist';
import type { ReleaseWithTracks } from '../types/release';
import type { ReleasePageView } from '../types/release-page';

export interface ReleasePageInput {
  releaseId: string;
  artistSlug: string | null;
  viewerId: string | null;
  viewerRole?: PlatformRole | null;
}

export class ReleasePageService {
  constructor(
    private readonly repo: IReleaseReadRepository,
    private readonly clock: Clock,
  ) {}

  async getPage({ releaseId, artistSlug, viewerId, viewerRole }: ReleasePageInput): Promise<Result<ReleasePageView, NotFoundError>> {
    const notFound = () => new NotFoundError('Release', releaseId, 'release.notFound');

    let found: ReleaseWithTracks | null;
    let artist: ArtistProfile | null;
    if (artistSlug) {
      const [releaseResult, artistResult] = await Promise.all([
        this.repo.findReleaseWithTracks(releaseId),
        this.repo.findArtistBySlug(artistSlug),
      ]);
      found = releaseResult;
      if (!found) return err(notFound());
      artist = artistResult;
    } else {
      found = await this.repo.findReleaseWithTracks(releaseId);
      if (!found) return err(notFound());
      artist = await this.repo.findArtistById(found.release.artistProfileId);
    }
    const { release } = found;
    if (!artist) return err(notFound());
    if (artistSlug && release.artistProfileId !== artist.id) return err(notFound());

    // Пустой профиль скрыт с витрины; видят участник (дашборд-доступ) и staff (превью).
    const hasPublishedTrack = await this.repo.hasPublishedTrack(artist.id);
    if (!hasPublishedTrack) {
      const isStaff = can(viewerRole ? { id: viewerId ?? '', role: viewerRole } : null, 'staff.content.preview');
      const isMember = !isStaff && viewerId ? await this.repo.isMember(artist.id, viewerId) : false;
      if (!isStaff && !isMember) return err(notFound());
    }

    const now = new Date(this.clock());
    const isReleased = isReleasePubliclyVisible(release, now);
    const showCountdown = isCountdownVisible(release, now);
    if (!isReleased && !showCountdown) return err(notFound());

    // По HTTP полный трек-лист и текст невышедшего релиза утекли бы — в отсчёте отдаём пусто.
    const tracks = showCountdown ? [] : found.tracks;
    const releaseView = showCountdown ? { ...release, linerNotes: null } : release;
    const presaved = viewerId && showCountdown ? await this.repo.isPresaved(viewerId, releaseId) : false;

    return ok({ artist, release: releaseView, tracks, isReleased, showCountdown, presaved });
  }
}
