import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { purchases } from '../schema';

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

export async function createTrackPurchase(
  userId: string,
  trackId: string,
  price: string,
): Promise<string> {
  const [row] = await db
    .insert(purchases)
    .values({
      userId,
      itemType: 'TRACK',
      itemId: trackId,
      price,
      currency: 'RUB',
      // Placeholder: immediately PAID until real payment provider is wired
      status: 'PAID',
      purchasedAt: new Date(),
    })
    .returning({ id: purchases.id });
  return row!.id;
}
