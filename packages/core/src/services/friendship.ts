import { err, ok, ValidationError, NotFoundError, ForbiddenError, type Result } from '../errors';
import type {
  IFriendshipRepository, FriendEdge, FriendProfile, IncomingRequest,
} from '../repositories/friendship';
import type { INotificationRepository } from '../repositories/notification';
import type { IBlockRepository } from '../repositories/block';
import type { IExternalNotifyQueue } from '../ports/external-notify';

export type FriendshipStatus = 'NONE' | 'OUTGOING' | 'INCOMING' | 'FRIENDS' | 'SELF';

function deriveStatus(viewerId: string, otherId: string, edge: FriendEdge | null): FriendshipStatus {
  if (viewerId === otherId) return 'SELF';
  if (!edge) return 'NONE';
  if (edge.status === 'ACCEPTED') return 'FRIENDS';
  return edge.requesterId === viewerId ? 'OUTGOING' : 'INCOMING';
}

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
  constructor(
    private readonly repo: IFriendshipRepository,
    private readonly notifications: INotificationRepository,
    private readonly blocks: IBlockRepository,
    private readonly externalNotify?: IExternalNotifyQueue,
  ) {}

  async request(from: string, to: string): Promise<Result<FriendshipStatus, ValidationError | NotFoundError | ForbiddenError>> {
    if (from === to) return err(new ValidationError('Нельзя добавить в друзья самого себя', 'friendship.self'));
    if (!(await this.repo.userExists(to))) return err(new NotFoundError('User', to, 'friendship.userNotFound'));
    if (await this.blocks.existsEitherWay(from, to)) {
      return err(new ForbiddenError('Нельзя добавить в друзья: пользователь недоступен', 'friendship.userUnavailable'));
    }

    const edge = await this.repo.findEdge(from, to);
    if (edge) {
      if (edge.status === 'ACCEPTED') return ok('FRIENDS');
      if (edge.requesterId === from) return ok('OUTGOING');
      await this.repo.acceptRequest(edge.requesterId, edge.addresseeId);
      await this.notifications.insert(edge.requesterId, 'FRIEND_ACCEPT', from, null);
      return ok('FRIENDS');
    }
    await this.repo.insertRequest(from, to);
    await this.notifications.insert(to, 'FRIEND_REQUEST', from, null);
    try {
      await this.externalNotify?.add({ kind: 'FRIEND_REQUEST', recipientId: to, actorId: from });
    } catch {
      // best-effort: провал очереди не должен валить создание заявки
    }
    return ok('OUTGOING');
  }

  async accept(userId: string, otherId: string): Promise<Result<void, NotFoundError>> {
    const edge = await this.repo.findEdge(userId, otherId);
    if (!edge || edge.status !== 'PENDING' || edge.addresseeId !== userId) {
      return err(new NotFoundError('FriendRequest', otherId, 'friendship.requestNotFound'));
    }
    await this.repo.acceptRequest(edge.requesterId, edge.addresseeId);
    await this.notifications.insert(otherId, 'FRIEND_ACCEPT', userId, null);
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
    const edge = viewerId === otherId ? null : await this.repo.findEdge(viewerId, otherId);
    return deriveStatus(viewerId, otherId, edge);
  }

  async getStatuses(viewerId: string, otherIds: string[]): Promise<Map<string, FriendshipStatus>> {
    const idsToQuery = otherIds.filter((id) => id !== viewerId);
    const edges = idsToQuery.length > 0 ? await this.repo.listEdges(viewerId, idsToQuery) : [];
    const edgeByOther = new Map(edges.map((e) => [e.requesterId === viewerId ? e.addresseeId : e.requesterId, e]));

    const result = new Map<string, FriendshipStatus>();
    for (const id of otherIds) result.set(id, deriveStatus(viewerId, id, edgeByOther.get(id) ?? null));
    return result;
  }

  listFriends(userId: string): Promise<FriendProfile[]> { return this.repo.listFriends(userId); }
  listIncoming(userId: string): Promise<IncomingRequest[]> { return this.repo.listIncoming(userId); }
  countUnseen(userId: string): Promise<number> { return this.repo.countUnseenIncoming(userId); }
  async markSeen(userId: string): Promise<void> { await this.repo.markRequestsSeen(userId); }
}
