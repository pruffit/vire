// Core знает механизм уведомлений, но не знает продуктовых типов: конкретные типы
// объявляются реестром, а не union'ом в сигнатурах и не enum'ом в БД.

export type NotificationTypeId = string;

/** К чему ведёт уведомление — из этого клиент строит ссылку. */
export type NotificationTarget = 'actor' | 'jam' | 'playlist';

export interface NotificationTypeDef {
  id: NotificationTypeId;
  target: NotificationTarget;
}

export const NOTIFICATION_TYPES: Readonly<Record<string, NotificationTypeDef>> = {
  FRIEND_REQUEST: { id: 'FRIEND_REQUEST', target: 'actor' },
  FRIEND_ACCEPT: { id: 'FRIEND_ACCEPT', target: 'actor' },
  JAM_INVITE: { id: 'JAM_INVITE', target: 'jam' },
  PLAYLIST_COLLAB_JOIN: { id: 'PLAYLIST_COLLAB_JOIN', target: 'playlist' },
};

export const NOTIFICATION_TYPE_IDS: readonly NotificationTypeId[] = Object.keys(NOTIFICATION_TYPES);

export function isKnownNotificationType(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_TYPES, id);
}

export function notificationTargetOf(id: string): NotificationTarget | null {
  return NOTIFICATION_TYPES[id]?.target ?? null;
}
