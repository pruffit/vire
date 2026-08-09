import { err, ok, NotFoundError, type Result } from '../errors';
import type { IArtistRepository } from '../repositories/artist';
import type { IFollowRepository } from '../repositories/follow';

export class FollowService {
  constructor(
    private readonly artistRepo: IArtistRepository,
    private readonly followRepo: IFollowRepository,
  ) {}

  async follow(userId: string, artistSlug: string): Promise<Result<void, NotFoundError | Error>> {
    const artist = await this.artistRepo.findBySlug(artistSlug);
    if (!artist) return err(new NotFoundError('ArtistProfile', artistSlug, 'artist.notFound'));
    await this.followRepo.follow(userId, artist.id);
    return ok(undefined);
  }

  async unfollow(userId: string, artistSlug: string): Promise<Result<void, NotFoundError | Error>> {
    const artist = await this.artistRepo.findBySlug(artistSlug);
    if (!artist) return err(new NotFoundError('ArtistProfile', artistSlug, 'artist.notFound'));
    await this.followRepo.unfollow(userId, artist.id);
    return ok(undefined);
  }
}
