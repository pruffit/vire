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
import { colors } from '../../lib/theme';
import { fonts } from '../../lib/design/typography';
import { radii, space } from '../../lib/design/scales';
import { VIREGLASS_LYRICS_MATERIAL } from '../../lib/vireglass/material';
import type { LyricLine } from '../../lib/playback/use-lyrics';

/** Мягкая кромка окна: строка, обрезанная посередине глифа, читается сломанной вёрсткой. */
const FADE = 44;
/** Пустая строка в LRC — цезура между куплетами, а не строка: полная высота рвала бы окно. */
const BREAK_HEIGHT = 14;
/** Насколько отступает следующая строка. Не прячем её: по ней ведут глазами вперёд. */
const NEXT_ALPHA = 0.52;

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
  /** Есть таймкоды: строку ведёт воспроизведение. */
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

/**
 * Синхронный текст: звучащая строка и следующая, больше ничего.
 *
 * Список целиком здесь не нужен и мешал: за воспроизведением следят по одной строке, а
 * десять приглушённых вокруг превращали панель в стену. Прокрутки тоже нет — строки
 * сменяются на месте, и глазу не нужно догонять уезжающий текст.
 */
function Synced({ lines, activeIndex }: { lines: LyricLine[]; activeIndex: number }) {
  const ink = useGlassInk();
  // В полюс, а не смешением: inkColor между полюсами отдаёт средне-серый, и над пёстрой
  // обложкой, где адаптация садится посередине, строка выходила буквально серой.
  const text = ink > 0.5 ? colors.foreground : DARK_INK;
  const shadow = ink > 0.5 ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.85)';

  // До первой строки ведущей ещё нет — показываем начало текста, а не пустую панель.
  const start = activeIndex >= 0 ? activeIndex : 0;
  const current = nextText(lines, start);
  const upcoming = nextText(lines, start + 1);

  return (
    <View style={styles.pair}>
      {current && (
        <Text style={[styles.line, { color: text, textShadowColor: shadow }]} numberOfLines={3}>
          {current}
        </Text>
      )}
      {upcoming && (
        <Text
          style={[styles.line, styles.next, { color: text, textShadowColor: shadow }]}
          numberOfLines={3}
        >
          {upcoming}
        </Text>
      )}
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
  content: { flex: 1, overflow: 'hidden', borderRadius: radii.card },

  pair: { flex: 1, justifyContent: 'center', paddingHorizontal: space.lg, gap: space.lg },
  /** Витринный гротеск: строка песни — не интерфейс, ей можно и нужно иметь лицо. */
  line: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    lineHeight: 30,
    letterSpacing: -0.4,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  next: { opacity: NEXT_ALPHA },

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
