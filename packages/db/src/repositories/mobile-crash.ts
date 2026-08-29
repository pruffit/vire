import { desc } from 'drizzle-orm';
import type { MobileCrashEvent } from '@vire/core';
import { db } from '../client';
import { mobileCrashes } from '../schema/mobile-crashes';

/**
 * Записывает падение. Повтор того же `event_id` игнорируется: SDK переотправляет
 * событие при потере сети, и один краш не должен размножаться строками.
 */
export async function insertMobileCrash(crash: MobileCrashEvent): Promise<void> {
  await db
    .insert(mobileCrashes)
    .values({
      eventId: crash.eventId,
      occurredAt: crash.occurredAt,
      level: crash.level,
      platform: crash.platform,
      environment: crash.environment,
      release: crash.release,
      dist: crash.dist,
      exceptionType: crash.exceptionType,
      exceptionValue: crash.exceptionValue,
      appVersion: crash.appVersion,
      deviceModel: crash.deviceModel,
      osVersion: crash.osVersion,
      payload: crash.payload,
    })
    .onConflictDoNothing({ target: mobileCrashes.eventId });
}

export interface MobileCrashRow {
  id: string;
  eventId: string;
  receivedAt: Date;
  occurredAt: Date | null;
  level: string | null;
  release: string | null;
  exceptionType: string | null;
  exceptionValue: string | null;
  appVersion: string | null;
  deviceModel: string | null;
  osVersion: string | null;
}

/** Последние падения — для будущего экрана в бэкофисе и для проверки приёмника. */
export async function listRecentMobileCrashes(limit = 50): Promise<MobileCrashRow[]> {
  return db
    .select({
      id: mobileCrashes.id,
      eventId: mobileCrashes.eventId,
      receivedAt: mobileCrashes.receivedAt,
      occurredAt: mobileCrashes.occurredAt,
      level: mobileCrashes.level,
      release: mobileCrashes.release,
      exceptionType: mobileCrashes.exceptionType,
      exceptionValue: mobileCrashes.exceptionValue,
      appVersion: mobileCrashes.appVersion,
      deviceModel: mobileCrashes.deviceModel,
      osVersion: mobileCrashes.osVersion,
    })
    .from(mobileCrashes)
    .orderBy(desc(mobileCrashes.receivedAt))
    .limit(limit);
}
