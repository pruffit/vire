import { listPlaylistsAdmin } from '@vire/db';
import { PlaylistAdminRow } from './playlist-admin-row';
import { PageHeader, Panel, EmptyState } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminPlaylistsPage() {
  const playlists = await listPlaylistsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Плейлисты" count={playlists.length} />

      {playlists.length === 0 ? (
        <Panel>
          <EmptyState
            title="Плейлистов пока нет"
            hint="Пользовательские и курируемые плейлисты появятся здесь."
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {playlists.map((p) => (
            <PlaylistAdminRow key={p.id} playlist={p} />
          ))}
        </div>
      )}
    </div>
  );
}
