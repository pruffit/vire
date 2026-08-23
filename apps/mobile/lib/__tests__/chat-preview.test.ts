import { describe, it, expect, vi } from 'vitest';
import { resolveConversationPreview } from '../chat-preview';

describe('resolveConversationPreview', () => {
  it('нет сообщений — "Нет сообщений"', () => {
    const decrypt = vi.fn();
    const result = resolveConversationPreview(
      { lastMessageBody: null, lastMessageNonce: null, otherIkPub: null },
      decrypt,
    );
    expect(result).toBe('Нет сообщений');
    expect(decrypt).not.toHaveBeenCalled();
  });

  it('сообщение есть, но ключа собеседника нет — "Зашифровано"', () => {
    const decrypt = vi.fn();
    const result = resolveConversationPreview(
      { lastMessageBody: 'ct', lastMessageNonce: 'n', otherIkPub: null },
      decrypt,
    );
    expect(result).toBe('Зашифровано');
    expect(decrypt).not.toHaveBeenCalled();
  });

  it('расшифровка не удалась — "Не удалось расшифровать"', () => {
    const decrypt = vi.fn().mockReturnValue(null);
    const result = resolveConversationPreview(
      { lastMessageBody: 'ct', lastMessageNonce: 'n', otherIkPub: 'pub' },
      decrypt,
    );
    expect(result).toBe('Не удалось расшифровать');
  });

  it('расшифровка удалась — возвращает плейнтекст как есть, передаёт три аргумента', () => {
    const decrypt = vi.fn().mockReturnValue('привет');
    const result = resolveConversationPreview(
      { lastMessageBody: 'ct', lastMessageNonce: 'n', otherIkPub: 'pub' },
      decrypt,
    );
    expect(result).toBe('привет');
    expect(decrypt).toHaveBeenCalledWith('ct', 'n', 'pub');
  });
});
