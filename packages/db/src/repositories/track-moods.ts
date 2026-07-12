import type { DB } from '../client';
import type { ITrackMoodsRepository } from '@vire/core';
import { getTrackMoods, setTrackMoods, type Mood } from '../queries/track-moods';

export class DrizzleTrackMoodsRepository implements ITrackMoodsRepository {
  constructor(private readonly db: DB) {}

  get(trackId: string): Promise<string[]> {
    return getTrackMoods(trackId);
  }

  // Валидация enum-принадлежности — выше по стеку (zod в роуте); здесь только сужение типа.
  set(trackId: string, moods: string[]): Promise<void> {
    return setTrackMoods(trackId, moods as Mood[]);
  }
}
