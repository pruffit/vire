import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { ExternalNotifyJobData } from '@vire/core';

const h = vi.hoisted(() => ({
  getUserNotifyContext: vi.fn(),
  getUserDisplayName: vi.fn(),
  listPushSubscriptions: vi.fn(),
  deletePushSubscriptionsByEndpoints: vi.fn(),
  sendBrevoEmail: vi.fn(),
  sendPush: vi.fn(),
  isUserOnline: vi.fn(),
  chatEmailDebounced: vi.fn(),
}));

vi.mock('@vire/db', () => ({
  getUserNotifyContext: h.getUserNotifyContext,
  getUserDisplayName: h.getUserDisplayName,
  listPushSubscriptions: h.listPushSubscriptions,
  deletePushSubscriptionsByEndpoints: h.deletePushSubscriptionsByEndpoints,
}));
vi.mock('@vire/core', async () => {
  const actual = await vi.importActual<typeof import('@vire/core')>('@vire/core');
  return {
    QUEUE_NOTIFY_EXTERNAL: actual.QUEUE_NOTIFY_EXTERNAL,
    decideExternalDelivery: actual.decideExternalDelivery,
    friendRequestEmail: actual.friendRequestEmail,
    chatMessageEmail: actual.chatMessageEmail,
  };
});
vi.mock('@vire/core/notifications/unsubscribe', () => ({
  signNotifyUnsub: vi.fn(() => 'signed-token'),
}));
vi.mock('../lib/brevo.js', () => ({ sendBrevoEmail: h.sendBrevoEmail }));
vi.mock('../lib/webpush.js', () => ({ sendPush: h.sendPush }));
vi.mock('../lib/user-presence.js', () => ({ isUserOnline: h.isUserOnline }));
vi.mock('../lib/notify-debounce.js', () => ({ chatEmailDebounced: h.chatEmailDebounced }));
vi.mock('../queues/connection.js', () => ({ connection: {} }));

import { handle } from './notify-external.worker.js';

const RECIPIENT_ID = 'recipient-1';
const ACTOR_ID = 'actor-1';

function makeJob(data: Partial<ExternalNotifyJobData> = {}): Job<ExternalNotifyJobData> {
  return {
    data: { kind: 'FRIEND_REQUEST', recipientId: RECIPIENT_ID, actorId: ACTOR_ID, ...data },
  } as unknown as Job<ExternalNotifyJobData>;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getUserNotifyContext.mockResolvedValue({
    email: 'user@example.com',
    name: 'Получатель',
    notifyEmail: true,
    notifyPush: true,
  });
  h.getUserDisplayName.mockResolvedValue('Актёр');
  h.listPushSubscriptions.mockResolvedValue([{ endpoint: 'https://push/1', p256dh: 'p1', auth: 'a1' }]);
  h.isUserOnline.mockResolvedValue(false);
  h.chatEmailDebounced.mockResolvedValue(false);
  h.sendPush.mockResolvedValue([]);
  h.sendBrevoEmail.mockResolvedValue(undefined);
  h.deletePushSubscriptionsByEndpoints.mockResolvedValue(undefined);
});

describe('notify-external handle', () => {
  it('sends nothing when the recipient is online', async () => {
    h.isUserOnline.mockResolvedValue(true);
    await handle(makeJob());
    expect(h.sendBrevoEmail).not.toHaveBeenCalled();
    expect(h.sendPush).not.toHaveBeenCalled();
  });

  it('does not plant the chat-email debounce key when the recipient is online', async () => {
    h.isUserOnline.mockResolvedValue(true);
    await handle(makeJob({ kind: 'CHAT_MESSAGE', conversationId: 'conv-1' }));
    expect(h.chatEmailDebounced).not.toHaveBeenCalled();
    expect(h.sendBrevoEmail).not.toHaveBeenCalled();
    expect(h.sendPush).not.toHaveBeenCalled();
  });

  it('sends both email and push when offline with both channels enabled', async () => {
    await handle(makeJob());
    expect(h.sendBrevoEmail).toHaveBeenCalledTimes(1);
    expect(h.sendPush).toHaveBeenCalledTimes(1);
  });

  it('prunes dead push endpoints returned by sendPush', async () => {
    h.sendPush.mockResolvedValue(['https://push/dead']);
    await handle(makeJob());
    expect(h.deletePushSubscriptionsByEndpoints).toHaveBeenCalledWith(['https://push/dead']);
  });

  it('skips email but still sends push for a debounced chat message', async () => {
    h.chatEmailDebounced.mockResolvedValue(true);
    await handle(makeJob({ kind: 'CHAT_MESSAGE', conversationId: 'conv-1' }));
    expect(h.sendBrevoEmail).not.toHaveBeenCalled();
    expect(h.sendPush).toHaveBeenCalledTimes(1);
  });

  it('keeps the chat push body content-free', async () => {
    await handle(makeJob({ kind: 'CHAT_MESSAGE', conversationId: 'conv-1' }));
    const payload = h.sendPush.mock.calls[0][1];
    expect(payload.body).toBe('Новое сообщение от Актёр');
  });

  it('tags friend-request push per actor so distinct requesters do not collapse', async () => {
    await handle(makeJob({ kind: 'FRIEND_REQUEST', actorId: 'actor-42' }));
    const payload = h.sendPush.mock.calls[0][1];
    expect(payload.tag).toBe('friend-request:actor-42');
  });

  it('does not fail the job when pruning dead push endpoints throws', async () => {
    h.sendPush.mockResolvedValue(['https://push/dead']);
    h.deletePushSubscriptionsByEndpoints.mockRejectedValue(new Error('db down'));
    await expect(handle(makeJob())).resolves.toBeUndefined();
  });
});
