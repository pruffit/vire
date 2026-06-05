import { err, ok, NotFoundError, type Result } from '../errors';
import type { IArtistRepository } from '../repositories/artist';
import type { ArtistProfile } from '../types/artist';

export class ArtistService {
  constructor(private readonly repo: IArtistRepository) {}

  async getBySlug(slug: string): Promise<Result<ArtistProfile, NotFoundError>> {
    const artist = await this.repo.findBySlug(slug);
    if (!artist) return err(new NotFoundError('ArtistProfile', slug));
    return ok(artist);
  }
}
