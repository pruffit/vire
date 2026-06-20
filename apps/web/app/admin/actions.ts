'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { setUserRole, verifyArtist, setArtistActive, setTrackStatus, setReleaseStatus, createArtistForUser } from '@vire/db';
import type { UserRole } from '@vire/db';
import { retryFailedJobs, cleanFailedJobs, MANAGED_QUEUES } from '@/lib/admin-health';

const ADMIN_ROLES = new Set<UserRole>(['MODERATOR', 'ADMIN', 'SUPERADMIN']);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !ADMIN_ROLES.has(session.user.role)) {
    throw new Error('Forbidden');
  }
  return session;
}

export async function actionSetUserRole(userId: string, role: UserRole) {
  await requireAdmin();
  await setUserRole(userId, role);
  revalidatePath('/admin/users');
}

export async function actionVerifyArtist(artistProfileId: string, verified: boolean) {
  await requireAdmin();
  await verifyArtist(artistProfileId, verified);
  revalidatePath('/admin/users');
  revalidatePath('/admin/artists');
}

export async function actionSetArtistActive(artistProfileId: string, isActive: boolean) {
  await requireAdmin();
  await setArtistActive(artistProfileId, isActive);
  revalidatePath('/admin/artists');
}

function assertManagedQueue(name: string) {
  if (!(MANAGED_QUEUES as readonly string[]).includes(name)) throw new Error('Unknown queue');
}

export async function actionRetryQueueFailed(queueName: string) {
  await requireAdmin();
  assertManagedQueue(queueName);
  await retryFailedJobs(queueName);
  revalidatePath('/admin');
}

export async function actionCleanQueueFailed(queueName: string) {
  await requireAdmin();
  assertManagedQueue(queueName);
  await cleanFailedJobs(queueName);
  revalidatePath('/admin');
}

export async function actionSetTrackStatus(trackId: string, status: 'READY' | 'BLOCKED' | 'PROCESSING' | 'FAILED') {
  await requireAdmin();
  await setTrackStatus(trackId, status);
  revalidatePath('/admin/tracks');
}

export async function actionSetReleaseStatus(
  releaseId: string,
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
) {
  await requireAdmin();
  await setReleaseStatus(releaseId, status);
  revalidatePath('/admin/releases');
}

export async function actionCreateArtist(
  email: string,
  name: string,
  slug: string,
): Promise<{ error?: string; slug?: string }> {
  await requireAdmin();
  const result = await createArtistForUser({ email, name, slug });
  if (!result.ok) return { error: result.error };
  revalidatePath('/admin/users');
  revalidatePath('/admin/artists');
  return { slug: result.slug };
}
