import { describe, it, expect } from 'vitest';
import type { ChatMessage } from '@vire/core';
import { mergeMessages, normalizeMessage, type PendingMessage } from './chat-messages';

function msg(id: string, createdAt: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return { id, conversationId: 'c1', senderId: 'u1', body: `body-${id}`, nonce: 'n', createdAt: new Date(createdAt), ...overrides };
}

describe('normalizeMessage', () => {
  it('приводит createdAt к Date', () => {
    const raw = { ...msg('m1', '2026-01-01T00:00:00.000Z'), createdAt: '2026-01-01T00:00:00.000Z' as unknown as Date };
    const result = normalizeMessage(raw);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('mergeMessages', () => {
  it('сортирует не-pending по createdAt по возрастанию', () => {
    const prev = [msg('m2', '2026-01-01T00:00:02Z')];
    const incoming = [msg('m1', '2026-01-01T00:00:01Z')];
    expect(mergeMessages(prev, incoming).map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('дедуп по id — серверная версия побеждает', () => {
    const prev: PendingMessage[] = [{ ...msg('m1', '2026-01-01T00:00:01Z'), body: 'old' }];
    const incoming = [msg('m1', '2026-01-01T00:00:01Z', { body: 'new' })];
    const result = mergeMessages(prev, incoming);
    expect(result).toHaveLength(1);
    expect(result[0]!.body).toBe('new');
  });

  it('снимает pending, чей шифротекст совпал с пришедшим серверным сообщением', () => {
    const pending: PendingMessage = { ...msg('pending-1', '2026-01-01T00:00:03Z', { body: 'ct==' }), pending: true };
    const real = msg('real-1', '2026-01-01T00:00:03Z', { body: 'ct==' });
    const result = mergeMessages([pending], [real]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('real-1');
    expect(result[0]!.pending).toBeUndefined();
  });

  it('нерешённые pending остаются в хвосте после отсортированных', () => {
    const settled = msg('m1', '2026-01-01T00:00:01Z');
    const pending: PendingMessage = { ...msg('pending-1', '2026-01-01T00:00:05Z', { body: 'still-pending' }), pending: true };
    const result = mergeMessages([settled, pending], []);
    expect(result.map((m) => m.id)).toEqual(['m1', 'pending-1']);
  });

  it('при равном createdAt тай-брейк по id', () => {
    const same = '2026-01-01T00:00:01Z';
    const result = mergeMessages([msg('b', same)], [msg('a', same)]);
    expect(result.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('прикрепляет старую страницу истории впереди и держит всё отсортированным', () => {
    const current = [msg('m3', '2026-01-01T00:00:03Z'), msg('m4', '2026-01-01T00:00:04Z')];
    const olderPage = [msg('m1', '2026-01-01T00:00:01Z'), msg('m2', '2026-01-01T00:00:02Z')];
    expect(mergeMessages(current, olderPage).map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });
});
