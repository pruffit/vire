import { err, ok, NotFoundError, type Result } from '../../../errors';
import { can, type PlatformRole } from '../../../platform/access';
import type { IArtistReadRepository } from '../repositories/artist-read';
import type { ArtistPageView } from '../types/artist-page';

const POSTS_LIMIT = 5;

export interface ArtistPageInput {
  slug: string;
  viewerId: string | null;
  viewerRole?: PlatformRole | null;
}

export class ArtistPageService {
  constructor(private readonly repo: IArtistReadRepository) {}

  async getPage({ slug, viewerId, viewerRole }: ArtistPageInput): Promise<Result<ArtistPageView, NotFoundError>> {
    const artist = await this.repo.findBySlug(slug);
    if (!artist) return err(new NotFoundError('ArtistProfile', slug, 'artist.notFound'));

    // Пустой профиль скрыт с витрины; видят участник (дашборд-доступ) и staff (превью).
    const hasPublishedTrack = await this.repo.hasPublishedTrack(artist.id);
    if (!hasPublishedTrack) {
      const isStaff = can(viewerRole ? { id: viewerId ?? '', role: viewerRole } : null, 'staff.content.preview');
      const isMember = !isStaff && viewerId ? await this.repo.isMember(artist.id, viewerId) : false;
      if (!isStaff && !isMember) return err(new NotFoundError('ArtistProfile', slug, 'artist.notFound'));
    }

    const [releases, upcoming, posts, smartLinks, playableTracks] = await Promise.all([
      this.repo.listPublishedReleases(artist.id),
      this.repo.listUpcoming(artist.id),
      this.repo.listPosts(artist.id, POSTS_LIMIT),
      this.repo.listSmartLinks(artist.id),
      this.repo.listPlayableTracks(artist.id),
    ]);

    const explicitReleaseIds = await this.repo.explicitReleaseIds(releases.map((r) => r.id));

    // Гостю кнопка пресейва ведёт на страницу релиза — presave-состояние нужно только вошедшим.
    const upcomingIds = upcoming.filter((r) => r.releaseDate).map((r) => r.id);
    const [following, followerCount, presavedReleaseIds] = await Promise.all([
      viewerId ? this.repo.isFollowing(viewerId, artist.id) : Promise.resolve(false),
      this.repo.followerCount(artist.id),
      viewerId ? this.repo.presavedReleaseIds(viewerId, upcomingIds) : Promise.resolve(new Set<string>()),
    ]);

    return ok({
      artist,
      releases,
      upcoming,
      posts,
      smartLinks,
      playableTracks,
      explicitReleaseIds,
      following,
      followerCount,
      presavedReleaseIds,
    });
  }
}
