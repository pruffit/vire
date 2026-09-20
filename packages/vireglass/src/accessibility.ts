// Системные настройки доступности меняют СЛОИ материала, а не отменяют его (эталон 219 @18:15).
// Поэтому здесь правятся СЛЕДСТВИЯ, как в тумблерах: шейдеру про доступность знать нечего.
import type { VireGlassOptics } from './material';

export type VireGlassAccessibility = {
  /** Стекло становится матовее и сильнее скрывает контент под собой (219 @18:22). */
  reduceTransparency: boolean;
  /** Деталь уходит почти в чёрное или белое и берётся контрастной границей (219 @18:29). */
  increaseContrast: boolean;
  /** Упругость материала выключается, эффекты тише (219 @18:35). Оптики не касается: это про
   *  движение, и применяет его тот, кто это движение считает. */
  reduceMotion: boolean;
};

export const NO_ACCESSIBILITY: VireGlassAccessibility = {
  reduceTransparency: false,
  increaseContrast: false,
  reduceMotion: false,
};

/** Матовость и плотность, ниже которых «уменьшенная прозрачность» стекло не оставляет. */
const FROST_MIN_DP = 14;
const OBSCURE_MIN = 0.45;
/** Контрастный режим: тело почти непрозрачно, а силуэт обязан быть виден целиком. */
const CONTRAST_DENSITY = 0.9;
const CONTRAST_PRESENCE = 0.5;

/** Настройка системы действует на всё стекло и главнее варианта материала (219 @18:45): прозрачный
 *  вариант под контрастом тоже уходит к краю шкалы — контраст пользователю нужнее эстетики. */
export function applyAccessibility(
  optics: VireGlassOptics,
  mods: VireGlassAccessibility = NO_ACCESSIBILITY,
): VireGlassOptics {
  if (!mods.reduceTransparency && !mods.increaseContrast) return optics;
  const out = { ...optics };
  if (mods.reduceTransparency) {
    out.blur = Math.max(out.blur, FROST_MIN_DP);
    out.bodyDensity = Math.max(out.bodyDensity, OBSCURE_MIN);
  }
  if (mods.increaseContrast) {
    // Граница держится различимостью силуэта (`presence`), а не заливкой тела: заливка гасит
    // контент, а требование эталона — именно контрастный контур вокруг детали.
    out.bodyDensity = Math.max(out.bodyDensity, CONTRAST_DENSITY);
    out.presence = Math.max(out.presence, CONTRAST_PRESENCE);
    out.legibility = 1;
  }
  return out;
}
