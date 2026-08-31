// Единственное описание геометрии VireGlass. Отсюда её берут ОБА шейдера: SKSL-поверхность
// (`surface-shader.ts`) и AGSL-линза (`lens-shader.ts`, уезжает в нативную вьюху строкой).
// AGSL и SKSL — один язык, поэтому дублировать SDF в Kotlin больше не нужно: раньше круг
// в поверхности и скруглённый прямоугольник в линзе описывали разные стёкла, а константа
// фаски синхронизировалась вручную (docs/vireglass/architecture.md §3).
export const VG_SDF = `
float vgRoundRect(float2 p, float2 halfSize, float corner) {
  float2 q = abs(p) - halfSize + corner;
  return min(max(q.x, q.y), 0.0) + length(max(q, float2(0.0))) - corner;
}

float vgSmin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Сцена = одна форма, а при k > 0 — гладкое объединение двух (морфинг-эксперимент).
float vgScene(float2 p, float2 halfSize, float corner,
              float2 offsetB, float2 halfB, float cornerB, float k) {
  float a = vgRoundRect(p, halfSize, corner);
  if (k <= 0.0) { return a; }
  return vgSmin(a, vgRoundRect(p - offsetB, halfB, cornerB), k);
}

// Аналитическая нормаль одиночной формы: радиальная на скруглении, осевая на прямых участках.
float2 vgRoundRectNormal(float2 p, float2 halfSize, float corner) {
  float2 q = abs(p) - halfSize + corner;
  float2 g = (q.x > 0.0 && q.y > 0.0)
    ? normalize(max(q, float2(0.0001)))
    : (q.x > q.y ? float2(1.0, 0.0) : float2(0.0, 1.0));
  return g * sign(p);
}

// На объединённой сцене аналитической нормали нет — там градиент берётся разностями.
// Ветка по униформе, дивергенции внутри кадра не создаёт.
float2 vgSceneNormal(float2 p, float2 halfSize, float corner,
                     float2 offsetB, float2 halfB, float cornerB, float k) {
  if (k <= 0.0) { return vgRoundRectNormal(p, halfSize, corner); }
  float e = 0.75;
  float dx = vgScene(p + float2(e, 0.0), halfSize, corner, offsetB, halfB, cornerB, k)
           - vgScene(p - float2(e, 0.0), halfSize, corner, offsetB, halfB, cornerB, k);
  float dy = vgScene(p + float2(0.0, e), halfSize, corner, offsetB, halfB, cornerB, k)
           - vgScene(p - float2(0.0, e), halfSize, corner, offsetB, halfB, cornerB, k);
  return normalize(float2(dx, dy) + float2(1e-5, 1e-5));
}

// Положение в фаске: 0 — плоская середина, 1 — самая кромка. Одна эта величина питает
// маску, толщину, преломление, аберрации и ширину световой кромки.
float vgBevelT(float sd, float bevel) {
  return clamp((sd + bevel) / bevel, 0.0, 1.0);
}

// Наклон профиля фаски — сферический: t / sqrt(1 - t²), как у шарового сегмента. Прежний
// t² держал наклон около нуля почти всю фаску и взлетал у самой кромки, отчего вся оптика
// собиралась в узкое кольцо и деталь читалась ШАЙБОЙ — плоский верх и стенка по борту.
// Здесь кривизна распределена по фаске, и кромка перестаёт быть линией.
//
// Полем зрения это по-прежнему не правит: гнётся только фаска, середина плоская, иначе
// поверхность читается мыльным пузырём.
float vgBevelSlope(float t) {
  return min(t * inversesqrt(max(1.0 - t * t * 0.94, 0.02)), 3.2);
}
`;

/** Скорость нарастания смещения к кромке. Общая для линзы (реальное смещение выборки) и
 *  поверхности (визуализация поля смещения в debug-режиме) — иначе они разъедутся. */
export const VG_FALLOFF = 2.6;
