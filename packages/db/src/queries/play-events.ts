import { db } from '../client';
import { playEvents } from '../schema';

export interface InsertPlayEventData {
  trackId: string;
  sessionId: string;
  userId: string | null;
  source: string;
  durationPlayedSec: number;
  startedAt: Date;
}

export async function insertPlayEvent(data: InsertPlayEventData): Promise<void> {
  await db.insert(playEvents).values({
    trackId: data.trackId,
    sessionId: data.sessionId,
    userId: data.userId ?? undefined,
    source: data.source,
    durationPlayedSec: data.durationPlayedSec,
    startedAt: data.startedAt,
  });
}
