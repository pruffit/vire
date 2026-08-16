'use server';

import { revalidatePath } from 'next/cache';
import { getCaller } from '@/lib/caller';
import {
  db, setUserRole, verifyArtist, setArtistActive, setTrackStatus, setReleaseStatus,
  createArtistForUser, addArtistMember, removeArtistMember, listArtistMembers,
  DrizzleReleaseRepository, DrizzleTrackRepository, DrizzleTrackMoodsRepository,
  DrizzleArtistPostRepository, DrizzleArtistRepository,
  ALL_MOODS, ALL_TRACK_GENRES,
} from '@vire/db';
import type { UserRole, ArtistMemberRow } from '@vire/db';
import { ArtistPostService, ArtistService, ReleaseService, TrackService, isKnownFeatureFlag } from '@vire/core';
import { featureFlagService } from '@/lib/feature-flags';
import { can, type Permission } from '@vire/core/access';
import { retryFailedJobs, cleanFailedJobs, MANAGED_QUEUES } from '@/lib/admin-health';
import { transcodeQueue } from '@/lib/queue';
import { playlistService } from '@/lib/playlist';
import { parseLrc } from '@/lib/lrc';
import { sanitizeCredits, type TrackCredit } from '@/lib/upload';
import { SANS_FONTS, MONO_FONTS } from '@/lib/font-catalog';
import { makeAudit } from '@/lib/require-access';

async function requireAction(permission: Permission) {
  const caller = await getCaller();
  if (!caller || !can(caller, permission)) {
    throw new Error('Forbidden');
  }
  const actor = { id: caller.id, role: caller.role };
  return { caller, actor, audit: makeAudit(actor, permission) };
}

function trackService() {
  return new TrackService(
    new DrizzleTrackRepository(db),
    new DrizzleReleaseRepository(db),
    transcodeQueue,
    { uuid: () => crypto.randomUUID(), moodsRepo: new DrizzleTrackMoodsRepository(db), parseLrc },
  );
}

export async function actionSetUserRole(userId: string, role: UserRole) {
  const { audit } = await requireAction('admin.users.manage');
  await setUserRole(userId, role);
  await audit('user.role.set', { type: 'user', id: userId }, { role });
  revalidatePath('/admin/users');
}

export async function actionVerifyArtist(artistProfileId: string, verified: boolean) {
  const { audit } = await requireAction('admin.content.moderate');
  await verifyArtist(artistProfileId, verified);
  await audit('artist.verify', { type: 'artist', id: artistProfileId }, { verified });
  revalidatePath('/admin/users');
  revalidatePath('/admin/artists');
}

export async function actionSetArtistActive(artistProfileId: string, isActive: boolean) {
  const { audit } = await requireAction('admin.content.moderate');
  await setArtistActive(artistProfileId, isActive);
  await audit('artist.set_active', { type: 'artist', id: artistProfileId }, { isActive });
  revalidatePath('/admin/artists');
}

export async function actionSetFeatureFlag(key: string, enabled: boolean): Promise<{ error?: string }> {
  const { actor, audit } = await requireAction('admin.flags.manage');
  if (!isKnownFeatureFlag(key)) return { error: 'Неизвестный флаг' };
  await featureFlagService().setEnabled(key, enabled, actor.id);
  await audit('flag.set', { type: 'flag', id: key }, { enabled });
  revalidatePath('/admin/flags');
  return {};
}

function assertManagedQueue(name: string) {
  if (!(MANAGED_QUEUES as readonly string[]).includes(name)) throw new Error('Unknown queue');
}

export async function actionRetryQueueFailed(queueName: string) {
  const { audit } = await requireAction('admin.content.moderate');
  assertManagedQueue(queueName);
  await retryFailedJobs(queueName);
  await audit('queue.retry_failed', { type: 'queue', id: queueName });
  revalidatePath('/admin');
}

export async function actionCleanQueueFailed(queueName: string) {
  const { audit } = await requireAction('admin.content.moderate');
  assertManagedQueue(queueName);
  await cleanFailedJobs(queueName);
  await audit('queue.clean_failed', { type: 'queue', id: queueName });
  revalidatePath('/admin');
}

export async function actionSetTrackStatus(trackId: string, status: 'READY' | 'BLOCKED' | 'PROCESSING' | 'FAILED') {
  const { audit } = await requireAction('admin.content.moderate');
  await setTrackStatus(trackId, status);
  await audit('track.set_status', { type: 'track', id: trackId }, { status });
  revalidatePath('/admin/tracks');
}

export async function actionRetranscodeTrack(trackId: string): Promise<{ error?: string; ok?: boolean }> {
  const { audit } = await requireAction('admin.content.moderate');
  const result = await trackService().retranscode(trackId);
  if (!result.ok) return { error: result.error.message };
  await audit('track.retranscode', { type: 'track', id: trackId });
  revalidatePath('/admin/tracks');
  return { ok: true };
}

// массовый пере-транскод — при системно битом HLS у артиста, чтобы не жать ⟳ по каждому треку
export async function actionRetranscodeArtist(artistProfileId: string): Promise<{ error?: string; queued?: number }> {
  const { audit } = await requireAction('admin.content.moderate');
  const result = await trackService().retranscodeArtist(artistProfileId);
  if (!result.ok) return { error: result.error.message };
  await audit('artist.retranscode', { type: 'artist', id: artistProfileId }, { queued: result.value.queued });
  revalidatePath('/admin/artists');
  revalidatePath('/admin/tracks');
  return { queued: result.value.queued };
}

export async function actionSetReleaseStatus(
  releaseId: string,
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
) {
  const { audit } = await requireAction('admin.content.moderate');
  await setReleaseStatus(releaseId, status);
  await audit('release.set_status', { type: 'release', id: releaseId }, { status });
  revalidatePath('/admin/releases');
}

// Редактура контента из админки: сервисы core, ownership-проверка отсутствует (админ правит любой контент)

export async function actionAdminUpdatePost(
  id: string,
  input: { title: string | null; body: string },
): Promise<{ error?: string; ok?: boolean }> {
  const { audit } = await requireAction('admin.content.moderate');
  const service = new ArtistPostService(new DrizzleArtistPostRepository(db));
  const result = await service.adminUpdate(id, input);
  if (!result.ok) return { error: result.error.message };
  await audit('post.update', { type: 'post', id });
  revalidatePath('/admin/posts');
  return { ok: true };
}

export async function actionAdminDeletePost(id: string): Promise<{ ok?: boolean }> {
  const { audit } = await requireAction('admin.content.moderate');
  const service = new ArtistPostService(new DrizzleArtistPostRepository(db));
  await service.adminDelete(id);
  await audit('post.delete', { type: 'post', id });
  revalidatePath('/admin/posts');
  return { ok: true };
}

export async function actionAdminUpdatePlaylist(
  id: string,
  input: { title: string; visibility: string },
): Promise<{ error?: string; ok?: boolean }> {
  const { audit } = await requireAction('admin.content.moderate');
  const result = await playlistService().adminUpdate(id, input);
  if (!result.ok) return { error: result.error.message };
  await audit('playlist.update', { type: 'playlist', id });
  revalidatePath('/admin/playlists');
  return { ok: true };
}

export async function actionAdminDeletePlaylist(id: string): Promise<{ ok?: boolean }> {
  const { audit } = await requireAction('admin.content.moderate');
  await playlistService().adminDelete(id);
  await audit('playlist.delete', { type: 'playlist', id });
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
  const { audit } = await requireAction('admin.content.moderate');
  const service = new ArtistService(new DrizzleArtistRepository(db), {
    now: () => Date.now(),
    fonts: { sans: SANS_FONTS, mono: MONO_FONTS },
  });
  const result = await service.adminUpdate(artistProfileId, input);
  if (!result.ok) return { error: result.error.message };
  await audit('artist.update', { type: 'artist', id: artistProfileId });
  revalidatePath('/admin/artists');
  return { ok: true };
}

export async function actionAdminUpdateRelease(
  releaseId: string,
  input: { title: string; type: string; genre: string | null; releaseDate: string | null; description: string | null; linerNotes: string | null },
): Promise<{ error?: string; ok?: boolean }> {
  const { audit } = await requireAction('admin.content.moderate');
  const service = new ReleaseService(new DrizzleReleaseRepository(db), { uuid: () => crypto.randomUUID() });
  const result = await service.adminUpdate(releaseId, input);
  if (!result.ok) return { error: result.error.message };
  await audit('release.update', { type: 'release', id: releaseId });
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
  const { audit } = await requireAction('admin.content.moderate');

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
  await audit('track.update', { type: 'track', id: trackId });
  revalidatePath('/admin/tracks');
  return { ok: true };
}

export async function actionCreateArtist(
  email: string,
  name: string,
  slug: string,
): Promise<{ error?: string; slug?: string }> {
  const { audit } = await requireAction('admin.users.manage');
  const result = await createArtistForUser({ email, name, slug });
  if (!result.ok) return { error: result.error };
  await audit('artist.create_for_user', { type: 'artist', id: result.slug }, { email });
  revalidatePath('/admin/users');
  revalidatePath('/admin/artists');
  return { slug: result.slug };
}

export async function actionListArtistMembers(artistProfileId: string): Promise<ArtistMemberRow[]> {
  await requireAction('admin.read');
  return listArtistMembers(artistProfileId);
}

export async function actionAddArtistMember(
  artistProfileId: string,
  email: string,
): Promise<{ error?: string; ok?: boolean }> {
  const { audit } = await requireAction('admin.content.moderate');
  const result = await addArtistMember(artistProfileId, email);
  if (!result.ok) return { error: result.error };
  await audit('artist.member.add', { type: 'artist', id: artistProfileId }, { email });
  revalidatePath('/admin/artists');
  return { ok: true };
}

export async function actionRemoveArtistMember(
  artistProfileId: string,
  userId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const { audit } = await requireAction('admin.content.moderate');
  const result = await removeArtistMember(artistProfileId, userId);
  if (!result.ok) return { error: result.error };
  await audit('artist.member.remove', { type: 'artist', id: artistProfileId }, { userId });
  revalidatePath('/admin/artists');
  return { ok: true };
}
