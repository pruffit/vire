export type ConversationPreviewInput = {
  lastMessageBody: string | null;
  lastMessageNonce: string | null;
  otherIkPub: string | null;
};

// Три разных случая — не путать: нет сообщений (ничего шифровать), нет ключа собеседника
// (шифротекст есть, CK вывести нечем), реальный сбой расшифровки (CK выведен, secretbox не открылся).
export function resolveConversationPreview(
  input: ConversationPreviewInput,
  decrypt: (body: string, nonce: string, otherIkPub: string) => string | null,
): string {
  if (!input.lastMessageBody || !input.lastMessageNonce) return 'Нет сообщений';
  if (!input.otherIkPub) return 'Зашифровано';
  return decrypt(input.lastMessageBody, input.lastMessageNonce, input.otherIkPub) ?? 'Не удалось расшифровать';
}
