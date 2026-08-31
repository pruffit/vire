import type { ComponentType, ReactNode } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
// Через `expo`, а не напрямую из `expo-modules-core`: последний в этой раскладке —
// транзитивная зависимость, и pnpm её не поднимает в node_modules приложения.
import { requireNativeModule, requireNativeView } from 'expo';

/**
 * Пропы нативной линзы. Имена ОБЯЗАНЫ совпадать с `Prop("…")` в `GlassLensModule.kt`:
 * неизвестный проп Expo проглатывает молча, и линза просто не включается — так преломление
 * и оказалось выключенным в проде целую фазу. Паритет закреплён тестом
 * `lib/__tests__/vireglass-material.test.ts`.
 *
 * Значения материала сюда не собираются вручную — их даёт `toLensProps`
 * (`lib/vireglass/adapters.ts`).
 */
export type GlassLensProps = {
  /** Тег GlassBackdrop, чей снимок кадра линза кладёт под преломление. */
  backdropId?: number | null;
  /** Исходник AGSL. Собирается в JS, чтобы геометрия у линзы и поверхности была одной строкой. */
  shaderSource: string;
  /** Размер ВИДИМОГО стекла в dp. Сама вьюха обязана быть больше него: у кромки выборка
   *  уходит наружу (edgePush), и без запаса шейдеру там нечего семплировать. По этому же
   *  габариту берётся прямоугольник зонда светлоты. */
  glassWidth: number;
  glassHeight: number;
  /** Униформы материала одним каналом (`toLensProps`): имя ↔ размер ↔ значения. Раньше на
   *  каждую величину был свой проп, и опечатка молча выключала линзу целиком. */
  uniformNames: string[];
  uniformSizes: number[];
  uniformValues: number[];
  /** Светлота, пестрота и средний цвет фона ПОД стеклом. Приложение слушает это, чтобы
   *  перекрасить надпись, когда стекло уже отработало свой предел. */
  onBackdropSample?: (e: {
    nativeEvent: {
      luma: number;
      busy: number;
      lo: number;
      hi: number;
      r: number;
      g: number;
      b: number;
    };
  }) => void;
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
    console.warn('GlassLens: нативная вьюха не загрузилась', e);
    return null;
  }
})();

export type GlassBackdropProps = { style?: StyleProp<ViewStyle>; children?: ReactNode };

/**
 * Захват фона БЕЗ размытия. expo-blur отдаёт дизеренную копию: на Android 13+ он гонит
 * захват через createBlurEffect, а Skia дизерит выход блюра (замеры — docs/vireglass).
 */
export const GlassBackdrop: ComponentType<GlassBackdropProps> | null =
  Platform.OS === 'android'
    ? (() => {
        try {
          return requireNativeView('GlassLens', 'GlassBackdropView') as ComponentType<GlassBackdropProps>;
        } catch {
          return null;
        }
      })()
    : null;

/** Диагностический зонд: что именно приходит в createRuntimeShaderEffect.
 *  Только для стенда (screens/glass-lab), в продовом UI не используется. */
export type GlassProbeProps = {
  /** 0 — сырая выборка, 1 — выборка + маркер живости шейдера, 2 — карта альфы. */
  mode?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export const GlassProbe: ComponentType<GlassProbeProps> | null =
  Platform.OS === 'android'
    ? (() => {
        try {
          return requireNativeView('GlassLens', 'GlassProbeView') as ComponentType<GlassProbeProps>;
        } catch {
          return null;
        }
      })()
    : null;

/** `RenderEffect.createRuntimeShaderEffect` — Android 13+. Ниже вызывающий обязан остаться на
 *  прежнем аффинном увеличении: вьюха там работает обычным контейнером. */
export const isGlassLensSupported: boolean = native?.supported ?? false;

export const GlassLens: ComponentType<GlassLensProps> | null = native?.view ?? null;
