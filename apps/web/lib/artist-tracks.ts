/**
 * Треки артиста по убыванию прослушиваний. Стабильна: при равных plays
 * сохраняется исходный порядок (порядок каталога из getArtistPlayableTracks),
 * поэтому у нового артиста с нулями «Популярное» = каталог. Вход не мутируется.
 */
export function topByPlays<T extends { plays: number }>(tracks: T[], limit?: number): T[] {
  const sorted = tracks
    .map((track, i) => ({ track, i }))
    .sort((a, b) => b.track.plays - a.track.plays || a.i - b.i)
    .map((x) => x.track);
  return limit == null ? sorted : sorted.slice(0, limit);
}
