import { redirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';
import { auth } from '@/auth';
import { chatService } from '@/lib/chat';
import { ConversationList } from '@/components/chat/conversation-list';
import { DeviceLink } from '@/components/chat/device-link';
import { MessagesShell } from '@/components/chat/messages-shell';

export const dynamic = 'force-dynamic';

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const [session, locale] = await Promise.all([auth(), getLocale()]);
  if (!session?.user?.id) return redirect({ href: '/sign-in?callbackUrl=/messages', locale });
  const viewerId = session.user.id;

  const conversations = await chatService().listConversations(viewerId);

  return (
    <div data-app-screen className="flex h-full min-h-0 flex-col">
      <MessagesShell
        sidebar={
          <>
            <div className="shrink-0 space-y-3 border-b border-border/40 p-4">
              <h1 className="text-lg font-semibold tracking-tight">Сообщения</h1>
              <DeviceLink viewerId={viewerId} />
            </div>
            <ConversationList conversations={conversations} viewerId={viewerId} />
          </>
        }
      >
        {children}
      </MessagesShell>
    </div>
  );
}
