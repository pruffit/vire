export interface PendingPurchase {
  id: string;
  externalPaymentId: string;
}

export interface IPurchaseRepository {
  hasPurchased(userId: string, trackId: string): Promise<boolean>;
  getPending(userId: string, trackId: string): Promise<PendingPurchase | null>;
  createPending(input: {
    id: string;
    userId: string;
    trackId: string;
    price: string;
    externalPaymentId: string;
    paymentProvider: string;
  }): Promise<void>;
  confirmByExternalId(externalPaymentId: string): Promise<void>;
  failByExternalId(externalPaymentId: string): Promise<void>;
  trackExists(trackId: string): Promise<boolean>;
  getTrackTitle(trackId: string): Promise<string | null>;
}
