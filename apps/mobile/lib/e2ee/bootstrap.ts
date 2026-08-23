import { getCurrentUserId } from '../secure-store';
import { toB64 } from '../codec';
import { getOrCreateIdentity } from './identity';
import { publishIdentityKey } from './publish-key';

// Публикует ik_pub при каждом старте приложения с уже залогиненным юзером — мирроринг
// web's E2eeBootstrap (apps/web/components/chat/e2ee-bootstrap.tsx): не только явное
// открытие чата, любой заход. Идемпотентно (publishIdentityKey дедупит по значению ключа).
export async function bootstrapE2eeIdentity(): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    const identity = await getOrCreateIdentity(userId);
    await publishIdentityKey(toB64(identity.pub));
  } catch {
    // Бутстрап не должен ронять запуск приложения — следующий холодный старт повторит.
  }
}
