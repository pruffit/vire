import type { TextStyle } from 'react-native';
import { colors } from '../theme';

/**
 * Типографика кита: Manrope для контента, JetBrains Mono для меты.
 *
 * **Каждый вес — отдельное семейство.** Android не синтезирует начертания у кастомных
 * шрифтов надёжно: `fontWeight: '800'` на `Manrope` даст либо обычный вес, либо кривой
 * искусственный жир. Поэтому стили называют семейство, а `fontWeight` не используют вовсе.
 */
export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

/** Прозрачности текста из кита — как множители к foreground, а не отдельные цвета. */
export const textAlpha = {
  primary: 1,
  secondary: 0.6,
  tertiary: 0.45,
  disabled: 0.3,
} as const;

/**
 * Мета набирается моноширинным: таймкоды, счётчики, статусы, коды. Никогда — контент.
 * Разрядка +12 % от кита: моно в мелком кегле без неё читается плотным.
 */
const MONO_TRACKING = 0.12;

export const type = {
  screenTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.56,
    color: colors.foreground,
  },
  releaseTitle: {
    fontFamily: fonts.extrabold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.22,
    color: colors.foreground,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.foreground,
  },
  /** Строка списка: название трека, имя в диалоге. */
  row: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    lineHeight: 16,
    color: colors.foreground,
  },
  /** Подпись: артист, мета, описание. Кит держит её на 60 % непрозрачности. */
  caption: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.mutedForeground,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
  },
  /** МЕТКА · ТАЙМКОД · СТАТУС — всегда в верхнем регистре на стороне вызова. */
  mono: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 10 * MONO_TRACKING,
    color: colors.mutedForeground,
  },
  /** Текст на кнопке-пилюле. */
  button: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.foreground,
  },
} satisfies Record<string, TextStyle>;

export type TypeToken = keyof typeof type;

/**
 * Минимальные кегли кита: 10 для моно, 11 для Manrope; на стекле — не ниже 11 и не легче
 * 500. Проверяется тестом, чтобы шкала не поехала вниз при правках.
 */
export const MIN_SIZE = { mono: 10, sans: 11 } as const;
