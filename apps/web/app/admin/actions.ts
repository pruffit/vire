'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db, setUserRole, verifyArtist, setArtistActive, setTrackStatus, setReleaseStatus, createArtistForUser, addArtistMember, removeArtistMember, listArtistMembers, getTrackSourceKey, getArtistTrackSources, DrizzleReleaseRepository, DrizzleTrackRepository, setTrackMoods, setTrackGenres, ALL_MOODS, ALL_TRACK_GENRES, adminUpdateArtist, updateArtistPost, deleteArtistPost, adminUpdatePlaylist, adminDeletePlaylist } from '@vire/db';
import type { UserRole, ArtistMemberRow } from '@vire/db';
import { ALL_GENRES, type ReleaseType, type Genre, type UpdateReleaseInput, type UpdateTrackParams } from '@vire/core';
import { retryFailedJobs, cleanFailedJobs, MANAGED_QUEUES } from '@/lib/admin-health';
import { transcodeQueue } from '@/lib/queue';
import { parseLrc } from '@/lib/lrc';

const RELEASE_TYPES: ReleaseType[] = ['ALBUM', 'EP', 'SINGLE'];

// View-роли пускаются в бэкофис; mutate-роли могут менять данные. VIEWER —
// read-only: проходит гейт (чтобы экшены не падали ошибкой), но `canMutate=false`,
// и каждый мутирующий экшен делает тихий no-op.
const ADMIN_VIEW_ROLES = new Set<UserRole>(['VIEWER', 'MODERATOR', 'ADMIN', 'SUPERADMIN']);
const ADMIN_MUTATE_ROLES = new Set<UserRole>(['MODERATOR', 'ADMIN', 'SUPERADMIN']);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !ADMIN_VIEW_ROLES.has(session.user.role)) {
    throw new Error('Forbidden');
  }
  return { session, canMutate: ADMIN_MUTATE_ROLES.has(session.user.role) };
}

export async function actionSetUserRole(userId: string, role: UserRole) {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return;
  await setUserRole(userId, role);
  revalidatePath('/admin/users');
}

export async function actionVerifyArtist(artistProfileId: string, verified: boolean) {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return;
  await verifyArtist(artistProfileId, verified);
  revalidatePath('/admin/users');
  revalidatePath('/admin/artists');
}

export async function actionSetArtistActive(artistProfileId: string, isActive: boolean) {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return;
  await setArtistActive(artistProfileId, isActive);
  revalidatePath('/admin/artists');
}

function assertManagedQueue(name: string) {
  if (!(MANAGED_QUEUES as readonly string[]).includes(name)) throw new Error('Unknown queue');
}

export async function actionRetryQueueFailed(queueName: string) {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return;
  assertManagedQueue(queueName);
  await retryFailedJobs(queueName);
  revalidatePath('/admin');
}

export async function actionCleanQueueFailed(queueName: string) {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return;
  assertManagedQueue(queueName);
  await cleanFailedJobs(queueName);
  revalidatePath('/admin');
}

export async function actionSetTrackStatus(trackId: string, status: 'READY' | 'BLOCKED' | 'PROCESSING' | 'FAILED') {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return;
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
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
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
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
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
  const { canMutate } = await requireAdmin();
  if (!canMutate) return;
  await setReleaseStatus(releaseId, status);
  revalidatePath('/admin/releases');
}

// ─── Полная редактура контента из админки (§9.1) — минуя ownership-гард сервиса:
// репозитории update(id,…) принимают id напрямую, проверка владения живёт в сервисе.

export async function actionAdminUpdatePost(
  id: string,
  input: { title: string | null; body: string },
): Promise<{ error?: string; ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  const body = (input.body ?? '').trim();
  if (!body || body.length > 10000) return { error: 'Текст: 1–10000 символов' };
  const title = input.title?.trim() ? input.title.trim().slice(0, 200) : null;
  await updateArtistPost(id, { title, body });
  revalidatePath('/admin/posts');
  return { ok: true };
}

export async function actionAdminDeletePost(id: string): Promise<{ ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  await deleteArtistPost(id);
  revalidatePath('/admin/posts');
  return { ok: true };
}

export async function actionAdminUpdatePlaylist(
  id: string,
  input: { title: string; visibility: string },
): Promise<{ error?: string; ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  const title = (input.title ?? '').trim();
  if (!title || title.length > 200) return { error: 'Название: 1–200 символов' };
  if (input.visibility !== 'PRIVATE' && input.visibility !== 'PUBLIC') return { error: 'Неверная видимость' };
  await adminUpdatePlaylist(id, { title, visibility: input.visibility });
  revalidatePath('/admin/playlists');
  return { ok: true };
}

export async function actionAdminDeletePlaylist(id: string): Promise<{ ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  await adminDeletePlaylist(id);
  revalidatePath('/admin/playlists');
  return { ok: true };
}

export async function actionAdminUpdateArtist(
  artistProfileId: string,
  input: { name: string; slug: string; bio: string | null; avatarUrl: string | null },
): Promise<{ error?: string; ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  const name = (input.name ?? '').trim();
  if (!name || name.length > 120) return { error: 'Имя: 1–120 символов' };
  const slug = (input.slug ?? '').trim().toLowerCase();
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return { error: 'Slug: 2–60 символов, латиница/цифры/дефис' };
  const res = await adminUpdateArtist(artistProfileId, {
    name,
    slug,
    bio: input.bio?.trim() ? input.bio.trim().slice(0, 2000) : null,
    avatarUrl: input.avatarUrl?.trim() || null,
  });
  if (!res.ok) return { error: res.error };
  revalidatePath('/admin/artists');
  return { ok: true };
}

export async function actionAdminUpdateRelease(
  releaseId: string,
  input: { title: string; type: string; genre: string | null; releaseDate: string | null; description: string | null; linerNotes: string | null },
): Promise<{ error?: string; ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
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
    lyrics: string | null;
  },
): Promise<{ error?: string; ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  const title = (input.title ?? '').trim();
  if (!title || title.length > 200) return { error: 'Название: 1–200 символов' };
  if (!Number.isInteger(input.trackNumber) || input.trackNumber < 1) return { error: 'Неверный номер' };
  if (input.bpm != null && (!Number.isInteger(input.bpm) || input.bpm < 20 || input.bpm > 500)) return { error: 'BPM: 20–500' };
  if (typeof input.lyrics === 'string' && input.lyrics.length > 20000) return { error: 'Текст слишком длинный' };
  const moods = (input.moods ?? []).filter((m) => (ALL_MOODS as string[]).includes(m)).slice(0, 5);
  const genres = (input.genres ?? []).filter((g) => (ALL_TRACK_GENRES as string[]).includes(g)).slice(0, 3);
  const parsedLyrics = typeof input.lyrics === 'string' && input.lyrics.trim() ? parseLrc(input.lyrics) : null;
  const patch: UpdateTrackParams = {
    title,
    trackNumber: input.trackNumber,
    isExplicit: !!input.isExplicit,
    isExclusive: !!input.isExclusive,
    isWip: !!input.isWip,
    bpm: input.bpm,
    musicalKey: input.musicalKey?.trim() ? input.musicalKey.trim().slice(0, 20) : null,
    lyrics: parsedLyrics && parsedLyrics.length > 0 ? parsedLyrics : null,
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
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
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
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  const result = await addArtistMember(artistProfileId, email);
  if (!result.ok) return { error: result.error };
  revalidatePath('/admin/artists');
  return { ok: true };
}

export async function actionRemoveArtistMember(
  artistProfileId: string,
  userId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  const result = await removeArtistMember(artistProfileId, userId);
  if (!result.ok) return { error: result.error };
  revalidatePath('/admin/artists');
  return { ok: true };
}
