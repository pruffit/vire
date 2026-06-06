import { and, desc, eq } from 'drizzle-orm';
import { db } from '../client';
import { purchases, tracks, releases, artistProfiles } from '../schema';

export async function hasPurchasedTrack(userId: string, trackId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(
      and(
        eq(purchases.userId, userId),
        eq(purchases.itemType, 'TRACK'),
        eq(purchases.itemId, trackId),
        eq(purchases.status, 'PAID'),
      ),
    )
    .limit(1);
  return !!row;
}

export interface PendingPurchase {
  id: string;
  externalPaymentId: string;
}

export async function getPendingPurchase(
  userId: string,
  trackId: string,
): Promise<PendingPurchase | null> {
  const [row] = await db
    .select({ id: purchases.id, externalPaymentId: purchases.externalPaymentId })
    .from(purchases)
    .where(
      and(
        eq(purchases.userId, userId),
        eq(purchases.itemType, 'TRACK'),
        eq(purchases.itemId, trackId),
        eq(purchases.status, 'PENDING'),
      ),
    )
    .limit(1);

  if (!row?.externalPaymentId) return null;
  return { id: row.id, externalPaymentId: row.externalPaymentId };
}

export async function createPendingPurchase(params: {
  id: string;
  userId: string;
  trackId: string;
  price: string;
  externalPaymentId: string;
  paymentProvider: string;
}): Promise<void> {
  await db.insert(purchases).values({
    id: params.id,
    userId: params.userId,
    itemType: 'TRACK',
    itemId: params.trackId,
    price: params.price,
    currency: 'RUB',
    status: 'PENDING',
    paymentProvider: params.paymentProvider,
    externalPaymentId: params.externalPaymentId,
  });
}

export async function confirmPurchaseByExternalId(externalPaymentId: string): Promise<boolean> {
  const rows = await db
    .update(purchases)
    .set({ status: 'PAID', purchasedAt: new Date() })
    .where(
      and(
        eq(purchases.externalPaymentId, externalPaymentId),
        eq(purchases.status, 'PENDING'),
      ),
    )
    .returning({ id: purchases.id });
  return rows.length > 0;
}

export async function failPurchaseByExternalId(externalPaymentId: string): Promise<void> {
  await db
    .update(purchases)
    .set({ status: 'FAILED' })
    .where(
      and(
        eq(purchases.externalPaymentId, externalPaymentId),
        eq(purchases.status, 'PENDING'),
      ),
    );
}

export interface PurchasedTrack {
  id: string;
  title: string;
  durationSec: number | null;
  releaseId: string;
  releaseCoverUrl: string | null;
  artistName: string;
  artistSlug: string;
  purchasedAt: Date | null;
}

export async function getPurchasedTracks(userId: string): Promise<PurchasedTrack[]> {
  return db
    .select({
      id: tracks.id,
      title: tracks.title,
      durationSec: tracks.durationSec,
      releaseId: releases.id,
      releaseCoverUrl: releases.coverUrl,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      purchasedAt: purchases.purchasedAt,
    })
    .from(purchases)
    .innerJoin(tracks, eq(tracks.id, purchases.itemId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        eq(purchases.userId, userId),
        eq(purchases.itemType, 'TRACK'),
        eq(purchases.status, 'PAID'),
      ),
    )
    .orderBy(desc(purchases.purchasedAt));
}
