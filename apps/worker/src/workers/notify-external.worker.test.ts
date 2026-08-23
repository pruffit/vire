import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { ExternalNotifyJobData } from '@vire/core';
import { getTranslator } from '@vire/i18n';

const h = vi.hoisted(() => ({
  // SIGNING_SECRET читается на уровне модуля воркера — выставить до его импорта
  _env: (process.env.LINK_SIGNING_SECRET = 'test-secret'),
  getUserNotifyContext: vi.fn(),
  getUserDisplayName: vi.fn(),
  listPushSubscriptions: vi.fn(),
  deletePushSubscriptionsByEndpoints: vi.fn(),
  listExpoPushTokens: vi.fn(),
  deleteExpoPushTokensByTokens: vi.fn(),
  sendBrevoEmail: vi.fn(),
  sendPush: vi.fn(),
  sendExpoPush: vi.fn(),
  isUserOnline: vi.fn(),
  chatEmailDebounced: vi.fn(),
}));

vi.mock('@vire/db', () => ({
  getUserNotifyContext: h.getUserNotifyContext,
  getUserDisplayName: h.getUserDisplayName,
  listPushSubscriptions: h.listPushSubscriptions,
  deletePushSubscriptionsByEndpoints: h.deletePushSubscriptionsByEndpoints,
  listExpoPushTokens: h.listExpoPushTokens,
  deleteExpoPushTokensByTokens: h.deleteExpoPushTokensByTokens,
}));
vi.mock('@vire/core', async () => {
  const actual = await vi.importActual<typeof import('@vire/core')>('@vire/core');
  return {
    QUEUE_NOTIFY_EXTERNAL: actual.QUEUE_NOTIFY_EXTERNAL,
    decideExternalDelivery: actual.decideExternalDelivery,
    EXTERNAL_NOTIFY_EVENTS: actual.EXTERNAL_NOTIFY_EVENTS,
  };
});
vi.mock('@vire/core/notifications/unsubscribe', () => ({
  signNotifyUnsub: vi.fn(() => 'signed-token'),
}));
vi.mock('../lib/brevo.js', () => ({ sendBrevoEmail: h.sendBrevoEmail }));
vi.mock('../lib/webpush.js', () => ({ sendPush: h.sendPush }));
vi.mock('../lib/expo-push.js', () => ({ sendExpoPush: h.sendExpoPush }));
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
  h.listExpoPushTokens.mockResolvedValue([]);
  h.isUserOnline.mockResolvedValue(false);
  h.chatEmailDebounced.mockResolvedValue(false);
  h.sendPush.mockResolvedValue([]);
  h.sendExpoPush.mockResolvedValue([]);
  h.sendBrevoEmail.mockResolvedValue(undefined);
  h.deletePushSubscriptionsByEndpoints.mockResolvedValue(undefined);
  h.deleteExpoPushTokensByTokens.mockResolvedValue(undefined);
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

  it('attaches RFC 8058 one-click unsubscribe headers to the email', async () => {
    await handle(makeJob());
    const headers = h.sendBrevoEmail.mock.calls[0][3];
    expect(headers['List-Unsubscribe']).toMatch(/^<http.*uid=recipient-1&token=signed-token&locale=ru>$/);
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
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
    const t = await getTranslator('ru', 'email');
    expect(payload.body).toBe(t('push.chatMessage.body', { name: 'Актёр' }));
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

  it('sends expo push alongside web push when tokens exist', async () => {
    h.listExpoPushTokens.mockResolvedValue([{ token: 'expo-1' }, { token: 'expo-2' }]);
    await handle(makeJob());
    expect(h.sendExpoPush).toHaveBeenCalledTimes(1);
    expect(h.sendExpoPush).toHaveBeenCalledWith(['expo-1', 'expo-2'], h.sendPush.mock.calls[0][1]);
  });

  it('prunes dead expo tokens returned by sendExpoPush', async () => {
    h.listExpoPushTokens.mockResolvedValue([{ token: 'expo-dead' }]);
    h.sendExpoPush.mockResolvedValue(['expo-dead']);
    await handle(makeJob());
    expect(h.deleteExpoPushTokensByTokens).toHaveBeenCalledWith(['expo-dead']);
  });

  it('does not fail the job when pruning dead expo tokens throws', async () => {
    h.listExpoPushTokens.mockResolvedValue([{ token: 'expo-dead' }]);
    h.sendExpoPush.mockResolvedValue(['expo-dead']);
    h.deleteExpoPushTokensByTokens.mockRejectedValue(new Error('db down'));
    await expect(handle(makeJob())).resolves.toBeUndefined();
  });

  it('counts expo tokens toward the push-enabled decision even with no web subs', async () => {
    h.listPushSubscriptions.mockResolvedValue([]);
    h.listExpoPushTokens.mockResolvedValue([{ token: 'expo-only' }]);
    await handle(makeJob());
    expect(h.sendExpoPush).toHaveBeenCalledWith(['expo-only'], expect.any(Object));
  });

  it('renders push and email in the recipient locale (en), with /en-prefixed links', async () => {
    h.getUserNotifyContext.mockResolvedValue({
      email: 'user@example.com',
      name: 'Получатель',
      notifyEmail: true,
      notifyPush: true,
      locale: 'en',
    });
    await handle(makeJob({ kind: 'CHAT_MESSAGE', conversationId: 'conv-1' }));
    const payload = h.sendPush.mock.calls[0][1];
    const t = await getTranslator('en', 'email');
    expect(payload.title).toBe(t('push.chatMessage.title'));
    expect(payload.body).toBe(t('push.chatMessage.body', { name: 'Актёр' }));
    expect(payload.url).toContain('/en/messages');
    const [, , html] = h.sendBrevoEmail.mock.calls[0];
    expect(html).toContain('<html lang="en">');
  });
});
