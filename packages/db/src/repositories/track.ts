import { tracks } from '../schema';
import type { DB } from '../client';
import type { ITrackRepository, CreateTrackParams, Track, TrackCredit } from '@vire/core';

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

    return {
      id: row.id,
      releaseId: row.releaseId,
      title: row.title,
      trackNumber: row.trackNumber,
      durationSec: row.durationSec,
      status: row.status,
      isExclusive: row.isExclusive,
      isWip: row.isWip,
      credits: Array.isArray(row.credits) ? (row.credits as TrackCredit[]) : [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
