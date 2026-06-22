import { listArtistsAdmin } from '@vire/db';
import { VerifyButton } from '../users/verify-button';
import { ActiveToggle } from './active-toggle';
import { MembersManager } from './members-manager';
import { RetranscodeArtistButton } from './retranscode-artist-button';
import {
  PageHeader, SearchForm, Table, Thead, Th, Tr, Td, ActionLink, EmptyState,
} from '@/components/admin/ui';

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AdminArtistsPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const artists = await listArtistsAdmin({ search: q });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Артисты" count={artists.length} />

      <SearchForm defaultValue={q} placeholder="Поиск по имени или слагу…" />

      <Table minWidth="min-w-[720px]">
        <Thead>
          <Th>Артист</Th>
          <Th align="right">Фолловеры</Th>
          <Th align="right">Релизы</Th>
          <Th align="right">Треки</Th>
          <Th align="right">Прослуш. 30д</Th>
          <Th>Создан</Th>
          <Th />
        </Thead>
        <tbody>
          {artists.map((a) => (
            <Tr key={a.id}>
              <Td>
                <div className="flex items-center gap-2.5">
                  <a
                    href={`/artists/${a.slug}`}
                    target="_blank"
                    className="text-foreground/85 hover:text-foreground transition-colors"
                  >
                    {a.name}
                  </a>
                  <span className="font-mono text-xs text-foreground/30">@{a.slug}</span>
                </div>
              </Td>
              <Td align="right" tone="soft" nums>{a.followerCount}</Td>
              <Td align="right" tone="soft" nums>{a.releaseCount}</Td>
              <Td align="right" tone="soft" nums>{a.trackCount}</Td>
              <Td align="right" tone="soft" nums>{a.plays30d}</Td>
              <Td mono tone="faint">
                {new Date(a.createdAt).toLocaleDateString('ru-RU')}
              </Td>
              <Td>
                <div className="flex items-center justify-end gap-2">
                  <ActionLink href={`/admin/artists/${a.id}/edit`}>Изм.</ActionLink>
                  <RetranscodeArtistButton artistProfileId={a.id} />
                  <MembersManager artistProfileId={a.id} />
                  <VerifyButton artistProfileId={a.id} verified={a.verified} />
                  <ActiveToggle artistProfileId={a.id} isActive={a.isActive} />
                </div>
              </Td>
            </Tr>
          ))}
          {artists.length === 0 && (
            <tr>
              <td colSpan={7}>
                <EmptyState
                  title={q ? 'Артистов не нашли' : 'Артистов пока нет'}
                  hint={q ? 'Попробуй другое имя или слаг.' : undefined}
                />
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
