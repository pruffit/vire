// Пользовательская шкала прозрачности стекла: iOS 26.1 дала выбор из двух («default clear look»
// или «tinted look which increases opacity of the material»), iOS 27 — непрерывный слайдер
// «ultra clear → fully tinted», и приложения получают его без перекомпиляции.
//
// Правятся СЛЕДСТВИЯ, а не причины, и это не компромисс. Причина «плотность среды» в модели
// отсутствует намеренно: своего цвета у стекла нет, `bodyDensity` выводится из поглощения толщи
// и не превышает 0.03, а видимую плотность держат требование читаемости и рассеяние. Шкала
// толщины двигала бы число, которого в кадре не видно (замерено гейтом `check:optics`).
import type { VireGlassOptics } from './material';

/** Точка шкалы, в которой материал остаётся в точности сегодняшним. */
export const GLASS_SCALE_DEFAULT = 0.35;

/** Плотность тела на конце «fully tinted»: содержимое под стеклом обязано скрыться. */
const TINTED_DENSITY = 0.9;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * `scale` 0 — ultra clear, 1 — fully tinted. К прозрачному концу отпускается требование
 * читаемости и затемняющий слой (пользователь выбрал чистоту), к тонированному растёт плотность
 * тела.
 *
 * Настройки доступности применяются ПОСЛЕ шкалы: они ставят полы, и пользовательская чистота
 * их не отменяет (219 @18:45).
 */
export function applyGlassScale(optics: VireGlassOptics, scale: number): VireGlassOptics {
  const s = clamp01(scale);
  if (s === GLASS_SCALE_DEFAULT) return optics;
  if (s < GLASS_SCALE_DEFAULT) {
    const k = s / GLASS_SCALE_DEFAULT;
    return { ...optics, legibility: optics.legibility * k, dimming: optics.dimming * k };
  }
  const k = (s - GLASS_SCALE_DEFAULT) / (1 - GLASS_SCALE_DEFAULT);
  return { ...optics, bodyDensity: Math.max(optics.bodyDensity, TINTED_DENSITY * k) };
}
