import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type View as RNView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassPanel } from '../ui/glass-panel';
import { useGlassInk, inkColor } from '../../lib/vireglass/glass-ink';
import { useReduceMotion } from '../../lib/design/preferences';
import { Icon } from '../../lib/icon';
import { colors } from '../../lib/theme';
import { fonts } from '../../lib/design/typography';
import { radii, space } from '../../lib/design/scales';
import type { LyricLine } from '../../lib/playback/use-lyrics';

/** Затемнение линзы под текстом — заметно выше продуктового (0.2): строки лежат прямо на
 *  обложке, и её светлые куски съедают белый текст раньше, чем это случилось бы на фоне
 *  экрана. Преломление на этом уровне ещё отчётливо видно; выше — панель теряет материал. */
const LYRICS_DIM = 0.52;
/** Мягкая кромка окна: строка, обрезанная посередине глифа, читается сломанной вёрсткой. */
const FADE = 26;
const LINE_SIZE = 20;
const LINE_HEIGHT = 29;
/** Пустая строка в LRC — цезура между куплетами, а не строка: полная высота рвала бы окно. */
const BREAK_HEIGHT = 12;
/** Доля высоты окна, на которой держится звучащая строка: выше середины, чтобы следующие
 *  строки были видны заранее. */
const ACTIVE_ANCHOR = 0.3;
const IDLE_ALPHA = 0.7;
/** Пауза автопрокрутки после того, как список листнули рукой. */
const MANUAL_HOLD_MS = 5000;
const CHEVRON = 30;

const DARK_INK = '#0b0908';

/**
 * Текст трека на стекле поверх обложки.
 *
 * Это единственное место в плеере, где стекло стоит на насыщенном фоне, — и единственное,
 * где материал вообще имеет смысл: на плоской подложке преломлять нечего.
 *
 * Свёрнутая полоса не перехватывает касания (`box-none`), кроме своей кнопки: она лежит
 * НЕ внутри прокрутки экрана (цель преломления не может быть предком стекла), и всё, что
 * она поймает, до страницы уже не дойдёт.
 */
export function LyricsGlass({
  lines,
  activeIndex,
  expanded,
  onToggle,
  onSeek,
  blurTarget,
}: {
  lines: LyricLine[];
  activeIndex: number;
  expanded: boolean;
  onToggle: () => void;
  onSeek: (sec: number) => void;
  blurTarget: RefObject<RNView | null>;
}) {
  return (
    <GlassPanel
      radius={radii.glass}
      blurTarget={blurTarget}
      dim={LYRICS_DIM}
      topLayer
      style={styles.panel}
      contentStyle={styles.content}
    >
      <Body lines={lines} activeIndex={activeIndex} expanded={expanded} onToggle={onToggle} onSeek={onSeek} />
    </GlassPanel>
  );
}

/** Полярность надписей раздаёт сама панель — читать её можно только из её детей. */
function Body({
  lines,
  activeIndex,
  expanded,
  onToggle,
  onSeek,
}: {
  lines: LyricLine[];
  activeIndex: number;
  expanded: boolean;
  onToggle: () => void;
  onSeek: (sec: number) => void;
}) {
  const ink = useGlassInk();
  const reduceMotion = useReduceMotion();
  const text = inkColor(ink, colors.foreground, DARK_INK);
  const shadow = ink > 0.5 ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.85)';
  const edge = ink > 0.5 ? '9,8,7' : '234,231,226';
  const fade = [`rgba(${edge},0.8)`, `rgba(${edge},0)`] as const;

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
    if (activeIndex < 0 || Date.now() < manualUntil.current) return;
    const top = lineTops.current[activeIndex];
    if (top === undefined || viewport === 0) return;
    scroll.current?.scrollTo({ y: Math.max(0, top - viewport * ACTIVE_ANCHOR), animated: !reduceMotion });
  }, [activeIndex, expanded, viewport, reduceMotion]);

  return (
    <>
      <ScrollView
        ref={scroll}
        scrollEnabled={expanded}
        // Свёрнутая полоса не должна съедать вертикальный свайп: под ней прокрутка страницы,
        // а сама она в этом состоянии не листается.
        pointerEvents={expanded ? 'auto' : 'none'}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          setViewport((prev) => (prev === h ? prev : h));
        }}
        onScrollBeginDrag={() => {
          manualUntil.current = Date.now() + MANUAL_HOLD_MS;
        }}
        contentContainerStyle={styles.lines}
      >
        {lines.map((line, i) =>
          line.text ? (
            <Text
              key={i}
              onLayout={(e) => onLineLayout(i, e)}
              onPress={expanded && line.t !== null ? () => onSeek(line.t!) : undefined}
              style={[
                styles.line,
                { color: text, textShadowColor: shadow },
                i === activeIndex ? styles.lineActive : activeIndex >= 0 && styles.lineIdle,
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

      <Pressable
        onPress={onToggle}
        hitSlop={12}
        style={styles.chevron}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Свернуть текст' : 'Развернуть текст'}
      >
        <View style={expanded ? undefined : styles.chevronUp}>
          <Icon name="chevron-down" size={18} color={text} />
        </View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1 },
  content: { flex: 1, overflow: 'hidden', borderRadius: radii.glass },
  lines: { paddingHorizontal: space.lg, paddingVertical: space.md, paddingRight: CHEVRON + space.lg },
  line: {
    fontFamily: fonts.bold,
    fontSize: LINE_SIZE,
    lineHeight: LINE_HEIGHT,
    letterSpacing: -0.2,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 11,
  },
  /** Звучащая строка — единственная в полную силу; тень отделяет её от обложки. */
  lineActive: { textShadowRadius: 13 },
  /** Соседние строки не исчезают, а отступают: контекст песни остаётся читаемым. */
  lineIdle: { opacity: IDLE_ALPHA },
  break: { height: BREAK_HEIGHT },
  fade: { position: 'absolute', left: 0, right: 0, height: FADE },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
  chevron: {
    position: 'absolute',
    top: space.xs,
    right: space.xs,
    width: CHEVRON,
    height: CHEVRON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronUp: { transform: [{ rotate: '180deg' }] },
});
