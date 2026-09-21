import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VG_SDF } from '../vireglass/sdf';
import { SURFACE_SHADER } from '../vireglass/surface-shader';

const HERE = dirname(fileURLToPath(import.meta.url));
// Поверхность приезжает из пакета — сверяется ЕЁ исходник, а не наш реэкспорт.
const SURFACE_VIEW = readFileSync(
  resolve(dirname(createRequire(import.meta.url).resolve('vireglass/package.json')), 'src/native/glass-surface.tsx'),
  'utf8',
);
const BUTTON = readFileSync(resolve(HERE, '../../components/liquid-glass.tsx'), 'utf8');

describe('тяга стекла', () => {
  // Деформацию ведёт МОДЕЛЬ ЯДРА (`createDeform` → `vgTouchWarp`): гнётся поле вокруг пятна
  // касания, одинаково на вебе и здесь. Своя вторая форма («капля»), пружины и шина тяги
  // между соседями были андроидным изобретением: под одним именем выходило два разных стекла.
  it('деформация — поле вокруг пятна касания, из ядра', () => {
    expect(VG_SDF).toContain('float2 vgTouchWarp(');
    expect(VG_SDF).toContain('float vgSmin(');
    for (const field of ['u_touch:', 'u_pull:', 'u_touchPress:', 'u_touchRadius:', 'u_wave:']) {
      expect(SURFACE_VIEW).toContain(field);
    }
    for (const local of ['lobe.value', 'pullBus', 'LOBE_SHRINK']) {
      expect(SURFACE_VIEW).not.toContain(local);
    }
    expect(BUTTON).toContain('createDeform()');
  });

  // Тело не ездит за пальцем и не раздувается: движение целиком в шейдере, поэтому
  // трансформу нечем разъехаться с нативной линзой — обёртка вообще не анимируется.
  it('обёртку стекла ничто не двигает', () => {
    expect(SURFACE_VIEW).not.toContain('useAnimatedStyle(');
    expect(SURFACE_VIEW).not.toContain('<Animated.View');
  });

  // Линза — нативная вьюха: через обычный проп значения ехали бы с JS-потока, а поверхность
  // гнулась бы с UI, и слои разъехались бы на кадр.
  it('линза принимает отклик анимированным пропом', () => {
    expect(SURFACE_VIEW).toContain('AnimatedGlassLens');
    expect(SURFACE_VIEW).toContain('animatedProps={lensAnimatedProps}');
  });

  it('поверхность не гнёт себя сама — ни тягой, ни нажатием', () => {
    expect(SURFACE_SHADER).not.toContain('p *= 1.0 - u_press');
    expect(SURFACE_SHADER).not.toContain('u_stretch');
  });
});
