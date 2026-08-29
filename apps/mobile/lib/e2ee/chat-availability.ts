import { create } from 'zustand';

/**
 * Доступность чата на ЭТОМ устройстве.
 *
 * `/api/v1/keys` хранит один `ik_pub` на пользователя (`upsertIdentityKey(caller.id, …)`),
 * а личность у веба и у телефона своя. Публикация мобильного ключа поверх веб-ключа
 * молча ломает веб-чат того же человека: новые сообщения шифруются на последнего
 * опубликовавшегося, второе устройство их не прочитает.
 *
 * До появления привязки устройств (роуты `keys/link/*`, на клиенте не реализованы) чат
 * на телефоне блокируется, если на сервере уже лежит ЧУЖОЙ ключ. Это предохранитель от
 * будущего ущерба — уже перетёртые ключи он не чинит.
 */
export type ChatAvailability =
  /** Серверный ключ наш или его нет вовсе — чат работает. */
  | 'available'
  /** На сервере ключ другого устройства. Публиковать нельзя, читать нечем. */
  | 'locked-other-device'
  /** Проверить не удалось (нет сети). Публиковать нельзя — а вдруг там чужой ключ. */
  | 'unknown';

interface ChatAvailabilityState {
  status: ChatAvailability;
  setStatus: (status: ChatAvailability) => void;
}

export const useChatAvailability = create<ChatAvailabilityState>((set) => ({
  status: 'unknown',
  setStatus: (status) => set({ status }),
}));

export function setChatAvailability(status: ChatAvailability): void {
  useChatAvailability.getState().setStatus(status);
}

export function getChatAvailability(): ChatAvailability {
  return useChatAvailability.getState().status;
}
