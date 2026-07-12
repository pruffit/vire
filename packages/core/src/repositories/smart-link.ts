import type { SmartLink, SmartLinkInput } from '../types/artist';

export interface ISmartLinkRepository {
  slugTaken(artistProfileId: string, slug: string, excludeId?: string): Promise<boolean>;
  create(artistProfileId: string, input: SmartLinkInput): Promise<string>;
  findById(id: string): Promise<SmartLink | null>;
  update(id: string, artistProfileId: string, patch: Partial<SmartLinkInput>): Promise<void>;
  delete(id: string, artistProfileId: string): Promise<boolean>;
  releaseOwnedByArtist(artistProfileId: string, releaseId: string): Promise<boolean>;
}
