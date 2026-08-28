import type { ComponentType, ReactNode } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
// Через `expo`, а не напрямую из `expo-modules-core`: последний в этой раскладке —
// транзитивная зависимость, и pnpm её не поднимает в node_modules приложения.
import { requireNativeModule, requireNativeView } from 'expo';

export type GlassLensProps = {
  /** Радиус ВИДИМОГО круга в dp. Сама вьюха обязана быть заметно больше него: шейдер у кромки
   *  тянется за пределы круга (`edgeReach`), и без запаса ему там нечего семплировать. */
  lensRadius: number;
  /** Доля радиуса, занятая фаской. Должна совпадать с `BEVEL` шейдера поверхности, иначе
   *  оптика подложки и нарисованная поверх кромка описывают разные стёкла. */
  bevel?: number;
  /** Увеличение в плоской середине — толщина стекла. */
  magnify?: number;
  /** Докуда дотягивается выборка у самой кромки, в долях радиуса (>1 — видно то, что за
   *  пределами круга, сжатое в тонкое кольцо). */
  edgeReach?: number;
  /** Хроматическая аберрация: расхождение каналов на кромке, dp. */
  chroma?: number;
  /** Сферическая аберрация: размазывание выборки на кромке, dp. */
  spherical?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

const native = (() => {
  if (Platform.OS !== 'android') return null;
  try {
    const view = requireNativeView('GlassLens', 'GlassLensView') as ComponentType<GlassLensProps>;
    const constants = requireNativeModule('GlassLens') as { isSupported?: boolean };
    return { view, supported: constants.isSupported === true };
  } catch (e) {
    console.warn("GlassLens: нативная вьюха не загрузилась", e);
    return null;
  }
})();

/** `RenderEffect.createRuntimeShaderEffect` — Android 13+. Ниже вызывающий обязан остаться на
 *  прежнем аффинном увеличении: вьюха там работает обычным контейнером. */
export const isGlassLensSupported: boolean = native?.supported ?? false;

export const GlassLens: ComponentType<GlassLensProps> | null = native?.view ?? null;
