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

  async deleteRelease(params: {
    releaseId: string;
    artistProfileId: string;
  }): Promise<Result<void, NotFoundError | Error>> {
    const release = await this.repo.findById(params.releaseId);
    if (!release) return err(new NotFoundError('Release', params.releaseId));
    if (release.artistProfileId !== params.artistProfileId) {
      return err(new Error('Forbidden: release does not belong to this artist'));
    }
    await this.repo.delete(params.releaseId);
    return ok(undefined);
  }
}
