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
  /** Витрина: заголовок трека, строка песни, «ПОТОК». Узкий плакатный гротеск — интерфейс
   *  им не набирают, в мелком кегле он превращается в гребёнку. */
  displayBold: 'Oswald_600SemiBold',
  display: 'Oswald_700Bold',
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
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: colors.foreground,
  },
  releaseTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.22,
    color: colors.foreground,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.1,
    color: colors.foreground,
  },
  /** Строка списка: название трека, имя в диалоге. */
  row: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 19,
    color: colors.foreground,
  },
  /** Подпись: артист, мета, описание. Кит держит её на 60 % непрозрачности. */
  caption: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 17,
    color: colors.mutedForeground,
  },
  /** Имя артиста под крупным заголовком (фуллскрин-плеер) — между caption и body. */
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 21,
    color: colors.mutedForeground,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.foreground,
  },
  /** МЕТКА · ТАЙМКОД · СТАТУС — всегда в верхнем регистре на стороне вызова. */
  mono: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 11 * MONO_TRACKING,
    color: colors.mutedForeground,
  },
  /** Текст на кнопке-пилюле. */
  button: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 19,
    color: colors.foreground,
  },
} satisfies Record<string, TextStyle>;

export type TypeToken = keyof typeof type;

/**
 * Минимальные кегли: 11 для моно, 13 для Manrope. Прежние 10/11.5 пришли из вебовой
 * плотности и на телефоне читались мелко и жидко — подпись 11.5 regular была самым
 * частым «мелким тонким шрифтом» в продукте. Проверяется тестом, чтобы шкала не поехала
 * вниз при правках.
 */
export const MIN_SIZE = { mono: 11, sans: 13 } as const;
