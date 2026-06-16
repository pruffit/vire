import { eq } from 'drizzle-orm';
import {
  tracks,
  trackAudio,
  trackContributors,
  trackMoods,
  playlistTracks,
  likes,
  favoriteMoments,
} from '../schema';
import type { DB } from '../client';
import type {
  ITrackRepository,
  CreateTrackParams,
  UpdateTrackParams,
  Track,
  TrackCredit,
} from '@vire/core';

type TrackRow = typeof tracks.$inferSelect;

function mapRow(row: TrackRow): Track {
  return {
    id: row.id,
    releaseId: row.releaseId,
    title: row.title,
    trackNumber: row.trackNumber,
    durationSec: row.durationSec,
    status: row.status,
    isExclusive: row.isExclusive,
    isWip: row.isWip,
    isExplicit: row.isExplicit,
    credits: Array.isArray(row.credits) ? (row.credits as TrackCredit[]) : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleTrackRepository implements ITrackRepository {
  constructor(private readonly db: DB) {}

  async create(params: CreateTrackParams): Promise<Track> {
    const [row] = await this.db
      .insert(tracks)
      .values({
        id: params.id,
        releaseId: params.releaseId,
        title: params.title,
        trackNumber: params.trackNumber,
        credits: params.credits ?? [],
        status: 'PROCESSING',
      })
      .returning();

    return mapRow(row);
  }

  async findById(id: string): Promise<Track | null> {
    const [row] = await this.db.select().from(tracks).where(eq(tracks.id, id)).limit(1);
    return row ? mapRow(row) : null;
  }

  async update(id: string, patch: UpdateTrackParams): Promise<Track | null> {
    const trackValues: Partial<typeof tracks.$inferInsert> = {};
    if (patch.title !== undefined) trackValues.title = patch.title;
    if (patch.trackNumber !== undefined) trackValues.trackNumber = patch.trackNumber;
    if (patch.isExclusive !== undefined) trackValues.isExclusive = patch.isExclusive;
    if (patch.isWip !== undefined) trackValues.isWip = patch.isWip;
    if (patch.isExplicit !== undefined) trackValues.isExplicit = patch.isExplicit;
    if (patch.credits !== undefined) trackValues.credits = patch.credits;

    let row: typeof tracks.$inferSelect | undefined;
    if (Object.keys(trackValues).length > 0) {
      trackValues.updatedAt = new Date();
      [row] = await this.db.update(tracks).set(trackValues).where(eq(tracks.id, id)).returning();
    } else {
      [row] = await this.db.select().from(tracks).where(eq(tracks.id, id)).limit(1);
    }

    const hasAudioPatch = patch.bpm !== undefined || patch.musicalKey !== undefined;
    if (hasAudioPatch && row) {
      const audioSet: Partial<typeof trackAudio.$inferInsert> = { updatedAt: new Date() };
      if (patch.bpm !== undefined) audioSet.bpm = patch.bpm;
      if (patch.musicalKey !== undefined) audioSet.musicalKey = patch.musicalKey;
      await this.db
        .insert(trackAudio)
        .values({ trackId: id, ...audioSet })
        .onConflictDoUpdate({ target: trackAudio.trackId, set: audioSet });
    }

    return row ? mapRow(row) : null;
  }

  async delete(id: string): Promise<void> {
    // FK на tracks.id без ON DELETE CASCADE — чистим зависимые строки в одной
    // транзакции, затем сам трек. Покупки (purchases) полиморфны и без FK —
    // их намеренно не трогаем (купленное остаётся в истории).
    await this.db.transaction(async (tx) => {
      await tx.delete(trackAudio).where(eq(trackAudio.trackId, id));
      await tx.delete(trackContributors).where(eq(trackContributors.trackId, id));
      await tx.delete(trackMoods).where(eq(trackMoods.trackId, id));
      await tx.delete(playlistTracks).where(eq(playlistTracks.trackId, id));
      await tx.delete(likes).where(eq(likes.trackId, id));
      await tx.delete(favoriteMoments).where(eq(favoriteMoments.trackId, id));
      await tx.delete(tracks).where(eq(tracks.id, id));
    });
  }
}
