import { err, ok, NotFoundError, ValidationError, type Result } from '../errors';
import type { IReleaseRepository } from '../repositories/release';
import type { IFileStorage } from '../repositories/storage';
import type { NotifyReleaseJobData } from '../jobs';
import { ALL_GENRES, type Genre, type Release, type ReleaseStatus, type ReleaseType, type ReleaseWithTracks } from '../types/release';

const RELEASE_TYPES: ReleaseType[] = ['ALBUM', 'EP', 'SINGLE'];

export interface INotifyReleaseQueue {
  add(data: NotifyReleaseJobData): Promise<void>;
}

export interface ReleaseServiceDeps {
  coverStorage?: IFileStorage;
  notifyQueue?: INotifyReleaseQueue;
  uuid?: () => string;
}

export interface ReleaseCoverInput {
  buffer: Uint8Array;
  ext: string;
  mime: string;
}

export class ReleaseService {
  constructor(
    private readonly repo: IReleaseRepository,
    private readonly deps: ReleaseServiceDeps = {},
  ) {}

  async getWithTracks(releaseId: string): Promise<Result<ReleaseWithTracks, NotFoundError>> {
    const result = await this.repo.findWithTracks(releaseId);
    if (!result) return err(new NotFoundError('Release', releaseId));
    return ok(result);
  }

  async getPublishedByArtist(artistProfileId: string): Promise<Release[]> {
    return this.repo.findPublishedByArtist(artistProfileId);
  }

  async create(
    artistProfileId: string,
    params: {
      title: string;
      type: ReleaseType;
      genre: Genre | null;
      releaseDate: Date | null;
      description: string | null;
      cover?: ReleaseCoverInput;
    },
  ): Promise<Result<{ releaseId: string }, Error>> {
    const releaseId = this.deps.uuid ? this.deps.uuid() : crypto.randomUUID();
    const coverUrl = await this.uploadCover(releaseId, params.cover);

    const release = await this.repo.create({
      id: releaseId,
      artistProfileId,
      title: params.title.trim(),
      type: params.type,
      genre: params.genre,
      releaseDate: params.releaseDate,
      coverUrl,
      description: params.description && params.description.trim() ? params.description.trim() : null,
    });

    return ok({ releaseId: release.id });
  }

  async update(
    releaseId: string,
    artistProfileId: string,
    params: {
      title: string;
      type: ReleaseType;
      genre: Genre | null;
      releaseDate: Date | null;
      description: string | null;
      linerNotes: string | null;
      cover?: ReleaseCoverInput;
    },
  ): Promise<Result<{ releaseId: string }, NotFoundError | Error>> {
    const release = await this.repo.findById(releaseId);
    if (!release) return err(new NotFoundError('Release', releaseId));
    if (release.artistProfileId !== artistProfileId) {
      return err(new Error('Forbidden: release does not belong to this artist'));
    }

    const coverUrl = params.cover ? await this.uploadCover(releaseId, params.cover) : release.coverUrl;

    const updated = await this.repo.update(releaseId, {
      title: params.title.trim(),
      type: params.type,
      genre: params.genre,
      releaseDate: params.releaseDate,
      coverUrl,
      description: params.description && params.description.trim() ? params.description.trim() : null,
      linerNotes: params.linerNotes && params.linerNotes.trim() ? params.linerNotes.trim() : null,
    });

    return ok({ releaseId: updated.id });
  }

  async changeStatus(
    releaseId: string,
    artistProfileId: string,
    status: ReleaseStatus,
    artist: { name: string; slug: string },
  ): Promise<Result<{ status: ReleaseStatus }, NotFoundError | Error>> {
    const release = await this.repo.findById(releaseId);
    if (!release) return err(new NotFoundError('Release', releaseId));
    if (release.artistProfileId !== artistProfileId) {
      return err(new Error('Forbidden: release does not belong to this artist'));
    }

    const wasPublished = release.status !== 'PUBLISHED' && status === 'PUBLISHED';
    await this.repo.updateStatus(releaseId, status);

    if (wasPublished) {
      if (!this.deps.notifyQueue) throw new Error('ReleaseService: deps.notifyQueue is required to notify on publish');
      await this.deps.notifyQueue.add({
        releaseId: release.id,
        releaseTitle: release.title,
        releaseType: release.type,
        coverUrl: release.coverUrl ?? null,
        artistProfileId,
        artistName: artist.name,
        artistSlug: artist.slug,
      });
    }

    return ok({ status });
  }

  async deleteRelease(params: {
    releaseId: string;
    artistProfileId: string;
  }): Promise<Result<void, NotFoundError | Error>> {
    const release = await this.repo.findById(params.releaseId);
    if (!release) return err(new NotFoundError('Release', params.releaseId));
    if (release.artistProfileId !== params.artistProfileId) {
      return err(new Error('Forbidden: release does not belong to this artist'));
    }
    await this.repo.delete(params.releaseId);
    return ok(undefined);
  }

  async adminUpdate(
    releaseId: string,
    input: {
      title: string;
      type: string;
      genre: string | null;
      releaseDate: string | null;
      description: string | null;
      linerNotes: string | null;
    },
  ): Promise<Result<void, ValidationError>> {
    const title = (input.title ?? '').trim();
    if (!title || title.length > 200) return err(new ValidationError('Название: 1–200 символов'));
    if (!RELEASE_TYPES.includes(input.type as ReleaseType)) return err(new ValidationError('Неверный тип'));
    if (input.genre != null && !(ALL_GENRES as readonly string[]).includes(input.genre)) {
      return err(new ValidationError('Неверный жанр'));
    }

    let releaseDate: Date | null = null;
    if (input.releaseDate) {
      const d = new Date(input.releaseDate);
      if (isNaN(d.getTime())) return err(new ValidationError('Неверная дата'));
      releaseDate = d;
    }

    await this.repo.update(releaseId, {
      title,
      type: input.type as ReleaseType,
      genre: input.genre as Genre | null,
      releaseDate,
      description: input.description?.trim() ? input.description.trim().slice(0, 5000) : null,
      linerNotes: input.linerNotes?.trim() ? input.linerNotes.trim().slice(0, 10000) : null,
    });
    return ok(undefined);
  }

  private async uploadCover(releaseId: string, cover: ReleaseCoverInput | undefined): Promise<string | null> {
    if (!cover) return null;
    if (!this.deps.coverStorage) throw new Error('ReleaseService: deps.coverStorage is required to upload a cover');
    return this.deps.coverStorage.upload(`covers/${releaseId}.${cover.ext}`, cover.buffer, cover.mime);
  }
}
