/** Read-порт для экрана плейлиста — то, чего нет в IPlaylistRepository. */
export interface IPlaylistPageRepository {
  likeState(userId: string, playlistId: string): Promise<boolean>;
  userName(userId: string): Promise<string | null>;
}
