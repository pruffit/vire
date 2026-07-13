import { err, ok, NotFoundError, ValidationError, type Result } from '../errors';
import type { ITrackRepository, UpdateTrackParams } from '../repositories/track';
import type { IReleaseRepository } from '../repositories/release';
import type { IFileStorage } from '../repositories/storage';
import type { ITrackMoodsRepository } from '../repositories/track-moods';
import type { TranscodeJobData } from '../jobs';
import type { Track, TrackCredit, LyricLine } from '../types/release';
import { authorizeTrackOwnership } from './authorize-track';

export interface ITranscodeQueue {
  add(data: TranscodeJobData): Promise<void>;
}

export type AudioExt = 'wav' | 'flac' | 'mp3';

const AUDIO_CONTENT_TYPE: Record<AudioExt, string> = {
  wav: 'audio/wav',
  flac: 'audio/flac',
  mp3: 'audio/mpeg',
};

export interface TrackServiceDeps {
  audioStorage?: IFileStorage;
  uuid?: () => string;
  moodsRepo?: ITrackMoodsRepository;
}

export class TrackService {
  constructor(
    private readonly trackRepo: ITrackRepository,
    private readonly releaseRepo: IReleaseRepository,
    private readonly queue: ITranscodeQueue,
    private readonly deps: TrackServiceDeps = {},
  ) {}

  async createUpload(params: {
    releaseId: string;
    artistProfileId: string;
    title: string;
    trackNumber: number;
    ext: AudioExt;
    buffer: Uint8Array;
    credits?: TrackCredit[];
  }): Promise<Result<Track, NotFoundError | Error>> {
    const release = await this.releaseRepo.findById(params.releaseId);
    if (!release) return err(new NotFoundError('Release', params.releaseId));

    if (release.artistProfileId !== params.artistProfileId) {
      return err(new Error('Forbidden: release does not belong to this artist'));
    }

    // S3-загрузка после проверки владения релизом — при 403/404 осиротевший объект не создаётся.
    if (!this.deps.audioStorage) throw new Error('TrackService: deps.audioStorage is required to upload audio');
    const trackId = this.deps.uuid ? this.deps.uuid() : crypto.randomUUID();
    const sourceKey = `tracks/${trackId}/source.${params.ext}`;
    await this.deps.audioStorage.upload(sourceKey, params.buffer, AUDIO_CONTENT_TYPE[params.ext]);

    const track = await this.trackRepo.create({
      id: trackId,
      releaseId: params.releaseId,
      title: params.title,
      trackNumber: params.trackNumber,
      credits: params.credits,
    });

    await this.queue.add({ trackId, sourceKey });

    return ok(track);
  }

  async updateTrack(params: {
    trackId: string;
    artistProfileId: string;
    patch: UpdateTrackParams;
  }): Promise<Result<Track, NotFoundError | Error>> {
    const authorized = await authorizeTrackOwnership(
      this.trackRepo, this.releaseRepo, params.trackId, params.artistProfileId,
    );
    if (!authorized.ok) return authorized;

    const updated = await this.trackRepo.update(params.trackId, params.patch);
    if (!updated) return err(new NotFoundError('Track', params.trackId));
    return ok(updated);
  }

  async deleteTrack(params: {
    trackId: string;
    artistProfileId: string;
  }): Promise<Result<void, NotFoundError | Error>> {
    const authorized = await authorizeTrackOwnership(
      this.trackRepo, this.releaseRepo, params.trackId, params.artistProfileId,
    );
    if (!authorized.ok) return authorized;

    await this.trackRepo.delete(params.trackId);
    return ok(undefined);
  }

  // orderedIds должен точно совпадать с треками релиза (без лишних/недостающих/дублей) —
  // иначе частичная перенумерация порушила бы нумерацию.
  async reorderTracks(params: {
    releaseId: string;
    artistProfileId: string;
    orderedIds: string[];
  }): Promise<Result<void, NotFoundError | Error>> {
    const release = await this.releaseRepo.findById(params.releaseId);
    if (!release) return err(new NotFoundError('Release', params.releaseId));
    if (release.artistProfileId !== params.artistProfileId) {
      return err(new Error('Forbidden: release does not belong to this artist'));
    }

    const withTracks = await this.releaseRepo.findWithTracks(params.releaseId);
    const actualIds = withTracks ? withTracks.tracks.map((t) => t.id) : [];

    const seen = new Set(params.orderedIds);
    const sameSize = seen.size === params.orderedIds.length && seen.size === actualIds.length;
    const sameMembers = sameSize && actualIds.every((id) => seen.has(id));
    if (!sameMembers) {
      return err(new Error('Order does not match release tracks'));
    }

    await this.trackRepo.reorder(params.releaseId, params.orderedIds);
    return ok(undefined);
  }

  async adminUpdate(
    trackId: string,
    input: {
      title: string;
      version: string | null;
      trackNumber: number;
      isExplicit: boolean;
      isExclusive: boolean;
      isWip: boolean;
      bpm: number | null;
      musicalKey: string | null;
      moods: string[];
      genres: string[];
      credits: TrackCredit[];
      lyrics: LyricLine[] | null;
    },
  ): Promise<Result<void, ValidationError>> {
    const title = (input.title ?? '').trim();
    if (!title || title.length > 200) return err(new ValidationError('Название: 1–200 символов'));
    if (!Number.isInteger(input.trackNumber) || input.trackNumber < 1) {
      return err(new ValidationError('Неверный номер'));
    }
    if (input.bpm != null && (!Number.isInteger(input.bpm) || input.bpm < 20 || input.bpm > 500)) {
      return err(new ValidationError('BPM: 20–500'));
    }

    const version = input.version?.trim() ? input.version.trim().slice(0, 80) : null;
    await this.trackRepo.update(trackId, {
      title,
      version,
      trackNumber: input.trackNumber,
      isExplicit: input.isExplicit,
      isExclusive: input.isExclusive,
      isWip: input.isWip,
      bpm: input.bpm,
      musicalKey: input.musicalKey?.trim() ? input.musicalKey.trim().slice(0, 20) : null,
      credits: input.credits,
      lyrics: input.lyrics,
    });
    await this.moodsRepo().set(trackId, [...input.moods]);
    await this.moodsRepo().setGenres(trackId, [...input.genres]);
    return ok(undefined);
  }

  // сбрасываем статус в PROCESSING — иначе воркер по идемпотентности пропустит READY-трек
  async retranscode(trackId: string): Promise<Result<void, ValidationError>> {
    const sourceKey = await this.trackRepo.getSourceKey(trackId);
    if (!sourceKey) return err(new ValidationError('Нет исходника в vault — пересобрать нечем'));

    await this.trackRepo.setStatus(trackId, 'PROCESSING');
    await this.queue.add({ trackId, sourceKey });
    return ok(undefined);
  }

  // массовый пере-транскод — при системно битом HLS у артиста, чтобы не жать ⟳ по каждому треку
  async retranscodeArtist(artistProfileId: string): Promise<Result<{ queued: number }, ValidationError>> {
    const sources = await this.trackRepo.getArtistTrackSources(artistProfileId);
    if (sources.length === 0) return err(new ValidationError('Нет треков с исходником в vault'));

    for (const s of sources) {
      await this.trackRepo.setStatus(s.trackId, 'PROCESSING');
      await this.queue.add({ trackId: s.trackId, sourceKey: s.sourceKey });
    }
    return ok({ queued: sources.length });
  }

  private moodsRepo(): ITrackMoodsRepository {
    if (!this.deps.moodsRepo) throw new Error('TrackService: deps.moodsRepo is required for admin track updates');
    return this.deps.moodsRepo;
  }
}
