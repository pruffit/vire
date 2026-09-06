import { presenceUserKey } from '@vire/core';
import { connection } from '../queues/connection.js';

export async function isUserOnline(userId: string): Promise<boolean> {
  try { return (await connection.exists(presenceUserKey(userId))) === 1; } catch { return false; }
}
