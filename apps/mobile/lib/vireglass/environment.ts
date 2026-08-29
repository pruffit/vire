import { useEffect } from 'react';
import { Accelerometer } from 'expo-sensors';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { REST_LIGHT } from './adapters';

// Сырые показания акселерометра в шейдер не идут. Конвейер: сенсор → нормализованный наклон
// → фильтр низких частот → мёртвая зона → направление света. Без фильтра и зоны неподвижный
// телефон даёт видимое дрожание блика — шум сенсора больше, чем порог заметности блика.
const INTERVAL_MS = 50;
const SMOOTHING = 0.12;
const DEADZONE = 0.008;
/** Насколько ключевой свет отъезжает на полном наклоне, радианы. */
const MAX_SWING = 0.55;

function rotate(v: readonly number[], angle: number): number[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

/**
 * Направление ключевого света. `strength = 0` (дефолт Material v1) не подписывается на сенсор
 * вовсе и держит свет закреплённым к экрану — стабильность важнее эффекта.
 */
export function useEnvironmentLight(strength: number): SharedValue<readonly number[]> {
  const light = useSharedValue<readonly number[]>(REST_LIGHT);

  useEffect(() => {
    if (strength <= 0) {
      light.value = REST_LIGHT;
      return;
    }
    let tilt = 0;
    let emitted = 0;
    Accelerometer.setUpdateInterval(INTERVAL_MS);
    const sub = Accelerometer.addListener(({ x, y }) => {
      const raw = Math.max(-1, Math.min(1, x * 0.7 + y * 0.3));
      tilt += (raw - tilt) * SMOOTHING;
      if (Math.abs(tilt - emitted) < DEADZONE) return;
      emitted = tilt;
      light.value = rotate(REST_LIGHT, -tilt * MAX_SWING * strength);
    });
    return () => sub.remove();
  }, [strength, light]);

  return light;
}
