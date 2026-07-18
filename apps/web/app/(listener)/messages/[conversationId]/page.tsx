import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { getUserPublicProfile } from '@vire/db';
import { chatService } from '@/lib/chat';
import { friendshipService } from '@/lib/friends';
import { blockService } from '@/lib/blocks';
import { Icon } from '@/components/icon';
import { ChatAvatar } from '@/components/chat/chat-avatar';
import { ChatThread } from '@/components/chat/chat-thread';

export const metadata: Metadata = { title: 'Диалог', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ conversationId: string }> };

export default async function ConversationPage({ params }: Props) {
  const { conversationId } = await params;
  const session = await auth();
  const viewerId = session?.user?.id;
  if (!viewerId) redirect(`/sign-in?callbackUrl=/messages/${conversationId}`);

  const meta = await chatService().getConversationMeta(viewerId, conversationId);
  if (!meta.ok) notFound();
  const { otherUserId } = meta.value;

  const [other, history, status, blocked] = await Promise.all([
    getUserPublicProfile(otherUserId),
    chatService().history(viewerId, conversationId, null, 50),
    friendshipService().getStatus(viewerId, otherUserId),
    blockService().isBlocked(viewerId, otherUserId),
  ]);
  if (!history.ok) notFound();

  const canSend = status === 'FRIENDS' && !blocked;
  const otherName = other?.name ?? 'Слушатель';
  // history приходит DESC (свежие сверху) — тред рисует сверху вниз, разворачиваем в ASC
  const initialMessages = history.value.slice().reverse();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/40 px-3 py-3 sm:px-4">
        <Link
          href="/messages"
          aria-label="К списку диалогов"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent/10 md:hidden"
        >
          <Icon name="arrow-left" size={18} />
        </Link>
        <Link href={`/u/${otherUserId}`} className="group flex min-w-0 items-center gap-3">
          <ChatAvatar name={other?.name ?? null} image={other?.image ?? null} size={36} />
          <span className="truncate text-sm font-semibold group-hover:text-foreground">{otherName}</span>
        </Link>
      </header>

      <ChatThread
        conversationId={conversationId}
        viewerId={viewerId}
        otherUserId={otherUserId}
        initialMessages={initialMessages}
        canSend={canSend}
      />
    </div>
  );
}
