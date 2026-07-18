'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import {
  db, setUserRole, verifyArtist, setArtistActive, setTrackStatus, setReleaseStatus,
  createArtistForUser, addArtistMember, removeArtistMember, listArtistMembers,
  DrizzleReleaseRepository, DrizzleTrackRepository, DrizzleTrackMoodsRepository,
  DrizzleArtistPostRepository, DrizzlePlaylistRepository, DrizzleArtistRepository,
  ALL_MOODS, ALL_TRACK_GENRES,
} from '@vire/db';
import type { UserRole, ArtistMemberRow } from '@vire/db';
import { ArtistPostService, PlaylistService, ArtistService, ReleaseService, TrackService } from '@vire/core';
import { retryFailedJobs, cleanFailedJobs, MANAGED_QUEUES } from '@/lib/admin-health';
import { transcodeQueue } from '@/lib/queue';
import { playlistCoverStorage } from '@/lib/playlist-cover-storage';
import { parseLrc } from '@/lib/lrc';
import { sanitizeCredits, type TrackCredit } from '@/lib/upload';
import { SANS_FONTS, MONO_FONTS } from '@/lib/font-catalog';

// VIEWER проходит гейт (canMutate=false), но каждый мутирующий экшен — тихий no-op
const ADMIN_VIEW_ROLES = new Set<UserRole>(['VIEWER', 'MODERATOR', 'ADMIN', 'SUPERADMIN']);
const ADMIN_MUTATE_ROLES = new Set<UserRole>(['MODERATOR', 'ADMIN', 'SUPERADMIN']);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !ADMIN_VIEW_ROLES.has(session.user.role)) {
    throw new Error('Forbidden');
  }
  return { session, canMutate: ADMIN_MUTATE_ROLES.has(session.user.role) };
}

function trackService() {
  return new TrackService(
    new DrizzleTrackRepository(db),
    new DrizzleReleaseRepository(db),
    transcodeQueue,
    { uuid: () => crypto.randomUUID(), moodsRepo: new DrizzleTrackMoodsRepository(db), parseLrc },
  );
}

function playlistService() {
  return new PlaylistService(new DrizzlePlaylistRepository(db), playlistCoverStorage, Date.now);
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

export async function actionRetranscodeTrack(trackId: string): Promise<{ error?: string; ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  const result = await trackService().retranscode(trackId);
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/admin/tracks');
  return { ok: true };
}

// массовый пере-транскод — при системно битом HLS у артиста, чтобы не жать ⟳ по каждому треку
export async function actionRetranscodeArtist(artistProfileId: string): Promise<{ error?: string; queued?: number }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  const result = await trackService().retranscodeArtist(artistProfileId);
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/admin/artists');
  revalidatePath('/admin/tracks');
  return { queued: result.value.queued };
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

// Редактура контента из админки: сервисы core, ownership-проверка отсутствует (админ правит любой контент)

export async function actionAdminUpdatePost(
  id: string,
  input: { title: string | null; body: string },
): Promise<{ error?: string; ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  const service = new ArtistPostService(new DrizzleArtistPostRepository(db));
  const result = await service.adminUpdate(id, input);
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/admin/posts');
  return { ok: true };
}

export async function actionAdminDeletePost(id: string): Promise<{ ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  const service = new ArtistPostService(new DrizzleArtistPostRepository(db));
  await service.adminDelete(id);
  revalidatePath('/admin/posts');
  return { ok: true };
}

export async function actionAdminUpdatePlaylist(
  id: string,
  input: { title: string; visibility: string },
): Promise<{ error?: string; ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  const result = await playlistService().adminUpdate(id, input);
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/admin/playlists');
  return { ok: true };
}

export async function actionAdminDeletePlaylist(id: string): Promise<{ ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  await playlistService().adminDelete(id);
  revalidatePath('/admin/playlists');
  return { ok: true };
}

export async function actionAdminUpdateArtist(
  artistProfileId: string,
  input: {
    name: string;
    slug: string;
    bio: string | null;
    avatarUrl: string | null;
    theme?: { bg: string; text: string; accent: string; grain: boolean; fontSans: string; fontMono: string };
  },
): Promise<{ error?: string; ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  const service = new ArtistService(new DrizzleArtistRepository(db), {
    now: () => Date.now(),
    fonts: { sans: SANS_FONTS, mono: MONO_FONTS },
  });
  const result = await service.adminUpdate(artistProfileId, input);
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/admin/artists');
  return { ok: true };
}

export async function actionAdminUpdateRelease(
  releaseId: string,
  input: { title: string; type: string; genre: string | null; releaseDate: string | null; description: string | null; linerNotes: string | null },
): Promise<{ error?: string; ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};
  const service = new ReleaseService(new DrizzleReleaseRepository(db), { uuid: () => crypto.randomUUID() });
  const result = await service.adminUpdate(releaseId, input);
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/admin/releases');
  return { ok: true };
}

export async function actionAdminUpdateTrack(
  trackId: string,
  input: {
    title: string; version: string | null; trackNumber: number; isExplicit: boolean; isExclusive: boolean;
    isWip: boolean; bpm: number | null; musicalKey: string | null; moods: string[]; genres: string[];
    credits: TrackCredit[]; lyrics: string | null;
  },
): Promise<{ error?: string; ok?: boolean }> {
  const { canMutate } = await requireAdmin();
  if (!canMutate) return {};

  const moods = (input.moods ?? []).filter((m) => (ALL_MOODS as string[]).includes(m)).slice(0, 5);
  const genres = (input.genres ?? []).filter((g) => (ALL_TRACK_GENRES as string[]).includes(g)).slice(0, 3);

  const result = await trackService().adminUpdate(trackId, {
    title: input.title,
    version: input.version,
    trackNumber: input.trackNumber,
    isExplicit: !!input.isExplicit,
    isExclusive: !!input.isExclusive,
    isWip: !!input.isWip,
    bpm: input.bpm,
    musicalKey: input.musicalKey,
    moods,
    genres,
    credits: sanitizeCredits(input.credits),
    lyrics: input.lyrics,
  });
  if (!result.ok) return { error: result.error.message };
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
