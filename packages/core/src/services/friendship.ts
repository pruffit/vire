import { err, ok, ValidationError, NotFoundError, type Result } from '../errors';
import type {
  IFriendshipRepository, FriendProfile, IncomingRequest,
} from '../repositories/friendship';

export type FriendshipStatus = 'NONE' | 'OUTGOING' | 'INCOMING' | 'FRIENDS' | 'SELF';

export function canSeeLikes(
  viewerId: string,
  ownerId: string,
  ownerVisibility: 'FRIENDS' | 'PRIVATE',
  areFriends: boolean,
): boolean {
  if (viewerId === ownerId) return true;
  if (ownerVisibility === 'PRIVATE') return false;
  return areFriends;
}

export class FriendshipService {
  constructor(private readonly repo: IFriendshipRepository) {}

  async request(from: string, to: string): Promise<Result<FriendshipStatus, ValidationError | NotFoundError>> {
    if (from === to) return err(new ValidationError('Нельзя добавить в друзья самого себя'));
    if (!(await this.repo.userExists(to))) return err(new NotFoundError('User', to));

    const edge = await this.repo.findEdge(from, to);
    if (edge) {
      if (edge.status === 'ACCEPTED') return ok('FRIENDS');
      if (edge.requesterId === from) return ok('OUTGOING');
      await this.repo.acceptRequest(edge.requesterId, edge.addresseeId);
      return ok('FRIENDS');
    }
    await this.repo.insertRequest(from, to);
    return ok('OUTGOING');
  }

  async accept(userId: string, otherId: string): Promise<Result<void, NotFoundError>> {
    const edge = await this.repo.findEdge(userId, otherId);
    if (!edge || edge.status !== 'PENDING' || edge.addresseeId !== userId) {
      return err(new NotFoundError('FriendRequest', otherId));
    }
    await this.repo.acceptRequest(edge.requesterId, edge.addresseeId);
    return ok(undefined);
  }

  async decline(userId: string, otherId: string): Promise<Result<void, never>> {
    await this.repo.deleteEdge(userId, otherId);
    return ok(undefined);
  }

  cancel(userId: string, otherId: string): Promise<Result<void, never>> {
    return this.decline(userId, otherId);
  }

  unfriend(userId: string, otherId: string): Promise<Result<void, never>> {
    return this.decline(userId, otherId);
  }

  async getStatus(viewerId: string, otherId: string): Promise<FriendshipStatus> {
    if (viewerId === otherId) return 'SELF';
    const edge = await this.repo.findEdge(viewerId, otherId);
    if (!edge) return 'NONE';
    if (edge.status === 'ACCEPTED') return 'FRIENDS';
    return edge.requesterId === viewerId ? 'OUTGOING' : 'INCOMING';
  }

  listFriends(userId: string): Promise<FriendProfile[]> { return this.repo.listFriends(userId); }
  listIncoming(userId: string): Promise<IncomingRequest[]> { return this.repo.listIncoming(userId); }
}
