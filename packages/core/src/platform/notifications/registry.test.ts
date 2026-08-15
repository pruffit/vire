import { describe, it, expect } from 'vitest';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_IDS,
  isKnownNotificationType,
  notificationTargetOf,
} from './registry';

describe('реестр типов уведомлений', () => {
  it('id в ключе и в определении совпадают', () => {
    for (const [key, def] of Object.entries(NOTIFICATION_TYPES)) {
      expect(def.id).toBe(key);
    }
  });

  it('NOTIFICATION_TYPE_IDS покрывает весь реестр', () => {
    expect([...NOTIFICATION_TYPE_IDS].sort()).toEqual(Object.keys(NOTIFICATION_TYPES).sort());
  });

  it('известные типы распознаются, неизвестные — нет', () => {
    expect(isKnownNotificationType('FRIEND_REQUEST')).toBe(true);
    expect(isKnownNotificationType('NOPE')).toBe(false);
    expect(isKnownNotificationType('toString')).toBe(false);
  });

  it('target уводит на нужную сущность', () => {
    expect(notificationTargetOf('JAM_INVITE')).toBe('jam');
    expect(notificationTargetOf('PLAYLIST_COLLAB_JOIN')).toBe('playlist');
    expect(notificationTargetOf('FRIEND_REQUEST')).toBe('actor');
    expect(notificationTargetOf('FRIEND_ACCEPT')).toBe('actor');
    expect(notificationTargetOf('NOPE')).toBeNull();
  });
});
