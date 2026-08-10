export interface PresaveReleaseInfo {
  id: string;
  status: string;
  releaseDate: Date | null;
}

export interface IPresaveRepository {
  getReleaseInfo(releaseId: string): Promise<PresaveReleaseInfo | null>;
  presaveForUser(userId: string, releaseId: string): Promise<void>;
  unpresaveForUser(userId: string, releaseId: string): Promise<void>;
  presaveForGuest(email: string, releaseId: string): Promise<void>;
  getState(userId: string, releaseId: string): Promise<boolean>;
  deletePendingGuestByEmail(email: string): Promise<number>;
}
