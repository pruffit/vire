import { err, ok, NotFoundError, ValidationError, type Result } from '../errors';
import type { IArtistPostRepository } from '../repositories/artist-post';
import type { ArtistPost } from '../types/artist-post';

const TITLE_MAX = 120;
const BODY_MAX = 2000;

export function normalizePostInput(payload: unknown): { title: string | null; body: string } {
  const obj = (payload ?? {}) as Record<string, unknown>;
  const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : null;
  const body = typeof obj.body === 'string' ? obj.body.trim() : '';
  return { title, body };
}

export class ArtistPostService {
  constructor(private readonly repo: IArtistPostRepository) {}

  async create(
    artistProfileId: string,
    payload: unknown,
  ): Promise<Result<{ post: ArtistPost }, ValidationError>> {
    const { title, body } = normalizePostInput(payload);
    if (!body) return err(new ValidationError('Body is required'));
    if (body.length > BODY_MAX || (title && title.length > TITLE_MAX)) {
      return err(new ValidationError('Too long'));
    }

    const post = await this.repo.create({ artistProfileId, title, body });
    return ok({ post });
  }

  async update(
    postId: string,
    artistProfileId: string,
    payload: unknown,
  ): Promise<Result<void, NotFoundError | ValidationError | Error>> {
    const post = await this.repo.findById(postId);
    if (!post) return err(new NotFoundError('ArtistPost', postId));
    if (post.artistProfileId !== artistProfileId) {
      return err(new Error('Forbidden: post does not belong to this artist'));
    }

    const { title, body } = normalizePostInput(payload);
    if (!body) return err(new ValidationError('Body is required'));
    if (body.length > BODY_MAX || (title && title.length > TITLE_MAX)) {
      return err(new ValidationError('Too long'));
    }

    await this.repo.update(postId, { title, body });
    return ok(undefined);
  }

  async delete(
    postId: string,
    artistProfileId: string,
  ): Promise<Result<void, NotFoundError | Error>> {
    const post = await this.repo.findById(postId);
    if (!post) return err(new NotFoundError('ArtistPost', postId));
    if (post.artistProfileId !== artistProfileId) {
      return err(new Error('Forbidden: post does not belong to this artist'));
    }

    await this.repo.delete(postId);
    return ok(undefined);
  }
}
