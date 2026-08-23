import { describe, it, expect, vi } from 'vitest';

// Только парсинг тестируем — но модуль тянет secure-store → expo-secure-store, которого в
// node-окружении vitest нет (тот же паттерн, что e2ee/__tests__/identity.test.ts).
vi.mock('../secure-store', () => ({ getStored: () => Promise.resolve(null) }));

import { parseChatRealtimeEvent } from '../chat-realtime';

describe('parseChatRealtimeEvent', () => {
  it('парсит валидный JSON с полем type', () => {
    const event = parseChatRealtimeEvent(JSON.stringify({ type: 'message', conversationId: 'c1' }));
    expect(event).toEqual({ type: 'message', conversationId: 'c1' });
  });

  it('malformed JSON не бросает — возвращает null', () => {
    expect(parseChatRealtimeEvent('{not json')).toBeNull();
  });

  it('null/undefined payload — null', () => {
    expect(parseChatRealtimeEvent(null)).toBeNull();
    expect(parseChatRealtimeEvent(undefined)).toBeNull();
  });

  it('JSON без строкового type — null', () => {
    expect(parseChatRealtimeEvent(JSON.stringify({ foo: 'bar' }))).toBeNull();
    expect(parseChatRealtimeEvent(JSON.stringify({ type: 42 }))).toBeNull();
    expect(parseChatRealtimeEvent('null')).toBeNull();
    expect(parseChatRealtimeEvent('"a string"')).toBeNull();
  });

  it('пропускает не-message типы наравне (фильтрация — на стороне вызывающего)', () => {
    expect(parseChatRealtimeEvent(JSON.stringify({ type: 'notification' }))).toEqual({ type: 'notification' });
  });
});
