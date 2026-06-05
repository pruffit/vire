import { err, ok, NotFoundError, type Result } from '../errors';
import type { IReleaseRepository } from '../repositories/release';
import type { Release, ReleaseWithTracks } from '../types/release';

export class ReleaseService {
  constructor(private readonly repo: IReleaseRepository) {}

  async getWithTracks(releaseId: string): Promise<Result<ReleaseWithTracks, NotFoundError>> {
    const result = await this.repo.findWithTracks(releaseId);
    if (!result) return err(new NotFoundError('Release', releaseId));
    return ok(result);
  }

  async getPublishedByArtist(artistProfileId: string): Promise<Release[]> {
    return this.repo.findPublishedByArtist(artistProfileId);
  }
}
