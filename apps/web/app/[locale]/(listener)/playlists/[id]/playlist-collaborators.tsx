import { getTranslations } from 'next-intl/server';
import type { PlaylistCollaborator } from '@vire/core';
import { ChatAvatar } from '@/components/chat/chat-avatar';
import { Icon } from '@/components/icon';

const MAX_AVATARS = 4;

export async function PlaylistCollabBadge() {
  const t = await getTranslations('playlist');
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 label-mono text-[10px] text-muted-foreground">
      <Icon name="users" size={11} /> {t('collabBadge')}
    </span>
  );
}

export async function PlaylistCollaboratorsStack({ collaborators }: { collaborators: PlaylistCollaborator[] }) {
  if (collaborators.length === 0) return null;
  const t = await getTranslations('playlist');
  const shown = collaborators.slice(0, MAX_AVATARS);
  const extra = collaborators.length - shown.length;

  return (
    <div className="flex items-center -space-x-2" title={collaborators.map((c) => c.name ?? t('defaultListenerName')).join(', ')}>
      {shown.map((c) => (
        <div key={c.userId} className="rounded-full ring-2 ring-background">
          <ChatAvatar name={c.name} image={c.image} size={24} />
        </div>
      ))}
      {extra > 0 && (
        <div className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-[10px] font-medium text-muted-foreground ring-2 ring-background">
          +{extra}
        </div>
      )}
    </div>
  );
}
