import { err, ok, NotFoundError, ConflictError, ValidationError, ForbiddenError, type Result } from '../errors';
import { generateJamCode, normalizeJamCode } from './jam-code';
import { applyQueueMutation, insertPartyQueueItem, type QueueMutation, type QueueEntry } from './jam-queue';
import type { JamPlaybackState } from './jam-sync';
import type {
  IJamRepository,
  JamParticipantIdentity,
  JamQueueItemWrite,
} from '../repositories/jam';
import type { IJamStateStore } from '../ports/jam-state';
import type { IJamBroadcaster } from '../ports/jam-realtime';
import type { Clock } from '../ports/effects';
import type { JamSession, JamParticipant, JamQueueItem, JamMode, JamSessionKind } from '../types/jam';
import type { ExternalTrackRef } from '../types/external';

export const JAM_MAX_QUEUE = 200;
export const JAM_MAX_PARTICIPANTS = 50;
export const JAM_MAX_ADDS_PER_MIN = 10;

const JAM_CODE_MAX_ATTEMPTS = 5;

export type QueueMutationIntent =
  | { kind: 'add'; trackId: string }
  | { kind: 'remove'; itemId: string }
  | { kind: 'move'; itemId: string; toPosition: number }
  | { kind: 'shuffle' };

export type ExternalQueueEntry = ExternalTrackRef;

export type PlaybackIntent =
  | { kind: 'play'; itemId: string; positionMs: number }
  | { kind: 'pause'; positionMs: number }
  | { kind: 'seek'; positionMs: number }
  | { kind: 'track'; itemId: string };

export interface JamFullState {
  session: JamSession;
  participants: JamParticipant[];
  queue: JamQueueItem[];
  playback: JamPlaybackState | null;
  presentParticipantIds: string[];
}

function forbidden(message = 'Вы не участник этого джема'): ForbiddenError {
  return new ForbiddenError(message);
}

function toWriteItem(item: JamQueueItem): JamQueueItemWrite {
  // Снапшот-колонки (title/artistName/coverUrl/durationSec) — только для внешних источников;
  // для VIRE отображаемые значения идут через join, в строке они не дублируются.
  const isVire = item.source === 'VIRE';
  return {
    id: item.id,
    source: item.source,
    trackId: item.trackId,
    externalId: item.externalId,
    externalUrl: item.externalUrl,
    title: isVire ? null : item.title,
    artistName: isVire ? null : item.artistName,
    coverUrl: isVire ? null : item.coverUrl,
    durationSec: isVire ? null : item.durationSec,
    addedByParticipantId: item.addedByParticipantId,
    addedAt: item.addedAt,
  };
}

export class JamService {
  constructor(
    private readonly repo: IJamRepository,
    private readonly state: IJamStateStore,
    private readonly broadcaster: IJamBroadcaster,
    private readonly clock: Clock,
    private readonly random: () => number,
  ) {}

  async create(
    hostUserId: string,
    title: string | null,
    hostDisplayName: string,
    mode: JamMode = 'SYNCED',
    kind: JamSessionKind = 'JAM',
  ): Promise<Result<JamSession, ConflictError>> {
    for (let attempt = 0; attempt < JAM_CODE_MAX_ATTEMPTS; attempt++) {
      const code = generateJamCode(this.random);
      if (await this.repo.findByCode(code)) continue;

      const session = await this.repo.createSession({ code, hostUserId, title, mode, kind });
      await this.repo.upsertParticipant({
        jamId: session.id,
        identity: { userId: hostUserId },
        displayName: hostDisplayName,
        role: 'HOST',
      });
      return ok(session);
    }
    return err(new ConflictError('Не удалось сгенерировать код джема, попробуйте ещё раз'));
  }

  /** Резолв кода джема в сессию для роутов, которым дальше нужен jamId (не тащить БД в хендлер). */
  async resolveCode(code: string): Promise<Result<JamSession, ValidationError | NotFoundError>> {
    const normalized = normalizeJamCode(code);
    if (!normalized) return err(new ValidationError('Неверный код джема'));

    const session = await this.repo.findByCode(normalized);
    if (!session) return err(new NotFoundError('Jam', normalized));
    return ok(session);
  }

  /** Публичный превью для экрана входа — до join'а у гостя ещё нет identity для getState. */
  async preview(code: string): Promise<Result<{ session: JamSession; hostDisplayName: string }, ValidationError | NotFoundError>> {
    const codeResult = await this.resolveCode(code);
    if (!codeResult.ok) return codeResult;

    const state = await this.repo.getSessionState(codeResult.value.id);
    const host = state?.participants.find((p) => p.role === 'HOST');
    return ok({ session: codeResult.value, hostDisplayName: host?.displayName ?? 'Хост' });
  }

  async join(
    code: string,
    identity: JamParticipantIdentity,
    displayName: string,
  ): Promise<Result<{ session: JamSession; participant: JamParticipant }, ValidationError | NotFoundError | ConflictError>> {
    const normalized = normalizeJamCode(code);
    if (!normalized) return err(new ValidationError('Неверный код джема'));

    const session = await this.repo.findByCode(normalized);
    if (!session) return err(new NotFoundError('Jam', normalized));
    if (session.status !== 'LIVE') return err(new ConflictError('Джем уже завершён'));

    const existing = await this.repo.findParticipant(session.id, identity);
    if (!existing) {
      const count = await this.repo.countParticipants(session.id);
      if (count >= JAM_MAX_PARTICIPANTS) return err(new ConflictError('Джем заполнен'));
    }

    // Роль на вставку — GUEST; репозиторий не понижает уже сохранённую роль (хост остаётся хостом).
    const participant = await this.repo.upsertParticipant({ jamId: session.id, identity, displayName, role: 'GUEST' });
    await this.broadcastParticipants(session.id, [participant]);
    return ok({ session, participant });
  }

  /** Свежий список участников после join/kick — без этого другие вкладки узнают о смене только через refresh. */
  private async broadcastParticipants(jamId: string, fallback: JamParticipant[]): Promise<void> {
    const state = await this.repo.getSessionState(jamId);
    await this.broadcaster.broadcast(jamId, { type: 'jam:participants', participants: state?.participants ?? fallback });
  }

  async getState(jamId: string, identity: JamParticipantIdentity): Promise<Result<JamFullState, ForbiddenError | NotFoundError>> {
    const participant = await this.repo.findParticipant(jamId, identity);
    if (!participant) return err(forbidden());

    const sessionState = await this.repo.getSessionState(jamId);
    if (!sessionState) return err(new NotFoundError('Jam', jamId));

    const playback = await this.state.getPlayback(jamId);
    const presentParticipantIds = await this.state.listPresent(jamId);
    return ok({ ...sessionState, playback, presentParticipantIds });
  }

  async assertParticipant(jamId: string, identity: JamParticipantIdentity): Promise<Result<JamParticipant, ForbiddenError>> {
    const participant = await this.repo.findParticipant(jamId, identity);
    if (!participant) return err(forbidden());
    return ok(participant);
  }

  /** Резолв id → сессия, для роутов вне кода джема (напр. редирект `/jam/id/{jamId}`). */
  async resolveId(jamId: string): Promise<Result<JamSession, NotFoundError>> {
    const session = await this.repo.findById(jamId);
    if (!session) return err(new NotFoundError('Jam', jamId));
    return ok(session);
  }

  async getQueueForSave(
    jamId: string,
    identity: JamParticipantIdentity,
  ): Promise<Result<{ session: JamSession; isHost: boolean; queue: JamQueueItem[] }, ForbiddenError | NotFoundError>> {
    const participant = await this.repo.findParticipant(jamId, identity);
    if (!participant) return err(forbidden());

    const sessionState = await this.repo.getSessionState(jamId);
    if (!sessionState) return err(new NotFoundError('Jam', jamId));

    return ok({ session: sessionState.session, isHost: participant.role === 'HOST', queue: sessionState.queue });
  }

  async recordSavedPlaylist(jamId: string, playlistId: string): Promise<void> {
    await this.repo.setSavedPlaylist(jamId, playlistId);
  }

  async mutateQueue(
    jamId: string,
    identity: JamParticipantIdentity,
    intent: QueueMutationIntent,
  ): Promise<Result<{ queue: JamQueueItem[]; version: number }, ForbiddenError | NotFoundError | ConflictError>> {
    const participant = await this.repo.findParticipant(jamId, identity);
    if (!participant) return err(forbidden());

    const sessionState = await this.repo.getSessionState(jamId);
    if (!sessionState) return err(new NotFoundError('Jam', jamId));
    if (sessionState.session.status !== 'LIVE') return err(new ConflictError('Джем уже завершён'));

    if (intent.kind === 'add') {
      const addCount = await this.state.bumpAddCounter(jamId, participant.id);
      if (addCount > JAM_MAX_ADDS_PER_MIN) return err(new ConflictError('Слишком много добавлений, попробуйте через минуту'));

      if (sessionState.queue.length >= JAM_MAX_QUEUE) return err(new ConflictError('Очередь переполнена'));
    }

    if (intent.kind === 'remove') {
      const target = sessionState.queue.find((i) => i.id === intent.itemId);
      if (target && participant.role !== 'HOST' && target.addedByParticipantId !== participant.id) {
        return err(forbidden('Удалить чужой трек может только хост'));
      }
    }

    const mutation: QueueMutation =
      intent.kind === 'add'
        ? { kind: 'add', entry: { source: 'VIRE', trackId: intent.trackId }, participantId: participant.id, addedAt: new Date(this.clock()) }
        : intent.kind === 'shuffle'
          ? { kind: 'shuffle', random: this.random }
          : intent;

    return this.commitQueueMutation(jamId, sessionState, participant, intent.kind === 'add', mutation);
  }

  /**
   * Внешняя (не-каталожная) позиция — только для kind='PARTY'. Резолв ссылки в дескриптор —
   * ответственность вызывающей стороны (срез B); здесь только гарды и запись.
   */
  async addExternalItem(
    jamId: string,
    identity: JamParticipantIdentity,
    entry: ExternalQueueEntry,
  ): Promise<Result<{ queue: JamQueueItem[]; version: number }, ForbiddenError | NotFoundError | ConflictError | ValidationError>> {
    const participant = await this.repo.findParticipant(jamId, identity);
    if (!participant) return err(forbidden());

    const sessionState = await this.repo.getSessionState(jamId);
    if (!sessionState) return err(new NotFoundError('Jam', jamId));
    if (sessionState.session.status !== 'LIVE') return err(new ConflictError('Джем уже завершён'));
    if (sessionState.session.kind !== 'PARTY') return err(new ValidationError('Внешние треки доступны только в режиме вечеринки'));

    const addCount = await this.state.bumpAddCounter(jamId, participant.id);
    if (addCount > JAM_MAX_ADDS_PER_MIN) return err(new ConflictError('Слишком много добавлений, попробуйте через минуту'));
    if (sessionState.queue.length >= JAM_MAX_QUEUE) return err(new ConflictError('Очередь переполнена'));

    const mutation: QueueMutation = { kind: 'add', entry, participantId: participant.id, addedAt: new Date(this.clock()) };
    return this.commitQueueMutation(jamId, sessionState, participant, true, mutation);
  }

  private async commitQueueMutation(
    jamId: string,
    sessionState: { session: JamSession; queue: JamQueueItem[] },
    participant: JamParticipant,
    isAdd: boolean,
    mutation: QueueMutation,
  ): Promise<Result<{ queue: JamQueueItem[]; version: number }, never>> {
    const existingWriteItems = sessionState.queue.map(toWriteItem);
    const appended = applyQueueMutation(existingWriteItems, mutation);

    let nextItems = appended;
    if (isAdd && sessionState.session.kind === 'PARTY') {
      const currentItemId = (await this.state.getPlayback(jamId))?.itemId ?? null;
      const newItem = appended[appended.length - 1]!;
      nextItems = insertPartyQueueItem(existingWriteItems, newItem, { addedByParticipantId: participant.id, currentItemId });
    }

    const nextVersion = sessionState.session.queueVersion + 1;
    await this.repo.replaceQueue(jamId, nextItems, nextVersion);

    const queue = await this.repo.listQueue(jamId);
    await this.broadcaster.broadcast(jamId, { type: 'jam:queue', queue, version: nextVersion });
    return ok({ queue, version: nextVersion });
  }

  async setPlayback(
    jamId: string,
    identity: JamParticipantIdentity,
    intent: PlaybackIntent,
  ): Promise<Result<JamPlaybackState, NotFoundError | ForbiddenError | ConflictError>> {
    const participant = await this.repo.findParticipant(jamId, identity);
    if (!participant) return err(forbidden());

    const session = await this.repo.findById(jamId);
    if (!session) return err(new NotFoundError('Jam', jamId));
    if (session.status !== 'LIVE') return err(new ConflictError('Джем уже завершён'));

    const current = await this.state.getPlayback(jamId);
    const now = this.clock();
    const nextVersion = (current?.version ?? 0) + 1;

    let next: JamPlaybackState;
    switch (intent.kind) {
      case 'play':
        next = { itemId: intent.itemId, startedAtMs: now - intent.positionMs, paused: false, pausedPositionMs: 0, version: nextVersion };
        break;
      case 'track':
        next = { itemId: intent.itemId, startedAtMs: now, paused: false, pausedPositionMs: 0, version: nextVersion };
        break;
      case 'pause':
        if (!current) return err(new ConflictError('Нет активного трека'));
        next = { ...current, paused: true, pausedPositionMs: intent.positionMs, version: nextVersion };
        break;
      case 'seek':
        if (!current) return err(new ConflictError('Нет активного трека'));
        next = current.paused
          ? { ...current, pausedPositionMs: intent.positionMs, version: nextVersion }
          : { ...current, startedAtMs: now - intent.positionMs, version: nextVersion };
        break;
    }

    await this.state.setPlayback(jamId, next);
    await this.broadcaster.broadcast(jamId, { type: 'jam:playback', playback: next });
    return ok(next);
  }

  async setMode(
    jamId: string,
    identity: JamParticipantIdentity,
    mode: JamMode,
  ): Promise<Result<{ mode: JamMode; speakerParticipantId: string | null }, ForbiddenError | NotFoundError | ConflictError>> {
    const participant = await this.repo.findParticipant(jamId, identity);
    if (!participant) return err(forbidden());
    if (participant.role !== 'HOST') return err(forbidden('Режим меняет только хост'));

    const session = await this.repo.findById(jamId);
    if (!session) return err(new NotFoundError('Jam', jamId));
    if (session.status !== 'LIVE') return err(new ConflictError('Джем уже завершён'));

    await this.repo.setMode(jamId, mode);
    const result = { mode, speakerParticipantId: session.speakerParticipantId };
    await this.broadcaster.broadcast(jamId, { type: 'jam:session', ...result });
    return ok(result);
  }

  /** Любой участник может забрать роль звукового устройства себе. */
  async claimSpeaker(
    jamId: string,
    identity: JamParticipantIdentity,
  ): Promise<Result<{ mode: JamMode; speakerParticipantId: string | null }, ForbiddenError | NotFoundError | ConflictError>> {
    const participant = await this.repo.findParticipant(jamId, identity);
    if (!participant) return err(forbidden());

    const session = await this.repo.findById(jamId);
    if (!session) return err(new NotFoundError('Jam', jamId));
    if (session.status !== 'LIVE') return err(new ConflictError('Джем уже завершён'));

    await this.repo.setSpeaker(jamId, participant.id);
    const result = { mode: session.mode, speakerParticipantId: participant.id };
    await this.broadcaster.broadcast(jamId, { type: 'jam:session', ...result });
    return ok(result);
  }

  async endJam(jamId: string, hostUserId: string): Promise<Result<void, NotFoundError | ForbiddenError>> {
    const session = await this.repo.findById(jamId);
    if (!session) return err(new NotFoundError('Jam', jamId));
    if (session.hostUserId !== hostUserId) return err(forbidden('Только хост может завершить джем'));

    await this.repo.endSession(jamId);
    await this.state.clear(jamId);
    await this.broadcaster.broadcast(jamId, { type: 'jam:ended' });
    return ok(undefined);
  }

  async kick(jamId: string, hostUserId: string, participantId: string): Promise<Result<void, NotFoundError | ForbiddenError | ValidationError>> {
    const session = await this.repo.findById(jamId);
    if (!session) return err(new NotFoundError('Jam', jamId));
    if (session.hostUserId !== hostUserId) return err(forbidden('Только хост может кикнуть участника'));

    const host = await this.repo.findParticipant(jamId, { userId: hostUserId });
    if (host && host.id === participantId) return err(new ValidationError('Нельзя кикнуть самого себя'));

    await this.repo.removeParticipant(jamId, participantId);
    await this.broadcastParticipants(jamId, []);
    return ok(undefined);
  }

  async heartbeat(jamId: string, identity: JamParticipantIdentity): Promise<Result<void, ForbiddenError>> {
    const participant = await this.repo.findParticipant(jamId, identity);
    if (!participant) return err(forbidden());

    await this.repo.touchParticipant(participant.id);
    await this.state.heartbeat(jamId, participant.id);
    return ok(undefined);
  }

  async listPresent(jamId: string): Promise<string[]> {
    return this.state.listPresent(jamId);
  }

  /** Клиент отключился от живого SSE-соединения — снять его из presence и оповестить остальных. */
  async leave(jamId: string, identity: JamParticipantIdentity): Promise<Result<void, ForbiddenError>> {
    const participant = await this.repo.findParticipant(jamId, identity);
    if (!participant) return err(forbidden());

    await this.state.dropPresence(jamId, participant.id);
    const participantIds = await this.state.listPresent(jamId);
    await this.broadcaster.broadcast(jamId, { type: 'jam:presence', participantIds });
    return ok(undefined);
  }
}
