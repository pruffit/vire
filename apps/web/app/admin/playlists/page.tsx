import { listPlaylistsAdmin } from '@vire/db';
import { PlaylistAdminRow } from './playlist-admin-row';

export const dynamic = 'force-dynamic';

export default async function AdminPlaylistsPage() {
  const playlists = await listPlaylistsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Плейлисты</h1>
        <span className="text-sm text-white/40 tabular-nums">{playlists.length}</span>
      </div>

      <div className="flex flex-col gap-3">
        {playlists.map((p) => (
          <PlaylistAdminRow key={p.id} playlist={p} />
        ))}
        {playlists.length === 0 && <p className="text-center text-sm text-white/30 py-8">Плейлистов нет</p>}
      </div>
    </div>
  );
}
