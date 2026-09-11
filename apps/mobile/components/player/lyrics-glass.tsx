import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type View as RNView,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassPanel } from '../ui/glass-panel';
import { useGlassInk } from '../../lib/vireglass/glass-ink';
import { colors } from '../../lib/theme';
import { fonts } from '../../lib/design/typography';
import { space, motionDuration } from '../../lib/design/scales';
import { useMockMaterial } from '../../lib/design/mock';
import { useReduceMotion } from '../../lib/design/preferences';
import { VIREGLASS_LYRICS_MATERIAL } from '../../lib/vireglass/material';
import type { LyricLine } from '../../lib/playback/use-lyrics';

/** Мягкая кромка окна: строка, обрезанная посередине глифа, читается сломанной вёрсткой. */
const FADE = 44;
/** Пустая строка в LRC — цезура между куплетами, а не строка: полная высота рвала бы окно. */
const BREAK_HEIGHT = 14;
/** Насколько отступают соседние строки. Не прячем: по следующей ведут взгляд вперёд,
 *  прошедшая держит контекст. Разницу «где сейчас» несёт РАЗМЕР, а не только светлота. */
const NEXT_ALPHA = 0.55;
const PAST_ALPHA = 0.32;

const DARK_INK = '#0b0908';

/**
 * Текст трека на стекле поверх обложки — во всю её ширину и высоту.
 *
 * Это единственное место в плеере, где стекло стоит на насыщенном фоне, и единственное,
 * где материал вообще имеет смысл: на плоской подложке преломлять нечего.
 *
 * Панель лежит НЕ внутри прокрутки экрана — цель преломления не может быть предком стекла
 * (`lib/blur-target.tsx`), поэтому она стоит по замеренной рамке обложки и едет за
 * прокруткой трансформом.
 */
export function LyricsGlass({
  lines,
  activeIndex,
  synced,
  onSeek,
  blurTarget,
  radius,
}: {
  lines: LyricLine[];
  activeIndex: number;
  /** Есть таймкоды: строку ведёт воспроизведение. */
  synced: boolean;
  onSeek: (sec: number) => void;
  blurTarget: RefObject<RNView | null>;
  /** Радиус обложки под панелью — снаружи, из того же числа, что и у неё самой. */
  radius: number;
}) {
  // Панель растянута в размер обложки (на аппарате — больше тысячи пикселей), и без
  // масштаба макетная фаска отдаёт кромке втрое меньшую долю полуразмера, чем нарисовано.
  const material = useMockMaterial(VIREGLASS_LYRICS_MATERIAL);

  return (
    <GlassPanel
      radius={radius}
      blurTarget={blurTarget}
      material={material}
      topLayer
      style={styles.panel}
      contentStyle={[styles.content, { borderRadius: radius }]}
    >
      {synced ? (
        <Synced lines={lines} activeIndex={activeIndex} />
      ) : (
        <Plain lines={lines} onSeek={onSeek} />
      )}
    </GlassPanel>
  );
}

/** Ближайшая непустая строка начиная с `from`; пустые в LRC — цезуры, а не строки. */
function nextText(lines: LyricLine[], from: number): string | null {
  for (let i = Math.max(0, from); i < lines.length; i += 1) {
    if (lines[i].text) return lines[i].text;
  }
  return null;
}

/** Ближайшая непустая строка ВЫШЕ `from`. */
function prevText(lines: LyricLine[], from: number): string | null {
  for (let i = Math.min(from, lines.length - 1); i >= 0; i -= 1) {
    if (lines[i].text) return lines[i].text;
  }
  return null;
}

type LineStack = { past: string | null; current: string | null; upcoming: string | null };

function LineBlock({ stack, tone }: { stack: LineStack; tone: { color: string; textShadowColor: string } }) {
  return (
    <>
      {stack.past && (
        <Text style={[styles.past, tone]} numberOfLines={2}>
          {stack.past}
        </Text>
      )}
      {stack.current && (
        <Text style={[styles.current, tone]} numberOfLines={3}>
          {stack.current}
        </Text>
      )}
      {stack.upcoming && (
        <Text style={[styles.next, tone]} numberOfLines={2}>
          {stack.upcoming}
        </Text>
      )}
    </>
  );
}

/** Сдвиг входящего блока при кросс-фейде смены строки. */
const LINE_SHIFT = 16;

/**
 * Синхронный текст: прошедшая строка, звучащая и следующая.
 *
 * Размер сам говорит, где сейчас песня, — приглушённости для этого мало: на пёстрой обложке
 * она читается как «плохо видно», а не как «уже спето». Прошедшая строка нужна, чтобы
 * звучащая не висела в пустоте и было видно, откуда пришли.
 *
 * Списка целиком здесь нет намеренно: за воспроизведением следят по одной строке, десять
 * приглушённых вокруг превращали панель в стену.
 *
 * Смена строки переливается кросс-фейдом со сдвигом вверх — тот же приём, что у смены
 * трека в `HazeGround`: старый блок живёт вторым слоем только на время перехода.
 */
function Synced({ lines, activeIndex }: { lines: LyricLine[]; activeIndex: number }) {
  const ink = useGlassInk();
  const reduceMotion = useReduceMotion();
  // В полюс, а не смешением: inkColor между полюсами отдаёт средне-серый, и над пёстрой
  // обложкой, где адаптация садится посередине, строка выходила буквально серой.
  const text = ink > 0.5 ? colors.foreground : DARK_INK;
  const shadow = ink > 0.5 ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.85)';
  const tone = { color: text, textShadowColor: shadow };

  // До первой строки ведущей ещё нет — показываем начало текста, а не пустую панель.
  const at = activeIndex >= 0 ? activeIndex : 0;
  const stack: LineStack = {
    past: activeIndex > 0 ? prevText(lines, at - 1) : null,
    current: nextText(lines, at),
    upcoming: nextText(lines, at + 1),
  };

  const previousIndex = useRef(activeIndex);
  const previousStack = useRef(stack);
  const [layers, setLayers] = useState({ from: stack, to: stack });
  const fade = useSharedValue(1);

  useEffect(() => {
    if (previousIndex.current === activeIndex) {
      previousStack.current = stack;
      return;
    }
    const from = previousStack.current;
    previousIndex.current = activeIndex;
    previousStack.current = stack;
    setLayers({ from, to: stack });
    fade.value = 0;
    fade.value = withTiming(1, { duration: motionDuration('panel', reduceMotion) });
  }, [activeIndex, reduceMotion]);

  const crossfading = layers.from !== layers.to;

  const enterStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: (1 - fade.value) * LINE_SHIFT }],
  }));
  const exitStyle = useAnimatedStyle(() => ({
    opacity: 1 - fade.value,
    transform: [{ translateY: -fade.value * LINE_SHIFT }],
  }));

  return (
    <View style={styles.stack}>
      {crossfading && (
        <Animated.View style={[styles.stackLayer, exitStyle]} pointerEvents="none">
          <LineBlock stack={layers.from} tone={tone} />
        </Animated.View>
      )}
      <Animated.View style={[styles.stackLayer, crossfading ? enterStyle : null]}>
        <LineBlock stack={layers.to} tone={tone} />
      </Animated.View>
    </View>
  );
}

/** Без таймкодов вести нечего: это просто текст песни — мельче, влево, с прокруткой. */
function Plain({ lines, onSeek }: { lines: LyricLine[]; onSeek: (sec: number) => void }) {
  const ink = useGlassInk();
  const text = ink > 0.5 ? colors.foreground : DARK_INK;
  const shadow = ink > 0.5 ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.85)';
  const edge = ink > 0.5 ? '9,8,7' : '234,231,226';
  const fade = [`rgba(${edge},0.7)`, `rgba(${edge},0)`] as const;

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.plainBody}>
        {lines.map((line, i) =>
          line.text ? (
            <Text
              key={i}
              onPress={line.t !== null ? () => onSeek(line.t!) : undefined}
              style={[styles.plain, { color: text, textShadowColor: shadow }]}
            >
              {line.text}
            </Text>
          ) : (
            <View key={i} style={styles.break} />
          ),
        )}
      </ScrollView>

      <LinearGradient colors={fade} style={[styles.fade, styles.fadeTop]} pointerEvents="none" />
      <LinearGradient colors={[fade[1], fade[0]]} style={[styles.fade, styles.fadeBottom]} pointerEvents="none" />
    </>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1 },
  content: { flex: 1, overflow: 'hidden' },

  stack: { flex: 1 },
  stackLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  /** Витринный гротеск: строка песни — не интерфейс, ей можно и нужно иметь лицо. */
  past: {
    fontFamily: fonts.displayBold,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    opacity: PAST_ALPHA,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  current: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.3,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 14,
  },
  next: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    opacity: NEXT_ALPHA,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },

  // Отступ по вертикали в высоту вуали: иначе она гасит крайние строки.
  plainBody: { paddingHorizontal: space.lg, paddingVertical: FADE },
  plain: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 26,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  break: { height: BREAK_HEIGHT },
  fade: { position: 'absolute', left: 0, right: 0, height: FADE },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
});
