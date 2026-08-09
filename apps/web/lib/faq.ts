import type { FaqItem } from './structured-data';

// Единый источник для FAQ-блока и FAQPage JSON-LD — разметка должна совпадать с видимым текстом (требование Google).
const FAQ_KEYS = ['whatIsVire', 'pricing', 'becomeArtist', 'audioQuality', 'smartLink'] as const;

/** t — переводчик namespace 'faq' (ключи <key>.question/<key>.answer). */
export function getSiteFaq(t: (key: string) => string): FaqItem[] {
  return FAQ_KEYS.map((key) => ({
    question: t(`${key}.question`),
    answer: t(`${key}.answer`),
  }));
}
