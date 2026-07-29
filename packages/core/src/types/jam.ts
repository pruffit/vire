export type JamSessionStatus = 'LIVE' | 'ENDED';
export type JamParticipantRole = 'HOST' | 'GUEST';
export type JamMode = 'SYNCED' | 'SPEAKER';

export interface JamSession {
  id: string;
  code: string;
  hostUserId: string;
  title: string | null;
  status: JamSessionStatus;
  mode: JamMode;
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
  trackId: string;
  position: number;
  addedByParticipantId: string | null;
  addedAt: Date;
  title: string;
  durationSec: number | null;
  artistName: string;
  artistSlug: string;
  releaseId: string;
  coverUrl: string | null;
  accentColor: string | null;
  isExplicit: boolean;
  version: string | null;
  feat: string[];
}

export interface JamSessionState {
  session: JamSession;
  participants: JamParticipant[];
  queue: JamQueueItem[];
}
