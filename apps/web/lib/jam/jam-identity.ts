import { auth } from '@/auth';
import { verifySessionId } from '@/lib/session-signing';
import type { JamParticipantIdentity } from '@vire/core';

export type JamIdentity = JamParticipantIdentity;

export async function resolveJamIdentity(sessionIdFromBody?: string): Promise<JamIdentity | null> {
  const session = await auth();
  if (session?.user?.id) return { userId: session.user.id };

  if (!sessionIdFromBody) return null;
  const verified = verifySessionId(sessionIdFromBody);
  return verified ? { guestSessionId: verified } : null;
}
