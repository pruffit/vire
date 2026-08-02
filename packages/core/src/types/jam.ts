export type JamSessionStatus = 'LIVE' | 'ENDED';
export type JamParticipantRole = 'HOST' | 'GUEST';
export type JamMode = 'SYNCED' | 'SPEAKER';
export type JamSessionKind = 'JAM' | 'PARTY';
export type JamQueueSource = 'VIRE' | 'YOUTUBE' | 'SOUNDCLOUD' | 'LOCAL';

export interface JamSession {
  id: string;
  code: string;
  hostUserId: string;
  title: string | null;
  status: JamSessionStatus;
  mode: JamMode;
  kind: JamSessionKind;
  /** null — источник звука хост (дефолт). */
  speakerParticipantId: string | null;
  queueVersion: number;
  savedPlaylistId: string | null;
  createdAt: Date;
  lastActivityAt: Date;
  endedAt: Date | null;
}

export interface JamParticipant {
  id: string;
  jamId: string;
  userId: string | null;
  guestSessionId: string | null;
  displayName: string;
  role: JamParticipantRole;
  joinedAt: Date;
  lastSeenAt: Date;
}

export interface JamQueueItem {
  id: string;
  source: JamQueueSource;
  /** Только для source='VIRE'. */
  trackId: string | null;
  /** Только для источников вне каталога (не 'VIRE'). */
  externalId: string | null;
  externalUrl: string | null;
  position: number;
  addedByParticipantId: string | null;
  addedAt: Date;
  title: string;
  durationSec: number | null;
  artistName: string;
  /** Каталожные поля — только для source='VIRE'. */
  artistSlug: string | null;
  releaseId: string | null;
  coverUrl: string | null;
  accentColor: string | null;
  isExplicit: boolean | null;
  version: string | null;
  feat: string[] | null;
}

export interface JamSessionState {
  session: JamSession;
  participants: JamParticipant[];
  queue: JamQueueItem[];
}
