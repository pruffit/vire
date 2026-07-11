/** Треки по убыванию прослушиваний; стабильна при равных plays (сохраняет порядок каталога) — у артиста без прослушиваний «Популярное» = каталог. */
export function topByPlays<T extends { plays: number }>(tracks: T[], limit?: number): T[] {
  const sorted = tracks
    .map((track, i) => ({ track, i }))
    .sort((a, b) => b.track.plays - a.track.plays || a.i - b.i)
    .map((x) => x.track);
  return limit == null ? sorted : sorted.slice(0, limit);
}
