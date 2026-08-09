import { err, ok, NotFoundError, ValidationError, ConflictError, type Result } from '../errors';
import type { IArtistRepository } from '../repositories/artist';
import type { IFileStorage } from '../repositories/storage';
import type { Clock } from '../ports/effects';
import type { ArtistProfile, ArtistLink, ArtistVideo, ThemeTokens } from '../types/artist';

export interface IVideoTitleResolver {
  resolve(url: string): Promise<string>;
}

export interface ArtistServiceDeps {
  now: Clock;
  fonts?: { sans: readonly string[]; mono: readonly string[] };
  videoTitleResolver?: IVideoTitleResolver;
  imageStorage?: IFileStorage;
}

export interface ArtistImageInput {
  buffer: Uint8Array;
  ext: string;
  mime: string;
}

export interface UpdateArtistProfileInput {
  name: unknown;
  bio: unknown;
  avatar: ArtistImageInput | null;
  removeAvatar: boolean;
  header: ArtistImageInput | null;
  removeHeader: boolean;
  linksRaw: unknown;
  videosRaw: unknown;
  bg: unknown;
  text: unknown;
  accent: unknown;
  grain: boolean;
  fontSans: unknown;
  fontMono: unknown;
}

export class ArtistService {
  constructor(
    private readonly repo: IArtistRepository,
    private readonly deps: ArtistServiceDeps,
  ) {}

  async getBySlug(slug: string): Promise<Result<ArtistProfile, NotFoundError>> {
    const artist = await this.repo.findBySlug(slug);
    if (!artist) return err(new NotFoundError('ArtistProfile', slug, 'artist.notFound'));
    return ok(artist);
  }

  async updateProfile(
    artist: ArtistProfile,
    input: UpdateArtistProfileInput,
  ): Promise<Result<{ ok: true }, ValidationError>> {
    if (typeof input.name !== 'string' || !input.name.trim()) {
      return err(new ValidationError('Name is required', 'artist.nameRequired'));
    }

    const links = this.parseLinks(input.linksRaw, artist.links);
    const videos = await this.parseVideos(input.videosRaw, artist.videos);

    let avatarUrl = artist.avatarUrl;
    if (input.removeAvatar) {
      avatarUrl = null;
    } else if (input.avatar) {
      avatarUrl = this.bust(await this.uploadImage(`avatars/${artist.id}.${input.avatar.ext}`, input.avatar));
    }

    let headerUrl = artist.headerUrl;
    if (input.removeHeader) {
      headerUrl = null;
    } else if (input.header) {
      headerUrl = this.bust(await this.uploadImage(`headers/${artist.id}.${input.header.ext}`, input.header));
    }

    const themeTokens: ThemeTokens = {
      bg: isHex(input.bg) ? input.bg : artist.themeTokens.bg,
      text: isHex(input.text) ? input.text : artist.themeTokens.text,
      accent: isHex(input.accent) ? input.accent : artist.themeTokens.accent,
      grain: input.grain,
      fontSans: this.resolveFont(input.fontSans, this.deps.fonts?.sans, artist.themeTokens.fontSans),
      fontMono: this.resolveFont(input.fontMono, this.deps.fonts?.mono, artist.themeTokens.fontMono),
    };

    await this.repo.update(artist.id, {
      name: input.name.trim(),
      bio: typeof input.bio === 'string' && input.bio.trim() ? input.bio.trim() : null,
      avatarUrl,
      headerUrl,
      themeTokens,
      links,
      videos,
    });

    return ok({ ok: true });
  }

  async adminUpdate(
    artistProfileId: string,
    input: {
      name: string;
      slug: string;
      bio: string | null;
      avatarUrl: string | null;
      theme?: { bg: string; text: string; accent: string; grain: boolean; fontSans: string; fontMono: string };
    },
  ): Promise<Result<void, ValidationError | ConflictError>> {
    const name = (input.name ?? '').trim();
    if (!name || name.length > 120) return err(new ValidationError('Имя: 1–120 символов'));
    const slug = (input.slug ?? '').trim().toLowerCase();
    if (!/^[a-z0-9-]{2,60}$/.test(slug)) {
      return err(new ValidationError('Slug: 2–60 символов, латиница/цифры/дефис'));
    }

    let themeTokens: ThemeTokens | undefined;
    if (input.theme) {
      if (!isHex(input.theme.bg) || !isHex(input.theme.text) || !isHex(input.theme.accent)) {
        return err(new ValidationError('Тема: цвет должен быть в формате #rrggbb'));
      }
      if (this.deps.fonts && !this.deps.fonts.sans.includes(input.theme.fontSans)) {
        return err(new ValidationError('Тема: неизвестный основной шрифт'));
      }
      if (this.deps.fonts && !this.deps.fonts.mono.includes(input.theme.fontMono)) {
        return err(new ValidationError('Тема: неизвестный моно-шрифт'));
      }
      themeTokens = {
        bg: input.theme.bg,
        text: input.theme.text,
        accent: input.theme.accent,
        grain: input.theme.grain,
        fontSans: input.theme.fontSans,
        fontMono: input.theme.fontMono,
      };
    }

    const res = await this.repo.adminUpdate(artistProfileId, {
      name,
      slug,
      bio: input.bio?.trim() ? input.bio.trim().slice(0, 2000) : null,
      avatarUrl: input.avatarUrl?.trim() || null,
      ...(themeTokens ? { themeTokens } : {}),
    });
    if (!res.ok) return err(new ConflictError(res.error));
    return ok(undefined);
  }

  private async uploadImage(key: string, file: ArtistImageInput): Promise<string> {
    if (!this.deps.imageStorage) throw new Error('ArtistService: deps.imageStorage is required to upload images');
    return this.deps.imageStorage.upload(key, file.buffer, file.mime);
  }

  // ключ S3 стабильный — без ?v=timestamp браузер/CDN отдают старое закэшированное фото
  private bust(url: string): string {
    return `${url}?v=${this.deps.now()}`;
  }

  private resolveFont(raw: unknown, catalog: readonly string[] | undefined, fallback: string): string {
    if (typeof raw !== 'string') return fallback;
    if (!catalog) throw new Error('ArtistService: deps.fonts is required to validate a font selection');
    return catalog.includes(raw) ? raw : fallback;
  }

  private parseLinks(raw: unknown, fallback: ArtistLink[]): ArtistLink[] {
    if (typeof raw !== 'string') return fallback;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return fallback;
      return parsed
        .filter((l): l is { url: string; label?: unknown } =>
          l !== null && typeof l === 'object' && typeof (l as { url?: unknown }).url === 'string',
        )
        .map((l) => {
          const label = typeof l.label === 'string' ? l.label.trim() : '';
          return label ? { url: l.url, label } : { url: l.url };
        })
        .filter((l) => l.url.trim())
        .slice(0, 10);
    } catch {
      return fallback;
    }
  }

  // JSON.parse изолирован в try/catch (keep-existing при битом JSON); резолв тайтла — вне
  // catch, чтобы ошибка отсутствующей DI (videoTitleResolver) не глушилась молча.
  private async parseVideos(raw: unknown, fallback: ArtistVideo[]): Promise<ArtistVideo[]> {
    if (typeof raw !== 'string') return fallback;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return fallback;
    }
    if (!Array.isArray(parsed)) return fallback;

    const cleaned = parsed
      .filter((v): v is { url: string; title?: unknown } =>
        v !== null && typeof v === 'object' && typeof (v as { url?: unknown }).url === 'string',
      )
      .map((v) => ({ url: v.url.trim(), title: typeof v.title === 'string' ? v.title.trim() : '' }))
      .filter((v) => v.url)
      .slice(0, 20);

    return Promise.all(
      cleaned.map(async (v) => {
        if (v.title) return v;
        if (!this.deps.videoTitleResolver) {
          throw new Error('ArtistService: deps.videoTitleResolver is required to resolve video titles');
        }
        return { url: v.url, title: await this.deps.videoTitleResolver.resolve(v.url) };
      }),
    );
  }
}

function isHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}
