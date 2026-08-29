import { getCurrentUserId } from '../secure-store';
import { toB64 } from '../codec';
import { getOrCreateIdentity } from './identity';
import { publishIdentityKey, fetchIdentityKey } from './publish-key';
import { setChatAvailability } from './chat-availability';

/**
 * Публикует ik_pub при старте приложения с уже залогиненным юзером — как web's
 * E2eeBootstrap (`apps/web/components/chat/e2ee-bootstrap.tsx`).
 *
 * Отличие от веба и смысл всей функции: сервер хранит ОДИН ключ на пользователя, поэтому
 * безусловная публикация с телефона затирала ключ веб-сессии того же человека и молча
 * ломала ему веб-чат. Публикуем только когда это заведомо безопасно — серверного ключа
 * нет либо он уже наш. Разбор — `lib/e2ee/chat-availability.ts`.
 */
export async function bootstrapE2eeIdentity(): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const identity = await getOrCreateIdentity(userId);
    const ours = toB64(identity.pub);
    const remote = await fetchIdentityKey(userId);

    // Не смогли прочитать — не публикуем: под неизвестностью может лежать чужой ключ.
    if (remote === undefined) {
      setChatAvailability('unknown');
      return;
    }

    if (remote !== null && remote !== ours) {
      setChatAvailability('locked-other-device');
      return;
    }

    await publishIdentityKey(ours);
    setChatAvailability('available');
  } catch {
    // Бутстрап не должен ронять запуск приложения — следующий холодный старт повторит.
  }
}
