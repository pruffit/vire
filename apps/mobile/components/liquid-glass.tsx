import { useCallback, useEffect, useId, useMemo, useRef, type RefObject } from 'react';
import { PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  type SkCanvas,
  type SkImage,
  type SkPaint,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { ICON_PATHS, type IconName } from '../lib/icon';
import { colors } from '../lib/theme';
import { VireGlassSurface } from './vireglass/glass-surface';
import { circleGeometry, roundedRectGeometry, surfacePadDp } from '../lib/vireglass/geometry';
import { createDeform, type DeformSample } from '../lib/vireglass/touch-response';
import { useGlassAdaptation, type BackdropSample } from '../lib/vireglass/adaptation';
import { useGlassGroup } from '../lib/vireglass/glass-group';
import { inkColor } from '../lib/vireglass/glass-ink';
import { useEnvironmentLight } from '../lib/vireglass/environment';
import {
  activeMaterial,
  resolveMaterial,
  resolveOptics,
  type VireGlassDebugMode,
  type VireGlassMaterial,
  type VireGlassOptics,
} from '../lib/vireglass/material';

const DEFAULT_OPTICS = resolveOptics();

/** Тёмный конец шкалы штриха. Кит держит светлый текст на `colors.foreground`; для
 *  обратной полярности нужен такой же «почти, но не совсем» тёмный. */
const INK_ON_LIGHT = '#14120f';

/** Ход тяги как доля МЕНЬШЕГО полуразмера — величина ядра, общая с вебом. */
const PULL_LIMIT_RATIO = 0.14;
const TAP_SLOP = 10;
/** Амплитуды волны от касания и от отрыва (`rnd-src/main.ts`). */
const WAVE_ON_TOUCH = 4;
const WAVE_ON_RELEASE = 2.5;

/** Покой: тем же набором ядро отдаёт неподвижную деталь. */
const REST_SAMPLE: DeformSample = {
  touchX: 0, touchY: 0, pullX: 0, pullY: 0, press: 0, active: 0, waveAmp: 0, wavePhase: 0,
};

/** Отдача в руку. Стекло — материал, а не картинка: касание обязано ощущаться, иначе
 *  вся упругость остаётся только на экране. Сбой тактильного движка глушим: на части
 *  устройств его нет вовсе, и падать из-за этого кнопка не должна. */
function tick(style: Haptics.ImpactFeedbackStyle) {
  Haptics.impactAsync(style).catch(() => {});
}

function rgba(hex: string): number[] {
  const v = hex.replace('#', '');
  const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}

/** Иконка — маска в пикселях устройства (в dp мылила на 3x-экранах): белый штрих в зелёном
 *  канале, размытый красный ореол под ним — в альфе. Цвет штриха берётся в шейдере, поэтому
 *  активное состояние переходит плавно и не требует второго изображения. */
function useMask(
  boxW: number,
  boxH: number,
  dpr: number,
  paint: ((canvas: SkCanvas, boxW: number, boxH: number) => void) | null,
): SkImage | null {
  return useMemo(() => {
    if (!paint) return null;
    const surface = Skia.Surface.MakeOffscreen(Math.round(boxW * dpr), Math.round(boxH * dpr));
    if (!surface) return null;
    const canvas = surface.getCanvas();
    canvas.scale(dpr, dpr);
    paint(canvas, boxW, boxH);
    surface.flush();
    // Снимок offscreen-поверхности GPU-текстурный и привязан к контексту JS-потока —
    // на рендер-треде Skia он невалиден, поэтому копируем в CPU-образ.
    const snap = surface.makeImageSnapshot();
    return snap.makeNonTextureImage() ?? snap;
  }, [boxW, boxH, dpr, paint]);
}

/** Штрих краски: один и тот же для значка и для витринной надписи. */
export function inkStroke(width: number): SkPaint {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color('white'));
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(width);
  paint.setStrokeCap(StrokeCap.Round);
  paint.setStrokeJoin(StrokeJoin.Round);
  paint.setAntiAlias(true);
  return paint;
}

/**
 * Значок в маску краски, левым верхним углом в (left, top).
 *
 * Один штрих и ничего под ним. Размытая тёмная подложка, которая тут стояла, читалась
 * грязным свечением вокруг каждого значка; разводить светлоту обязано тело стекла.
 */
export function paintIcon(
  canvas: SkCanvas,
  name: IconName,
  iconSize: number,
  left: number,
  top: number,
): void {
  const { translate, d } = ICON_PATHS[name];
  const scale = iconSize / 36;
  const path = Skia.Path.Make();
  d.forEach((segment) => {
    const p = Skia.Path.MakeFromSVGString(segment);
    if (p) path.addPath(p);
  });
  const m = Skia.Matrix();
  m.translate(left, top);
  m.scale(scale, scale);
  m.translate(translate[0], translate[1]);
  path.transform(m);
  canvas.drawPath(path, inkStroke(2.75 * scale));
}

function useIconPainter(
  name: IconName | undefined,
  iconSize: number,
): ((canvas: SkCanvas, boxW: number, boxH: number) => void) | null {
  return useMemo(() => {
    if (!name) return null;
    return (canvas, boxW, boxH) =>
      paintIcon(canvas, name, iconSize, (boxW - iconSize) / 2, (boxH - iconSize) / 2);
  }, [name, iconSize]);
}

export function LiquidGlassButton({
  size,
  width,
  radius,
  icon,
  paintMask,
  paintOverlay,
  progress,
  active = false,
  onPress,
  onFling,
  blurTarget,
  ink,
  inkActive,
  material,
  optics: opticsProp = DEFAULT_OPTICS,
  dim = 0,
  topLayer = false,
  debug,
  style,
}: {
  /** Высота детали. Без `width` она же и ширина — деталь круглая. */
  size: number;
  /** Ширина: задана — деталь капсула, а не круг. Геометрия у ядра уже есть
   *  (`roundedRectGeometry`), к квадрату была привязана только эта кнопка. */
  width?: number;
  radius?: number;
  icon?: IconName;
  /** Своя краска вместо значка: та же маска ВНУТРИ материала, но нарисованная вызывающим —
   *  знаком и надписью, как «ПОТОК». Со значком взаимоисключающа. */
  paintMask?: (canvas: SkCanvas, boxW: number, boxH: number) => void;
  /** Цветной слой НА стекле в той же коробке, что и маска: обложка мини-плеера. Маска несёт
   *  один канал и красится полярностью — цвету в ней взяться неоткуда (веб — то же деление). */
  paintOverlay?: (canvas: SkCanvas, boxW: number, boxH: number) => void;
  /** Сыгранная доля, 0…1: слева от границы деталь активна. Так прогресс показывает само
   *  стекло мини-плеера, а не полоска поверх него. */
  progress?: SharedValue<number>;
  /** Активность 0…1, а не флаг: в ядре это доля, и деталь может стоять в ПОКОЕ
   *  полуактивной — так главное действие экрана отличается от рядовых, оставаясь тем же
   *  материалом. Меняет материал именно состояние, а не роль (). */
  active?: boolean | number;
  /** Тап. Координата — ЛОКАЛЬНАЯ, от левого верхнего угла детали: на широкой плашке от неё
   *  зависит, что нажали (веб — `hitPlay` в `rnd-src/mini-player.ts`). */
  onPress?: (local: { x: number; y: number }) => void;
  /** Бросок пальцем: смещение за жест, dp. Тап при этом не срабатывает — он ограничен слопом. */
  onFling?: (dx: number, dy: number) => void;
  /** Цель живого блюра — контент текущего экрана (lib/blur-target.tsx). */
  blurTarget?: RefObject<View | null> | null;
  /** Цвет штриха. Не задан — кнопка ведёт его сама по тому, что лежит под стеклом:
   *  над светлой обложкой иконка темнеет, над тёмным списком светлеет. */
  ink?: string;
  inkActive?: string;
  /** Материал детали — ПРИЧИНЫ. Активное состояние собирается из него ядром
   *  (`activeMaterial`): это более плотное и чистое стекло, а не подсветка поверх прежнего.
   *  Передавать константу модуля. */
  material?: VireGlassMaterial;
  optics?: VireGlassOptics;
  /** Затемнение линзы под скрим экрана. */
  dim?: number;
  /** Деталь ВЕРХНЕГО слоя. Экран-оверлей глушит живой бэкдроп у всего, что под ним, — и у
   *  своих собственных деталей тоже, если они об этом не заявили. Без бэкдропа линза не
   *  рисуется вовсе: остаётся тёмная плашка без кромки. */
  topLayer?: boolean;
  /** Только для разбора материала: продукт всегда рисует 'normal'. */
  debug?: VireGlassDebugMode;
  style?: StyleProp<ViewStyle>;
}) {
  const dpr = PixelRatio.get();
  const activeLevel = typeof active === 'number' ? active : active ? 1 : 0;
  // Полярность штриха ведёт сама кнопка: только она видит, что под ней лежит. Явно
  // заданный цвет её отключает — вызывающий знает свой контент лучше.
  const auto = ink === undefined && inkActive === undefined;
  // Внутри группы решение о полярности и оценка фона общие на весь блок: у каждой кнопки
  // под собой свой кусок фона, и по своему замеру одна уходит в тень, а соседняя остаётся
  // прозрачной — блок разваливается на отдельные детали.
  const group = useGlassGroup();
  const adaptation = useGlassAdaptation(opticsProp, { enabled: auto && group === null });
  const id = useId();
  const at = useRef({ x: 0, y: 0 });
  const inkValue = group?.ink ?? adaptation.ink;

  // Колбэк держится за сами методы, а не за объекты адаптации и группы: те пересоздаются на
  // каждом замере, и проп нативной вьюхи менялся бы впустую по нескольку раз в секунду.
  const { onBackdropSample } = adaptation;
  const report = group?.report;
  // Замер, пришедший после снятия участника, вернул бы размонтированную кнопку в оценку
  // блока навсегда: снимать её второй раз уже некому.
  const mounted = useRef(true);
  const onSample = useCallback(
    (e: { nativeEvent: BackdropSample }) => {
      if (!mounted.current) return;
      if (report) report(id, at.current.x, at.current.y, e.nativeEvent, opticsProp.legibility);
      else onBackdropSample(e);
    },
    [report, id, onBackdropSample, opticsProp.legibility],
  );

  const release = group?.release;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (release) release(id);
    };
  }, [release, id]);

  // Активное состояние — СМЕНА МАТЕРИАЛА, как в стенде: толще тело, шире фаска, чище
  // поверхность. Поднимать один `u_active` значит собирать подсветку без причины, и на
  // кадре состояние почти не читается.
  const baseOptics = useMemo(
    () => (material ? resolveOptics(activeMaterial(resolveMaterial(material), activeLevel)) : opticsProp),
    [material, activeLevel, opticsProp],
  );
  const optics = useMemo(
    () => (auto ? { ...baseOptics, ink: inkValue } : baseOptics),
    [baseOptics, auto, inkValue],
  );
  const strokeIdle = ink ?? inkColor(inkValue, colors.foreground, INK_ON_LIGHT);
  const strokeActive = inkActive ?? strokeIdle;
  const geometry = useMemo(
    () =>
      width === undefined
        ? circleGeometry(size)
        : roundedRectGeometry(width, size, radius ?? size / 2),
    [width, size, radius],
  );
  // Ход тяги — доля МЕНЬШЕГО полуразмера, как в вебе (`rnd-src/main.ts`). Здесь стояло
  // `0.62 * size` — почти вдевятеро больше: тянули не поле вокруг пальца, а всю деталь.
  const dragLimit = PULL_LIMIT_RATIO * (Math.min(width ?? size, size) / 2);
  const pad = surfacePadDp(geometry, dragLimit);
  // Коробка маски — ровно холст поверхности: краска обязана лечь в тех же координатах,
  // в каких шейдер её семплирует. Раньше она была квадратной по высоте, и на капсуле
  // краска уехала бы.
  const iconPainter = useIconPainter(icon, Math.round(size * 0.42));
  const boxW = (width ?? size) + pad * 2;
  const boxH = size + pad * 2;
  const mask = useMask(boxW, boxH, dpr, paintMask ?? iconPainter);
  const overlay = useMask(boxW, boxH, dpr, paintOverlay ?? null);

  // Отклик — ИЗ ЯДРА. Пружины описывают, какова среда на ощупь, ровно как ior описывает её
  // на просвет; держать их у потребителя значит иметь на вебе и на Android два разных
  // стекла под одним именем. Свои `DRAG_SPRING/RELEASE_SPRING/pull()` отсюда убраны.
  const deform = useMemo(() => createDeform(), []);
  const touch = useSharedValue<DeformSample>(REST_SAMPLE);
  const lit = useSharedValue(activeLevel);
  /** Наследие прежней модели: поверхность всё ещё принимает сдвиг и нажатие отдельным
   *  каналом. Держим их в нуле — деформацию теперь целиком ведёт `touch`. */
  const zero = useSharedValue(0);
  const light = useEnvironmentLight(optics.environment);
  useEffect(() => {
    lit.value = withTiming(activeLevel, { duration: 240 });
  }, [activeLevel, lit]);

  const iconLayer = useMemo(
    () => ({
      image: mask,
      overlay,
      scale: dpr,
      inkIdle: rgba(strokeIdle),
      inkActive: rgba(strokeActive),
    }),
    [mask, overlay, dpr, strokeIdle, strokeActive],
  );

  // Кадры крутятся только пока деталь не успокоилась — ровно как `wake()` в вебе. Шаг
  // интегрирования ядро добирает подшагами само, поэтому редкий кадр отклик не замедляет.
  const running = useRef(false);
  const wake = useCallback(() => {
    if (running.current) return;
    running.current = true;
    let last = Date.now();
    const frame = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      deform.step(dt);
      touch.value = deform.sample();
      if (deform.idle()) {
        running.current = false;
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [deform, touch]);

  // Pan отвечает только за деформацию и на коротком тапе может вообще не активироваться,
  // поэтому нажатие — отдельный Tap, идущий одновременно с ним.
  const gesture = useMemo(() => {
    // runOnJS обязателен: ворклет-колбэки Pan в связке RNGH 2.32 + reanimated 4 молча не
    // выполняются (Tap при этом работает). Пружины всё равно крутятся на UI-потоке.
    const drag = Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((e) => {
        // Точка касания — ОТ ЦЕНТРА детали: поле гнётся вокруг неё, а не деталь целиком.
        deform.grab(e.x - (width ?? size) / 2, e.y - size / 2, WAVE_ON_TOUCH);
        tick(Haptics.ImpactFeedbackStyle.Light);
        wake();
      })
      .onChange((e) => {
        deform.drag(e.translationX, e.translationY, dragLimit);
        wake();
      })
      .onEnd((e) => {
        if (onFling) onFling(e.translationX, e.translationY);
      })
      .onFinalize(() => {
        deform.release(WAVE_ON_RELEASE);
        wake();
      });

    const tap = Gesture.Tap()
      .maxDistance(TAP_SLOP)
      .onEnd((e) => {
        // Вторая отдача — на срабатывании, и она заметнее первой: касание и действие это
        // разные события, и различать их на ощупь важнее, чем экономить вибрацию.
        runOnJS(tick)(Haptics.ImpactFeedbackStyle.Medium);
        if (onPress) runOnJS(onPress)({ x: e.x, y: e.y });
      });

    return Gesture.Simultaneous(drag, tap);
  }, [onPress, onFling, deform, wake, dragLimit, width, size]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        style={[styles.host, style]}
        onLayout={(e) => {
          // Место кнопки в блоке: по нему группа строит плоскость светлоты, чтобы блок
          // темнел градиентно, а не ступенями по кнопкам.
          const { x, y, width: w, height: h } = e.nativeEvent.layout;
          at.current = { x: x + w / 2, y: y + h / 2 };
        }}
      >
        <VireGlassSurface
          geometry={geometry}
          optics={optics}
          dynamics={{ shiftX: zero, shiftY: zero, press: zero, active: lit, light }}
          touch={touch}
          progress={progress}
          blurTarget={blurTarget}
          dragLimit={dragLimit}
          icon={iconLayer}
          dim={dim}
          topLayer={topLayer}
          debug={debug ?? 'normal'}
          onBackdropSample={auto ? onSample : undefined}
        />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  host: { overflow: 'visible' },
});
