import { eq } from 'drizzle-orm';
import { db } from '../client';
import { tracks, releases } from '../schema';
import type { LyricLine } from '@vire/core';

/**
 * Текст трека для публичного просмотра в плеере. Отдаём только если релиз
 * опубликован (черновики не светим). null — нет текста / трек не публичный.
 */
export async function getPublicTrackLyrics(trackId: string): Promise<LyricLine[] | null> {
  const [row] = await db
    .select({ lyrics: tracks.lyrics, status: releases.status })
    .from(tracks)
    .innerJoin(releases, eq(tracks.releaseId, releases.id))
    .where(eq(tracks.id, trackId))
    .limit(1);

  if (!row || row.status !== 'PUBLISHED') return null;
  return Array.isArray(row.lyrics) ? (row.lyrics as LyricLine[]) : null;
}
