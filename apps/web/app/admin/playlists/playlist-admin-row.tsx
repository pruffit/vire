'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actionAdminUpdatePlaylist, actionAdminDeletePlaylist } from '../actions';
import { Tr, Td, Badge } from '@/components/admin/ui';
import { Select } from '@/components/select';
import { Icon } from '@/components/icon';
import { toast } from '@/lib/toast';

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'приватный' },
  { value: 'PUBLIC', label: 'публичный' },
];

interface Playlist {
  id: string;
  title: string;
  visibility: 'PRIVATE' | 'PUBLIC';
  kind: string;
  isCurated: boolean;
  ownerEmail: string | null;
  trackCount: number;
  likesCount: number;
  createdAt: string | Date;
}

export function PlaylistAdminRow({ playlist }: { playlist: Playlist }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(playlist.title);
  const [visibility, setVisibility] = useState(playlist.visibility);

  // заголовок редакционных подборок генерируется воркером и локализуется на рендере —
  // ручная правка была бы затёрта следующим прогоном и не видна слушателю
  const generatedTitle = playlist.isCurated && playlist.kind !== 'USER';
  const dirty = (!generatedTitle && title.trim() !== playlist.title) || visibility !== playlist.visibility;

  function save() {
    if (!dirty || !title.trim()) return;
    start(async () => {
      const res = await actionAdminUpdatePlaylist(playlist.id, { title: title.trim(), visibility });
      if (res.error) toast.error(res.error);
      else {
        toast('Сохранено');
        router.refresh();
      }
    });
  }

  function del() {
    if (!window.confirm(`Удалить плейлист «${playlist.title}»? Треки в нём отвяжутся.`)) return;
    start(async () => {
      await actionAdminDeletePlaylist(playlist.id);
      router.refresh();
    });
  }

  return (
    <Tr>
      <Td className="w-full">
        {generatedTitle ? (
          <span className="block px-2 py-1 text-sm text-foreground/70" title="Заголовок генерируется и переводится автоматически">
            {playlist.title}
          </span>
        ) : (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            maxLength={200}
            aria-label="Название плейлиста"
            className="w-full min-w-[180px] rounded-md border border-transparent bg-transparent px-2 py-1 text-sm transition-colors hover:bg-foreground/5 focus:bg-foreground/5 focus:border-foreground/15 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        )}
      </Td>
      <Td label="Тип">
        <Badge tone={playlist.kind === 'USER' ? 'neutral' : 'info'}>
          {playlist.kind}
        </Badge>
      </Td>
      <Td label="Видимость">
        <Select
          options={VISIBILITY_OPTIONS}
          value={visibility}
          onValueChange={(v) => setVisibility(v as 'PRIVATE' | 'PUBLIC')}
          aria-label="Видимость"
          className="w-32"
        />
      </Td>
      <Td label="Треки" align="right" nums mono tone="soft">{playlist.trackCount}</Td>
      <Td label="Лайки" align="right" nums mono tone="soft">{playlist.likesCount}</Td>
      <Td label="Владелец">
        {playlist.ownerEmail ? (
          <span
            className="block max-w-44 truncate font-mono text-xs text-foreground/55"
            title={playlist.ownerEmail}
          >
            {playlist.ownerEmail}
          </span>
        ) : (
          <span className="font-mono text-xs text-foreground/30">система</span>
        )}
      </Td>
      <Td label="Создан" mono tone="faint" nowrap>
        {new Date(playlist.createdAt).toLocaleDateString('ru-RU')}
      </Td>
      <Td align="right">
        <div className="flex items-center justify-end gap-1.5">
          {dirty && (
            <button
              onClick={save}
              disabled={pending || !title.trim()}
              className="pointer-coarse:min-w-11 pointer-coarse:min-h-11 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 active:scale-[0.98]"
            >
              <Icon name="check" size={13} />
              {pending ? 'Сохраняю…' : 'Сохранить'}
            </button>
          )}
          <a
            href={`/playlists/${playlist.id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Открыть плейлист"
            className="pointer-coarse:min-w-11 pointer-coarse:min-h-11 inline-flex items-center justify-center rounded-md p-1.5 text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground active:scale-[0.98]"
          >
            <Icon name="external-link" size={15} />
          </a>
          <button
            onClick={del}
            disabled={pending}
            aria-label="Удалить плейлист"
            className="pointer-coarse:min-w-11 pointer-coarse:min-h-11 inline-flex items-center justify-center rounded-md p-1.5 text-foreground/40 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40 active:scale-[0.98]"
          >
            <Icon name="trash-2" size={15} />
          </button>
        </div>
      </Td>
    </Tr>
  );
}
