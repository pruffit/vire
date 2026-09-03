import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type View as RNView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassPanel } from '../ui/glass-panel';
import { useGlassInk } from '../../lib/vireglass/glass-ink';
import { useReduceMotion } from '../../lib/design/preferences';
import { colors } from '../../lib/theme';
import { fonts } from '../../lib/design/typography';
import { radii, space } from '../../lib/design/scales';
import { VIREGLASS_LYRICS_MATERIAL } from '../../lib/vireglass/material';
import type { LyricLine } from '../../lib/playback/use-lyrics';

/** Мягкая кромка окна: строка, обрезанная посередине глифа, читается сломанной вёрсткой. */
const FADE = 44;
/** Пустая строка в LRC — цезура между куплетами, а не строка: полная высота рвала бы окно. */
const BREAK_HEIGHT = 14;
/** Доля высоты окна, на которой держится звучащая строка: выше середины, чтобы следующие
 *  строки были видны заранее. */
const ACTIVE_ANCHOR = 0.36;
const IDLE_ALPHA = 0.42;
/** До первой строки вести нечем: приглушать до IDLE нельзя — текст перестаёт читаться,
 *  оставлять в полную силу тоже: стена одинаково ярких строк. */
const PENDING_ALPHA = 0.8;
/** Пауза автопрокрутки после того, как список листнули рукой. */
const MANUAL_HOLD_MS = 5000;

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
}: {
  lines: LyricLine[];
  activeIndex: number;
  /** Есть таймкоды: строку ведёт воспроизведение, по ней же перематывают. */
  synced: boolean;
  onSeek: (sec: number) => void;
  blurTarget: RefObject<RNView | null>;
}) {
  return (
    <GlassPanel
      radius={radii.card}
      blurTarget={blurTarget}
      material={VIREGLASS_LYRICS_MATERIAL}
      topLayer
      style={styles.panel}
      contentStyle={styles.content}
    >
      <Body lines={lines} activeIndex={activeIndex} synced={synced} onSeek={onSeek} />
    </GlassPanel>
  );
}

/** Полярность надписей раздаёт сама панель — читать её можно только из её детей. */
function Body({
  lines,
  activeIndex,
  synced,
  onSeek,
}: {
  lines: LyricLine[];
  activeIndex: number;
  synced: boolean;
  onSeek: (sec: number) => void;
}) {
  const ink = useGlassInk();
  const reduceMotion = useReduceMotion();
  // В полюс, а не смешением: inkColor между полюсами отдаёт средне-серый, и над пёстрой
  // обложкой, где адаптация садится посередине, строка выходила буквально серой.
  const text = ink > 0.5 ? colors.foreground : DARK_INK;
  const shadow = ink > 0.5 ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.85)';
  const edge = ink > 0.5 ? '9,8,7' : '234,231,226';
  const fade = [`rgba(${edge},0.7)`, `rgba(${edge},0)`] as const;

  const scroll = useRef<ScrollView>(null);
  const lineTops = useRef<number[]>([]);
  const manualUntil = useRef(0);
  // Высота окна — состояние, а не ref: на паузе активная строка не меняется, и эффект,
  // завязанный только на неё, после первого layout'а больше не запускался бы вовсе.
  const [viewport, setViewport] = useState(0);

  const onLineLayout = useCallback((index: number, e: LayoutChangeEvent) => {
    lineTops.current[index] = e.nativeEvent.layout.y;
  }, []);

  useEffect(() => {
    if (!synced || activeIndex < 0 || Date.now() < manualUntil.current) return;
    const top = lineTops.current[activeIndex];
    if (top === undefined || viewport === 0) return;
    scroll.current?.scrollTo({ y: Math.max(0, top - viewport * ACTIVE_ANCHOR), animated: !reduceMotion });
  }, [synced, activeIndex, viewport, reduceMotion]);

  return (
    <>
      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setViewport((prev) => (prev === h ? prev : h));
        }}
        onScrollBeginDrag={() => {
          manualUntil.current = Date.now() + MANUAL_HOLD_MS;
        }}
        contentContainerStyle={[styles.lines, synced && styles.linesSynced]}
      >
        {lines.map((line, i) =>
          line.text ? (
            <Text
              key={i}
              onLayout={(e) => onLineLayout(i, e)}
              onPress={synced && line.t !== null ? () => onSeek(line.t!) : undefined}
              style={[
                synced ? styles.synced : styles.plain,
                { color: text, textShadowColor: shadow },
                synced && i !== activeIndex && (activeIndex >= 0 ? styles.idle : styles.pending),
              ]}
            >
              {line.text}
            </Text>
          ) : (
            <View key={i} onLayout={(e) => onLineLayout(i, e)} style={styles.break} />
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
  content: { flex: 1, overflow: 'hidden', borderRadius: radii.card },
  // Отступ по вертикали в высоту вуали: иначе она гасит саму звучащую строку, когда та
  // стоит у края окна.
  lines: { paddingHorizontal: space.lg, paddingVertical: FADE },
  linesSynced: { paddingHorizontal: space.xl },

  /** Синхронный текст ведёт воспроизведение — он крупный и по центру, как в караоке. */
  synced: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 34,
    letterSpacing: -0.3,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  /** Без таймкодов вести нечего: это просто текст песни — мельче, влево, с прокруткой. */
  plain: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 26,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  /** Соседние строки не исчезают, а отступают: контекст песни остаётся читаемым. До
   *  первой строки приглушены все — иначе текст встречает стеной одинаково ярких строк. */
  idle: { opacity: IDLE_ALPHA },
  pending: { opacity: PENDING_ALPHA },
  break: { height: BREAK_HEIGHT },
  fade: { position: 'absolute', left: 0, right: 0, height: FADE },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
});
