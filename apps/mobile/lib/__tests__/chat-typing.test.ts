import { describe, it, expect } from 'vitest';
import { shouldSendTypingPing, isReadByPeer, TYPING_THROTTLE_MS } from '../chat-typing';

describe('shouldSendTypingPing', () => {
  it('первый пинг (lastSentAt=0, реальный now далеко за throttle-окном) — разрешён', () => {
    expect(shouldSendTypingPing(0, Date.now())).toBe(true);
  });

  it('внутри throttle-окна — запрещён', () => {
    expect(shouldSendTypingPing(1000, 1000 + TYPING_THROTTLE_MS - 1)).toBe(false);
  });

  it('ровно на границе throttle-окна — разрешён', () => {
    expect(shouldSendTypingPing(1000, 1000 + TYPING_THROTTLE_MS)).toBe(true);
  });

  it('после throttle-окна — разрешён', () => {
    expect(shouldSendTypingPing(1000, 1000 + TYPING_THROTTLE_MS + 500)).toBe(true);
  });
});

describe('isReadByPeer', () => {
  it('нет своего сообщения — false', () => {
    expect(isReadByPeer(null, '2026-08-23T00:00:00.000Z')).toBe(false);
  });

  it('нет ещё chat:read от собеседника — false', () => {
    expect(isReadByPeer('2026-08-23T00:00:00.000Z', null)).toBe(false);
  });

  it('readAt позже createdAt — true', () => {
    expect(isReadByPeer('2026-08-23T00:00:00.000Z', '2026-08-23T00:00:05.000Z')).toBe(true);
  });

  it('readAt раньше createdAt (устаревшее прочтение до отправки нового сообщения) — false', () => {
    expect(isReadByPeer('2026-08-23T00:00:05.000Z', '2026-08-23T00:00:00.000Z')).toBe(false);
  });

  it('readAt равен createdAt — true', () => {
    expect(isReadByPeer('2026-08-23T00:00:00.000Z', '2026-08-23T00:00:00.000Z')).toBe(true);
  });
});
