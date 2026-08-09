import { err, ok, NotFoundError, ForbiddenError, type Result } from '../errors';
import type { ITrackRepository } from '../repositories/track';
import type { IReleaseRepository } from '../repositories/release';
import type { Track } from '../types/release';

/** Трек существует и принадлежит артисту (через релиз). */
export async function authorizeTrackOwnership(
  trackRepo: ITrackRepository,
  releaseRepo: IReleaseRepository,
  trackId: string,
  artistProfileId: string,
): Promise<Result<Track, NotFoundError | ForbiddenError>> {
  const track = await trackRepo.findById(trackId);
  if (!track) return err(new NotFoundError('Track', trackId, 'track.notFound'));

  const release = await releaseRepo.findById(track.releaseId);
  if (!release) return err(new NotFoundError('Release', track.releaseId, 'release.notFound'));
  if (release.artistProfileId !== artistProfileId) {
    return err(new ForbiddenError('Forbidden: track does not belong to this artist', 'track.forbidden'));
  }
  return ok(track);
}
