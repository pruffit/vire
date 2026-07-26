import { listPlaylistsAdmin } from '@vire/db';
import { PlaylistAdminRow } from './playlist-admin-row';
import { PageHeader, Table, Thead, Th, Tr, Td, EmptyState } from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

export default async function AdminPlaylistsPage() {
  const playlists = await listPlaylistsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Плейлисты" count={playlists.length} />

      <Table minWidth="md:min-w-[900px]">
        <Thead>
          <Th className="w-full">Название</Th>
          <Th>Тип</Th>
          <Th>Видимость</Th>
          <Th align="right">Треки</Th>
          <Th align="right">Лайки</Th>
          <Th>Владелец</Th>
          <Th>Создан</Th>
          <Th align="right">Действия</Th>
        </Thead>
        <tbody>
          {playlists.map((p) => (
            <PlaylistAdminRow key={p.id} playlist={p} />
          ))}
          {playlists.length === 0 && (
            <Tr>
              <Td colSpan={8}>
                <EmptyState
                  title="Плейлистов пока нет"
                  hint="Пользовательские и курируемые плейлисты появятся здесь."
                />
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
