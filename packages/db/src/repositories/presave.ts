import type { DB } from '../client';
import type { IPresaveRepository, PresaveReleaseInfo } from '@vire/core';
import {
  getReleasePresaveInfo,
  presaveForUser as presaveForUserQuery,
  unpresaveForUser as unpresaveForUserQuery,
  presaveForGuest as presaveForGuestQuery,
  getPresaveState,
  deletePendingGuestPresavesByEmail,
} from '../queries/release-presaves';

export class DrizzlePresaveRepository implements IPresaveRepository {
  constructor(private readonly db: DB) {}

  getReleaseInfo(releaseId: string): Promise<PresaveReleaseInfo | null> {
    return getReleasePresaveInfo(releaseId);
  }

  presaveForUser(userId: string, releaseId: string): Promise<void> {
    return presaveForUserQuery(userId, releaseId);
  }

  unpresaveForUser(userId: string, releaseId: string): Promise<void> {
    return unpresaveForUserQuery(userId, releaseId);
  }

  presaveForGuest(email: string, releaseId: string): Promise<void> {
    return presaveForGuestQuery(email, releaseId);
  }

  getState(userId: string, releaseId: string): Promise<boolean> {
    return getPresaveState(userId, releaseId);
  }

  deletePendingGuestByEmail(email: string): Promise<number> {
    return deletePendingGuestPresavesByEmail(email);
  }
}
