import { eq, asc, and, or, lte, isNotNull, desc, sql } from 'drizzle-orm';
import { releases, tracks } from '../schema';
import type { DB } from '../client';
import type { CreateReleaseInput, IReleaseRepository, Release, ReleaseStatus, ReleaseWithTracks, Track } from '@vire/core';

export class DrizzleReleaseRepository implements IReleaseRepository {
  constructor(private readonly db: DB) {}

  async findById(releaseId: string): Promise<Release | null> {
    const [row] = await this.db
      .select()
      .from(releases)
      .where(eq(releases.id, releaseId))
      .limit(1);

    if (!row) return null;
    return mapToRelease(row);
  }

  async findAllByArtist(artistProfileId: string): Promise<ReleaseWithTracks[]> {
    const releaseRows = await this.db
      .select()
      .from(releases)
      .where(eq(releases.artistProfileId, artistProfileId))
      .orderBy(desc(releases.createdAt));

    const result: ReleaseWithTracks[] = [];
    for (const releaseRow of releaseRows) {
      const trackRows = await this.db
        .select()
        .from(tracks)
        .where(eq(tracks.releaseId, releaseRow.id))
        .orderBy(asc(tracks.trackNumber));

      result.push({
        release: mapToRelease(releaseRow),
        tracks: trackRows.map(mapToTrack),
      });
    }
    return result;
  }

  async findWithTracks(releaseId: string): Promise<ReleaseWithTracks | null> {
    const [releaseRow] = await this.db
      .select()
      .from(releases)
      .where(eq(releases.id, releaseId))
      .limit(1);

    if (!releaseRow) return null;

    const trackRows = await this.db
      .select()
      .from(tracks)
      .where(eq(tracks.releaseId, releaseId))
      .orderBy(asc(tracks.trackNumber));

    return {
      release: mapToRelease(releaseRow),
      tracks: trackRows.map(mapToTrack),
    };
  }

  async updateStatus(releaseId: string, status: ReleaseStatus): Promise<void> {
    await this.db
      .update(releases)
      .set({ status, updatedAt: new Date() })
      .where(eq(releases.id, releaseId));
  }

  async create(input: CreateReleaseInput): Promise<Release> {
    const [row] = await this.db
      .insert(releases)
      .values({
        id: input.id,
        artistProfileId: input.artistProfileId,
        title: input.title,
        type: input.type,
        releaseDate: input.releaseDate ?? null,
        coverUrl: input.coverUrl ?? null,
        description: input.description ?? null,
        status: 'DRAFT',
      })
      .returning();
    return mapToRelease(row!);
  }

  async findPublishedByArtist(artistProfileId: string): Promise<Release[]> {
    const rows = await this.db
      .select()
      .from(releases)
      .where(
        and(
          eq(releases.artistProfileId, artistProfileId),
          or(
            eq(releases.status, 'PUBLISHED'),
            and(
              eq(releases.status, 'SCHEDULED'),
              isNotNull(releases.releaseDate),
              lte(releases.releaseDate, sql`now()`),
            ),
          ),
        ),
      )
      .orderBy(asc(releases.releaseDate));

    return rows.map(mapToRelease);
  }
}

function mapToRelease(row: typeof releases.$inferSelect): Release {
  return {
    id: row.id,
    artistProfileId: row.artistProfileId,
    title: row.title,
    type: row.type,
    coverUrl: row.coverUrl,
    releaseDate: row.releaseDate,
    status: row.status,
    description: row.description,
    linerNotes: row.linerNotes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapToTrack(row: typeof tracks.$inferSelect): Track {
  return {
    id: row.id,
    releaseId: row.releaseId,
    title: row.title,
    trackNumber: row.trackNumber,
    durationSec: row.durationSec,
    status: row.status,
    isExclusive: row.isExclusive,
    isWip: row.isWip,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
