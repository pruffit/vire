// Redis-ключи live-присутствия — импортируются и apps/web (пишет), и apps/worker (читает).
export const PRESENCE_TRACK_PREFIX = 'presence:track:' as const;
export const PRESENCE_USER_PREFIX = 'presence:user:' as const;
export const PRESENCE_SITE_KEY = 'presence:site' as const;

export const presenceTrackKey = (trackId: string): string => `${PRESENCE_TRACK_PREFIX}${trackId}`;
export const presenceUserKey = (userId: string): string => `${PRESENCE_USER_PREFIX}${userId}`;
