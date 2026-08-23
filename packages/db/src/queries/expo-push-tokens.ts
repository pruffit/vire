import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { expoPushTokens } from '../schema';

export async function upsertExpoPushToken(
  userId: string,
  data: { token: string; platform: string; deviceId?: string },
): Promise<void> {
  await db.insert(expoPushTokens)
    .values({ userId, token: data.token, platform: data.platform, deviceId: data.deviceId ?? null })
    .onConflictDoUpdate({
      target: expoPushTokens.token,
      set: { userId, platform: data.platform, deviceId: data.deviceId ?? null, lastUsedAt: new Date() },
    });
}

export async function deleteExpoPushToken(userId: string, token: string): Promise<void> {
  await db.delete(expoPushTokens).where(
    and(eq(expoPushTokens.userId, userId), eq(expoPushTokens.token, token)),
  );
}

export async function deleteExpoPushTokensByTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await db.delete(expoPushTokens).where(inArray(expoPushTokens.token, tokens));
}

export async function deleteExpoPushTokensByDeviceId(deviceId: string): Promise<void> {
  await db.delete(expoPushTokens).where(eq(expoPushTokens.deviceId, deviceId));
}

export async function listExpoPushTokens(userId: string): Promise<Array<{ token: string }>> {
  return db.select({ token: expoPushTokens.token })
    .from(expoPushTokens).where(eq(expoPushTokens.userId, userId));
}
