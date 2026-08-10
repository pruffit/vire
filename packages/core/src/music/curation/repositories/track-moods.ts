// Строки, не Mood: источник правды для Mood — enum в @vire/db, а core не импортирует db.
// Drizzle-реализация сужает до Mood[] у себя.
export interface ITrackMoodsRepository {
  get(trackId: string): Promise<string[]>;
  set(trackId: string, moods: string[]): Promise<void>;
  setGenres(trackId: string, genres: string[]): Promise<void>;
}
