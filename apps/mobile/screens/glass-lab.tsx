import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassProbe } from '../modules/glass-lens';

// Стенд VireGlass. В продовый UI не входит: включается переменной окружения
// EXPO_PUBLIC_GLASS_LAB=1 (см. App.tsx). Документация — docs/vireglass/.
//
// Эксперимент §9: доказать ЭКСПЕРИМЕНТОМ, а не цитатой из документации, какие пиксели
// приходят в `RenderEffect.createRuntimeShaderEffect`. Под зондом лежат три полосы
// (красная/зелёная/синяя) и текст. Шейдер зонда возвращает выборку как есть.
//
// Толкование результата:
//   видно полосы            → шейдер получает содержимое ПОД вьюхой (бэкдроп)
//   видно пустоту/маркер    → шейдер получает содержимое САМОЙ вьюхи (и её детей)
//
// Второй зонд отличается ровно одним: внутри него лежит BlurView с blurTarget, то есть
// ребёнок, который сам рисует в себя контент экрана. Если бэкдроп виден только там —
// значит его даёт dimezis, а не RenderEffect.

const BANDS = [
  { color: '#e11d48', label: 'КРАСНАЯ' },
  { color: '#16a34a', label: 'ЗЕЛЁНАЯ' },
  { color: '#2563eb', label: 'СИНЯЯ' },
];

function Backdrop() {
  return (
    <View style={StyleSheet.absoluteFill}>
      {BANDS.map((b) => (
        <View key={b.label} style={[styles.band, { backgroundColor: b.color }]}>
          <Text style={styles.bandLabel}>{b.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ProbeCase({
  title,
  note,
  withBlurChild,
  blurTarget,
  mode,
}: {
  title: string;
  note: string;
  withBlurChild: boolean;
  blurTarget: React.RefObject<View | null>;
  mode: number;
}) {
  if (!GlassProbe) {
    return (
      <View style={styles.case}>
        <Text style={styles.caseTitle}>{title}</Text>
        <Text style={styles.caseNote}>GlassProbe недоступен (не Android / модуль не загрузился)</Text>
      </View>
    );
  }

  return (
    <View style={styles.case}>
      <Text style={styles.caseTitle}>{title}</Text>
      <Text style={styles.caseNote}>{note}</Text>
      <View style={styles.stage}>
        <Backdrop />
        <GlassProbe mode={mode} style={styles.probe}>
          {withBlurChild ? (
            <BlurView
              intensity={12}
              tint="dark"
              blurMethod="dimezisBlurView"
              blurTarget={blurTarget}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </GlassProbe>
      </View>
    </View>
  );
}

export function GlassLab() {
  // Цель блюра передаётся в BlurView напрямую: контекст blur-target нужен приложению для
  // переключения цели между экранами, а у стенда экран один.
  const targetRef = useRef<View>(null);
  const [mode, setMode] = useState(0);

  return (
    <View style={styles.root} ref={targetRef} collapsable={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>VireGlass · стенд</Text>
        <Text style={styles.sub}>
          §9 — какие пиксели получает createRuntimeShaderEffect. Платформа: {Platform.OS}, API{' '}
          {Platform.Version}
        </Text>

        <ProbeCase
          title="A · зонд БЕЗ детей"
          note="Если RenderEffect давал бы доступ к фону, здесь были бы видны полосы."
          withBlurChild={false}
          blurTarget={targetRef}
          mode={mode}
        />

        <ProbeCase
          title="B · зонд с BlurView (dimezis) внутри"
          note="Ребёнок сам рисует в себя контент экрана. Полосы здесь = заслуга dimezis, не RenderEffect."
          withBlurChild
          blurTarget={targetRef}
          mode={mode}
        />

        <Pressable style={styles.btn} onPress={() => setMode((m) => (m + 1) % 3)}>
          <Text style={styles.btnText}>
            режим {mode}: {['сырая выборка', 'выборка + маркер живости', 'карта альфы'][mode]}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1114' },
  scroll: { padding: 16, paddingTop: 48, gap: 20 },
  h1: { color: '#e6ecef', fontSize: 22, fontWeight: '700' },
  sub: { color: '#7f9099', fontSize: 12, marginTop: -12 },
  case: { gap: 6 },
  caseTitle: { color: '#5ecfc6', fontSize: 14, fontWeight: '600' },
  caseNote: { color: '#b3c1c8', fontSize: 11, lineHeight: 15 },
  stage: { height: 210, borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  band: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bandLabel: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 2 },
  probe: { position: 'absolute', left: 60, top: 45, width: 200, height: 120 },
  btn: { alignSelf: 'flex-start', backgroundColor: '#1b2328', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnText: { color: '#e6ecef', fontSize: 12 },
});
