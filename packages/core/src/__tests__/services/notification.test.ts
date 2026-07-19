import { describe, it, expect, vi } from 'vitest';
import { NotificationService } from '../../services/notification';
import type { INotificationRepository, NotificationItem } from '../../repositories/notification';
import type { RealtimePublisher } from '../../ports/realtime';

function makeRepo(o?: Partial<INotificationRepository>): INotificationRepository {
  return {
    insert: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
    countUnread: vi.fn().mockResolvedValue(0),
    markAllRead: vi.fn().mockResolvedValue(undefined),
    markRead: vi.fn().mockResolvedValue(undefined),
    ...o,
  };
}

function makePublisher(): RealtimePublisher {
  return { publish: vi.fn().mockResolvedValue(undefined) };
}

const ITEM: NotificationItem = {
  id: 'n1', type: 'FRIEND_REQUEST', actorId: 'u2', actorName: 'Боря', actorImage: null,
  entityId: null, readAt: null, createdAt: new Date(),
};

describe('NotificationService.notify', () => {
  it('пишет в репозиторий и публикует realtime-событие', async () => {
    const repo = makeRepo();
    const publisher = makePublisher();
    await new NotificationService(repo, publisher).notify('u1', 'FRIEND_REQUEST', 'u2', null);
    expect(repo.insert).toHaveBeenCalledWith('u1', 'FRIEND_REQUEST', 'u2', null);
    expect(publisher.publish).toHaveBeenCalledWith('u1', expect.objectContaining({ type: 'notification', notificationType: 'FRIEND_REQUEST', actorId: 'u2' }));
  });
});

describe('NotificationService — делегирование', () => {
  it('list/countUnread/markAllRead/markRead делегируют в репозиторий', async () => {
    const repo = makeRepo({ list: vi.fn().mockResolvedValue([ITEM]), countUnread: vi.fn().mockResolvedValue(3) });
    const service = new NotificationService(repo, makePublisher());

    expect(await service.list('u1', 20)).toEqual([ITEM]);
    expect(await service.countUnread('u1')).toBe(3);

    await service.markAllRead('u1');
    expect(repo.markAllRead).toHaveBeenCalledWith('u1');

    await service.markRead('u1', 'n1');
    expect(repo.markRead).toHaveBeenCalledWith('u1', 'n1');
  });
});
