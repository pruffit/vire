'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, setUserRole, verifyArtist, setArtistActive, setTrackStatus, setReleaseStatus, createArtistForUser, addArtistMember, removeArtistMember, listArtistMembers, getTrackSourceKey, getArtistTrackSources, DrizzleReleaseRepository, DrizzleTrackRepository, setTrackMoods, setTrackGenres, ALL_MOODS, ALL_TRACK_GENRES } from '@vire/db';
import type { UserRole, ArtistMemberRow } from '@vire/db';
import { ALL_GENRES, type ReleaseType, type Genre, type UpdateReleaseInput, type UpdateTrackParams } from '@vire/core';
import { retryFailedJobs, cleanFailedJobs, MANAGED_QUEUES } from '@/lib/admin-health';
import { transcodeQueue } from '@/lib/queue';

const RELEASE_TYPES: ReleaseType[] = ['ALBUM', 'EP', 'SINGLE'];

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

// ─── Полная редактура контента из админки (§9.1) — минуя ownership-гард сервиса:
// репозитории update(id,…) принимают id напрямую, проверка владения живёт в сервисе.

export async function actionAdminUpdateRelease(
  releaseId: string,
  input: { title: string; type: string; genre: string | null; releaseDate: string | null; description: string | null; linerNotes: string | null },
): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const title = (input.title ?? '').trim();
  if (!title || title.length > 200) return { error: 'Название: 1–200 символов' };
  if (!RELEASE_TYPES.includes(input.type as ReleaseType)) return { error: 'Неверный тип' };
  if (input.genre != null && !(ALL_GENRES as readonly string[]).includes(input.genre)) return { error: 'Неверный жанр' };
  let releaseDate: Date | null = null;
  if (input.releaseDate) {
    const d = new Date(input.releaseDate);
    if (isNaN(d.getTime())) return { error: 'Неверная дата' };
    releaseDate = d;
  }
  const patch: UpdateReleaseInput = {
    title,
    type: input.type as ReleaseType,
    genre: (input.genre as Genre | null) ?? null,
    releaseDate,
    description: input.description?.trim() ? input.description.trim().slice(0, 5000) : null,
    linerNotes: input.linerNotes?.trim() ? input.linerNotes.trim().slice(0, 10000) : null,
  };
  await new DrizzleReleaseRepository(db).update(releaseId, patch);
  revalidatePath('/admin/releases');
  return { ok: true };
}

export async function actionAdminUpdateTrack(
  trackId: string,
  input: {
    title: string; trackNumber: number; isExplicit: boolean; isExclusive: boolean;
    isWip: boolean; bpm: number | null; musicalKey: string | null; moods: string[]; genres: string[];
  },
): Promise<{ error?: string; ok?: boolean }> {
  await requireAdmin();
  const title = (input.title ?? '').trim();
  if (!title || title.length > 200) return { error: 'Название: 1–200 символов' };
  if (!Number.isInteger(input.trackNumber) || input.trackNumber < 1) return { error: 'Неверный номер' };
  if (input.bpm != null && (!Number.isInteger(input.bpm) || input.bpm < 20 || input.bpm > 500)) return { error: 'BPM: 20–500' };
  const moods = (input.moods ?? []).filter((m) => (ALL_MOODS as string[]).includes(m)).slice(0, 5);
  const genres = (input.genres ?? []).filter((g) => (ALL_TRACK_GENRES as string[]).includes(g)).slice(0, 3);
  const patch: UpdateTrackParams = {
    title,
    trackNumber: input.trackNumber,
    isExplicit: !!input.isExplicit,
    isExclusive: !!input.isExclusive,
    isWip: !!input.isWip,
    bpm: input.bpm,
    musicalKey: input.musicalKey?.trim() ? input.musicalKey.trim().slice(0, 20) : null,
  };
  await new DrizzleTrackRepository(db).update(trackId, patch);
  await setTrackMoods(trackId, moods as Parameters<typeof setTrackMoods>[1]);
  await setTrackGenres(trackId, genres as Parameters<typeof setTrackGenres>[1]);
  revalidatePath('/admin/tracks');
  return { ok: true };
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
