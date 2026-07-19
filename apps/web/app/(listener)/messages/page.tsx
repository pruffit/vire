import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import { chatService } from '@/lib/chat';
import { ConversationList } from '@/components/chat/conversation-list';

export const metadata: Metadata = { title: 'Сообщения' };
export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/sign-in?callbackUrl=/messages');

  const conversations = await chatService().listConversations(session.user.id);

  return (
    <main className="w-full max-w-3xl mx-auto px-5 sm:px-6 py-12 space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Сообщения</h1>
      <ConversationList conversations={conversations} viewerId={session.user.id} />
    </main>
  );
}
