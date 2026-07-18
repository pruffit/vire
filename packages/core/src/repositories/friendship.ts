export type FriendEdge = { requesterId: string; addresseeId: string; status: 'PENDING' | 'ACCEPTED' };
export type FriendProfile = { id: string; name: string | null; image: string | null; since: Date };
export type IncomingRequest = { id: string; name: string | null; image: string | null; requestedAt: Date };

export interface IFriendshipRepository {
  findEdge(a: string, b: string): Promise<FriendEdge | null>;
  insertRequest(from: string, to: string): Promise<void>;
  acceptRequest(requesterId: string, addresseeId: string): Promise<void>;
  deleteEdge(a: string, b: string): Promise<void>;
  listFriends(userId: string): Promise<FriendProfile[]>;
  listIncoming(userId: string): Promise<IncomingRequest[]>;
  countIncoming(userId: string): Promise<number>;
  userExists(userId: string): Promise<boolean>;
}
