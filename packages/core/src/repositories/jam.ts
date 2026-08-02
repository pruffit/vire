import type { JamSession, JamParticipant, JamQueueItem, JamSessionState, JamParticipantRole, JamMode, JamSessionKind, JamQueueSource } from '../types/jam';

export interface CreateJamSessionInput {
  code: string;
  hostUserId: string;
  title: string | null;
  /** По умолчанию SYNCED — репозиторий полагается на дефолт колонки, если не передан. */
  mode?: JamMode;
  /** По умолчанию JAM — репозиторий полагается на дефолт колонки, если не передан. */
  kind?: JamSessionKind;
}

export type JamParticipantIdentity = { userId: string } | { guestSessionId: string };

export interface UpsertJamParticipantInput {
  jamId: string;
  identity: JamParticipantIdentity;
  displayName: string;
  /** Роль на вставку. При повторном join существующая роль не меняется (хост остаётся хостом). */
  role: JamParticipantRole;
}

export interface JamQueueItemWrite {
  /** Существующий элемент сохраняет id при перезаписи очереди: иначе чужая мутация обесценит id у всех и параллельный move схлопнется в no-op. */
  id?: string;
  source: JamQueueSource;
  /** Только для source='VIRE'. */
  trackId: string | null;
  externalId: string | null;
  externalUrl: string | null;
  /** Снапшот метаданных внешней/локальной позиции — null для 'VIRE' (отображение идёт через join). */
  title: string | null;
  artistName: string | null;
  coverUrl: string | null;
  durationSec: number | null;
  addedByParticipantId: string | null;
  addedAt: Date;
}

export interface IJamRepository {
  createSession(input: CreateJamSessionInput): Promise<JamSession>;
  findByCode(code: string): Promise<JamSession | null>;
  findById(id: string): Promise<JamSession | null>;
  getSessionState(jamId: string): Promise<JamSessionState | null>;
  findParticipant(jamId: string, identity: JamParticipantIdentity): Promise<JamParticipant | null>;
  upsertParticipant(input: UpsertJamParticipantInput): Promise<JamParticipant>;
  touchParticipant(participantId: string): Promise<void>;
  removeParticipant(jamId: string, participantId: string): Promise<void>;
  listQueue(jamId: string): Promise<JamQueueItem[]>;
  /** Транзакционная полная перезапись очереди + инкремент queue_version. */
  replaceQueue(jamId: string, items: JamQueueItemWrite[], nextVersion: number): Promise<void>;
  countParticipants(jamId: string): Promise<number>;
  countQueueItems(jamId: string): Promise<number>;
  endSession(jamId: string): Promise<void>;
  setSavedPlaylist(jamId: string, playlistId: string): Promise<void>;
  setMode(jamId: string, mode: JamMode): Promise<void>;
  setSpeaker(jamId: string, participantId: string | null): Promise<void>;
  touchActivity(jamId: string): Promise<void>;
  /** LIVE-сессии без активности дольше olderThanHours (порог считается в SQL интервалом). */
  listStaleLiveSessions(olderThanHours: number): Promise<JamSession[]>;
}
