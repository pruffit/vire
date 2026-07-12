import type { DB } from '../client';
import type { ISmartLinkRepository, SmartLink, SmartLinkInput } from '@vire/core';
import {
  smartLinkSlugTaken,
  createSmartLink,
  getSmartLinkById,
  updateSmartLink,
  deleteSmartLink,
  getReleaseOptions,
} from '../queries/smart-links';

export class DrizzleSmartLinkRepository implements ISmartLinkRepository {
  constructor(private readonly db: DB) {}

  slugTaken(artistProfileId: string, slug: string, excludeId?: string): Promise<boolean> {
    return smartLinkSlugTaken(artistProfileId, slug, excludeId);
  }

  create(artistProfileId: string, input: SmartLinkInput): Promise<string> {
    return createSmartLink(artistProfileId, input);
  }

  findById(id: string): Promise<SmartLink | null> {
    return getSmartLinkById(id);
  }

  async update(id: string, artistProfileId: string, patch: Partial<SmartLinkInput>): Promise<void> {
    await updateSmartLink(id, artistProfileId, patch);
  }

  delete(id: string, artistProfileId: string): Promise<boolean> {
    return deleteSmartLink(id, artistProfileId);
  }

  async releaseOwnedByArtist(artistProfileId: string, releaseId: string): Promise<boolean> {
    const owned = await getReleaseOptions(artistProfileId);
    return owned.some((r) => r.id === releaseId);
  }
}
