import { err, ok, NotFoundError, ValidationError, ConflictError, type Result } from '../../../errors';
import type { ISmartLinkRepository } from '../repositories/smart-link';
import type { IFileUploader } from '../../../platform/storage/repositories/storage';
import type { IdGenerator } from '../../../platform/ports/effects';
import type { ArtistLink, SmartLinkInput } from '../../catalog/types/artist';

export const MAX_SMART_LINKS = 20; // ссылок на площадки в одном лендинге
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Приводит строку к slug: латиница/цифры/дефис, нижний регистр. */
export function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 1 && slug.length <= 60 && SLUG_RE.test(slug);
}

/** Парсит массив ссылок из JSON-строки формы: валидный http(s)-URL, обрезанные подписи, ограничение количества. */
export function parseSmartLinkLinks(raw: unknown, max = MAX_SMART_LINKS): ArtistLink[] {
  if (typeof raw !== 'string') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: ArtistLink[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const url = (item as { url?: unknown }).url;
    const label = (item as { label?: unknown }).label;
    if (typeof url !== 'string' || !isHttpUrl(url)) continue;
    const link: ArtistLink = { url: url.trim() };
    if (typeof label === 'string' && label.trim()) link.label = label.trim().slice(0, 60);
    out.push(link);
    if (out.length >= max) break;
  }
  return out;
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface SmartLinkFileInput {
  buffer: Uint8Array;
  ext: string;
  mime: string;
}

export interface SmartLinkServiceDeps {
  uuid: IdGenerator;
  coverStorage?: IFileUploader;
}

export interface CreateSmartLinkInput {
  title: unknown;
  slugRaw: unknown;
  subtitle: unknown;
  releaseDateRaw: unknown;
  releaseIdRaw: unknown;
  linksRaw: unknown;
  isPublished: boolean;
  cover: SmartLinkFileInput | null;
}

export interface UpdateSmartLinkInput {
  title: unknown;
  slugRaw: unknown;
  subtitle: unknown;
  releaseDateRaw: unknown;
  releaseIdRaw: unknown;
  linksPresent: boolean;
  linksRaw: unknown;
  isPublishedRaw: unknown;
  cover: SmartLinkFileInput | null;
  removeCover: boolean;
}

export class SmartLinkService {
  constructor(
    private readonly repo: ISmartLinkRepository,
    private readonly deps: SmartLinkServiceDeps,
  ) {}

  async create(
    artistProfileId: string,
    input: CreateSmartLinkInput,
  ): Promise<Result<{ id: string; slug: string }, ValidationError | ConflictError>> {
    if (typeof input.title !== 'string' || !input.title.trim()) {
      return err(new ValidationError('Нужно название', 'smartLink.titleRequired'));
    }

    const slug = normalizeSlug(typeof input.slugRaw === 'string' && input.slugRaw ? input.slugRaw : input.title);
    if (!isValidSlug(slug)) {
      return err(new ValidationError('Некорректный адрес (slug)', 'smartLink.invalidSlug'));
    }
    if (await this.repo.slugTaken(artistProfileId, slug)) {
      return err(new ConflictError('Такой адрес уже занят', undefined, 'smartLink.slugTaken'));
    }

    const links = parseSmartLinkLinks(input.linksRaw);
    const releaseDate =
      typeof input.releaseDateRaw === 'string' && input.releaseDateRaw ? new Date(input.releaseDateRaw) : null;

    let releaseId: string | null = null;
    if (typeof input.releaseIdRaw === 'string' && input.releaseIdRaw.trim()) {
      const owned = await this.repo.releaseOwnedByArtist(artistProfileId, input.releaseIdRaw);
      if (!owned) return err(new ValidationError('Релиз не найден', 'smartLink.releaseNotFound'));
      releaseId = input.releaseIdRaw;
    }

    const coverUrl = await this.uploadCover(input.cover);

    const id = await this.repo.create(artistProfileId, {
      slug,
      title: input.title.trim(),
      subtitle: typeof input.subtitle === 'string' && input.subtitle.trim() ? input.subtitle.trim() : null,
      coverUrl,
      releaseDate,
      releaseId,
      links,
      isPublished: input.isPublished,
    });

    return ok({ id, slug });
  }

  async update(
    id: string,
    artistProfileId: string,
    input: UpdateSmartLinkInput,
  ): Promise<Result<void, NotFoundError | ValidationError | ConflictError>> {
    const existing = await this.repo.findById(id);
    if (!existing || existing.artistProfileId !== artistProfileId) {
      return err(new NotFoundError('SmartLink', id, 'smartLink.notFound'));
    }

    const patch: Partial<SmartLinkInput> = {};

    if (typeof input.title === 'string') {
      if (!input.title.trim()) return err(new ValidationError('Нужно название', 'smartLink.titleRequired'));
      patch.title = input.title.trim();
    }

    if (typeof input.slugRaw === 'string') {
      const slug = normalizeSlug(input.slugRaw);
      if (!isValidSlug(slug)) return err(new ValidationError('Некорректный адрес (slug)', 'smartLink.invalidSlug'));
      if (slug !== existing.slug && (await this.repo.slugTaken(artistProfileId, slug, id))) {
        return err(new ConflictError('Такой адрес уже занят', undefined, 'smartLink.slugTaken'));
      }
      patch.slug = slug;
    }

    if (typeof input.subtitle === 'string') patch.subtitle = input.subtitle.trim() || null;

    if (typeof input.releaseDateRaw === 'string') {
      patch.releaseDate = input.releaseDateRaw ? new Date(input.releaseDateRaw) : null;
    }

    if (typeof input.releaseIdRaw === 'string') {
      if (!input.releaseIdRaw.trim()) {
        patch.releaseId = null;
      } else {
        const owned = await this.repo.releaseOwnedByArtist(artistProfileId, input.releaseIdRaw);
        if (!owned) return err(new ValidationError('Релиз не найден', 'smartLink.releaseNotFound'));
        patch.releaseId = input.releaseIdRaw;
      }
    }

    if (input.linksPresent) patch.links = parseSmartLinkLinks(input.linksRaw);

    if (typeof input.isPublishedRaw === 'string') patch.isPublished = input.isPublishedRaw === '1';

    if (input.cover) {
      patch.coverUrl = await this.uploadCover(input.cover);
    } else if (input.removeCover) {
      patch.coverUrl = null;
    }

    await this.repo.update(id, artistProfileId, patch);
    return ok(undefined);
  }

  async delete(id: string, artistProfileId: string): Promise<Result<void, NotFoundError>> {
    const deleted = await this.repo.delete(id, artistProfileId);
    if (!deleted) return err(new NotFoundError('SmartLink', id, 'smartLink.notFound'));
    return ok(undefined);
  }

  private async uploadCover(cover: SmartLinkFileInput | null): Promise<string | null> {
    if (!cover) return null;
    if (!this.deps.coverStorage) throw new Error('SmartLinkService: deps.coverStorage is required to upload a cover');
    const id = this.deps.uuid();
    return this.deps.coverStorage.upload(`covers/smartlinks/${id}.${cover.ext}`, cover.buffer, cover.mime);
  }
}
