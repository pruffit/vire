import type { DB } from '../client';
import type { IPurchaseRepository } from '@vire/core';
import {
  hasPurchasedTrack,
  getPendingPurchase,
  createPendingPurchase,
  confirmPurchaseByExternalId,
  failPurchaseByExternalId,
} from '../queries/purchases';
import { trackExists, getTrackTitle } from '../queries/track-audio';

export class DrizzlePurchaseRepository implements IPurchaseRepository {
  constructor(private readonly db: DB) {}

  hasPurchased(userId: string, trackId: string): Promise<boolean> {
    return hasPurchasedTrack(userId, trackId);
  }

  getPending(userId: string, trackId: string): Promise<{ id: string; externalPaymentId: string } | null> {
    return getPendingPurchase(userId, trackId);
  }

  async createPending(input: {
    id: string;
    userId: string;
    trackId: string;
    price: string;
    externalPaymentId: string;
    paymentProvider: string;
  }): Promise<void> {
    await createPendingPurchase(input);
  }

  async confirmByExternalId(externalPaymentId: string): Promise<void> {
    await confirmPurchaseByExternalId(externalPaymentId);
  }

  failByExternalId(externalPaymentId: string): Promise<void> {
    return failPurchaseByExternalId(externalPaymentId);
  }

  trackExists(trackId: string): Promise<boolean> {
    return trackExists(trackId);
  }

  getTrackTitle(trackId: string): Promise<string | null> {
    return getTrackTitle(trackId);
  }
}
