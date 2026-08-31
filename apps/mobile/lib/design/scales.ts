/**
 * Шкалы мобильного кита: сетка, радиусы, движение.
 *
 * Живут здесь, а не в `@vire/design-tokens`, намеренно. Там один базовый `radius: 6`,
 * из которого веб выводит `--radius` и все `rounded-*` Tailwind — китовые радиусы
 * (обложка 9–12, стекло 22–28) сдвинули бы вёрстку всего веба. Цвет продолжает
 * приходить из общего пакета: палитра у кита 1:1 с вебом.
 */

/** Шаг сетки. Всё, что не кратно, — повод перепроверить макет, а не добавить число. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
} as const;

export const layout = {
  /** Поля экрана. Списки уже — плотность важнее воздуха. */
  screenPadding: 20,
  listPadding: 12,
  /** Минимальная тач-зона Material (48×48, зазор ≥ 8); добирается прозрачным паддингом. */
  touchTarget: 48,
} as const;

export const radii = {
  /** Обложка в строке списка. */
  coverSm: 10,
  /** Обложка в карточке. */
  coverLg: 12,
  card: 14,
  /** Стеклянная панель. Круг и капсула считаются как h/2 отдельно. */
  glass: 24,
  sheet: 30,
  full: 9999,
} as const;

/**
 * Длительности. Кит: нажатие 120, панель 220, sheet 280. `reduceMotion` обнуляет всё —
 * не замедляет, а убирает: пользователь просил тишины, а не медленной анимации.
 */
export const duration = {
  press: 120,
  panel: 220,
  sheet: 280,
  screen: 240,
  /** Кросс-фейд ambient-фона плеера на смене трека. */
  ambient: 600,
} as const;

export type DurationKey = keyof typeof duration;

export function motionDuration(key: DurationKey, reduceMotion: boolean): number {
  return reduceMotion ? 0 : duration[key];
}
