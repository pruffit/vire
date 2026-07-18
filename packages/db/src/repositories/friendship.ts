import type { IFriendshipRepository, FriendEdge, FriendProfile, IncomingRequest } from '@vire/core';
import * as q from '../queries/friendships';

export class DrizzleFriendshipRepository implements IFriendshipRepository {
  findEdge(a: string, b: string): Promise<FriendEdge | null> { return q.findEdge(a, b); }
  insertRequest(from: string, to: string): Promise<void> { return q.insertRequest(from, to); }
  acceptRequest(requesterId: string, addresseeId: string): Promise<void> { return q.acceptRequest(requesterId, addresseeId); }
  deleteEdge(a: string, b: string): Promise<void> { return q.deleteEdge(a, b); }
  listFriends(userId: string): Promise<FriendProfile[]> { return q.listFriends(userId); }
  listIncoming(userId: string): Promise<IncomingRequest[]> { return q.listIncoming(userId); }
  countIncoming(userId: string): Promise<number> { return q.countIncoming(userId); }
  userExists(userId: string): Promise<boolean> { return q.userExists(userId); }
}
