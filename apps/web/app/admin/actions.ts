'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { setUserRole, verifyArtist, setArtistActive, setTrackStatus, setReleaseStatus, createArtistForUser, addArtistMember, removeArtistMember, listArtistMembers, getTrackSourceKey, getArtistTrackSources } from '@vire/db';
import type { UserRole, ArtistMemberRow } from '@vire/db';
import { retryFailedJobs, cleanFailedJobs, MANAGED_QUEUES } from '@/lib/admin-health';
import { transcodeQueue } from '@/lib/queue';

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

/**
 * Повторный транскод трека: пересобирает HLS из исходного мастера в vault.
 * Нужен, когда трек READY и манифест в БД есть (маркера `!hls` нет), но реальные
 * HLS-файлы в stream-бакете отсутствуют/битые — плеер бесконечно грузится.
 * Сбрасываем статус в PROCESSING, иначе воркер пропустит READY-трек (идемпотентность).
 */
export async function actionRetranscodeTrack(trackId: string): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const sourceKey = await getTrackSourceKey(trackId);
  if (!sourceKey) return { error: 'Нет исходника в vault — пересобрать нечем' };
  await setTrackStatus(trackId, 'PROCESSING');
  await transcodeQueue.add({ trackId, sourceKey });
  revalidatePath('/admin/tracks');
  return { ok: true };
}

/**
 * Массовый пере-транскод всех треков артиста (у кого есть исходник в vault).
 * Нужен, когда у артиста системно битый HLS (напр. вшитая обложка-видео) — чтобы
 * не жать ⟳ HLS по каждому треку вручную.
 */
export async function actionRetranscodeArtist(artistProfileId: string): Promise<{ error?: string; queued?: number }> {
  await requireAdmin();
  const sources = await getArtistTrackSources(artistProfileId);
  if (sources.length === 0) return { error: 'Нет треков с исходником в vault' };
  for (const s of sources) {
    await setTrackStatus(s.trackId, 'PROCESSING');
    await transcodeQueue.add({ trackId: s.trackId, sourceKey: s.sourceKey });
  }
  revalidatePath('/admin/artists');
  revalidatePath('/admin/tracks');
  return { queued: sources.length };
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

export async function actionListArtistMembers(artistProfileId: string): Promise<ArtistMemberRow[]> {
  await requireAdmin();
  return listArtistMembers(artistProfileId);
}

export async function actionAddArtistMember(
  artistProfileId: string,
  email: string,
): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const result = await addArtistMember(artistProfileId, email);
  if (!result.ok) return { error: result.error };
  revalidatePath('/admin/artists');
  return { ok: true };
}

export async function actionRemoveArtistMember(
  artistProfileId: string,
  userId: string,
): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const result = await removeArtistMember(artistProfileId, userId);
  if (!result.ok) return { error: result.error };
  revalidatePath('/admin/artists');
  return { ok: true };
}
