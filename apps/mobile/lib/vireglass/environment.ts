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

// Наклон общий для всех поверхностей — сенсор один на устройство. Подписка тоже одна:
// с `environment > 0` в дефолтном материале иначе получалось по слушателю на каждое
// стекло (до шести одновременно), и каждое считало один и тот же фильтр заново.
const listeners = new Set<(tilt: number) => void>();
let subscription: { remove: () => void } | null = null;
let tilt = 0;

function subscribe(cb: (tilt: number) => void): () => void {
  listeners.add(cb);
  if (!subscription) {
    Accelerometer.setUpdateInterval(INTERVAL_MS);
    subscription = Accelerometer.addListener(({ x, y }) => {
      const raw = Math.max(-1, Math.min(1, x * 0.7 + y * 0.3));
      tilt += (raw - tilt) * SMOOTHING;
      for (const listener of listeners) listener(tilt);
    });
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      subscription?.remove();
      subscription = null;
      tilt = 0;
    }
  };
}

/**
 * Направление ключевого света. `strength = 0` не подписывается на сенсор вовсе и держит
 * свет закреплённым к экрану.
 */
export function useEnvironmentLight(strength: number): SharedValue<readonly number[]> {
  const light = useSharedValue<readonly number[]>(REST_LIGHT);

  useEffect(() => {
    if (strength <= 0) {
      light.value = REST_LIGHT;
      return;
    }
    let emitted = 0;
    return subscribe((next) => {
      if (Math.abs(next - emitted) < DEADZONE) return;
      emitted = next;
      light.value = rotate(REST_LIGHT, -next * MAX_SWING * strength);
    });
  }, [strength, light]);

  return light;
}
