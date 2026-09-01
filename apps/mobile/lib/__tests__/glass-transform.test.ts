import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VG_SDF } from '../vireglass/sdf';
import { SURFACE_SHADER } from '../vireglass/surface-shader';

const HERE = dirname(fileURLToPath(import.meta.url));
const SURFACE_VIEW = readFileSync(resolve(HERE, '../../components/vireglass/glass-surface.tsx'), 'utf8');

describe('тяга стекла', () => {
  // Тянут не деталь, а её кусок: тело стоит на месте, за пальцем уходит капля, между ними
  // шейка. Растяжение всей формы — хоть трансформом, хоть в шейдере — вытягивает её и в
  // ПРОТИВОПОЛОЖНУЮ сторону, чего с прилипшей каплей не бывает: получается пилюля.
  it('тяга — вторая форма, сшитая с телом', () => {
    expect(VG_SDF).toContain('float vgSmin(');
    expect(VG_SDF).not.toContain('vgPull');
    expect(SURFACE_VIEW).toContain('u_morphOffset: lobe.value[5] > 0');
  });

  // Тело не ездит за пальцем, поэтому в трансформе нечему быть, кроме изотропного вздутия:
  // ни повернуть, ни сплющить, ни увести деталь оно не может — значит и разъехаться с
  // нативной линзой ему нечем.
  it('в трансформе не осталось ни поворота, ни осевого масштаба, ни переноса', () => {
    for (const style of SURFACE_VIEW.split('useAnimatedStyle(').slice(1)) {
      const body = style.slice(0, style.indexOf('}));'));
      for (const banned of ['rotate:', 'scaleX:', 'scaleY:', 'translateX:', 'translateY:']) {
        expect(body).not.toContain(banned);
      }
    }
  });

  // Линза — нативная вьюха: через обычный проп капля ехала бы с JS-потока, а поверхность
  // гнулась бы с UI, и слои разъехались бы на кадр.
  it('линза принимает каплю анимированным пропом', () => {
    expect(SURFACE_VIEW).toContain('AnimatedGlassLens');
    expect(SURFACE_VIEW).toContain('animatedProps={lensAnimatedProps}');
  });

  it('поверхность не гнёт себя сама — ни тягой, ни нажатием', () => {
    expect(SURFACE_SHADER).not.toContain('p *= 1.0 - u_press');
    expect(SURFACE_SHADER).not.toContain('u_stretch');
  });
});
