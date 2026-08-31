import { VG_FALLOFF, VG_SDF } from './sdf';

/** Порядок совпадает с `DEBUG_MODES` в `material.ts`: индекс уезжает в `u_debug`. */
export const SURFACE_SHADER = `
uniform shader u_icon;

uniform float2 u_center;
uniform float2 u_halfSize;
uniform float  u_corner;
uniform float  u_bevel;
uniform float  u_thickness;
uniform float2 u_morphOffset;
uniform float2 u_morphHalf;
uniform float  u_morphCorner;
uniform float  u_morphK;

uniform float2 u_shift;
uniform float2 u_dir;
uniform float  u_stretch;
uniform float  u_press;
uniform float  u_active;
uniform float2 u_light;

uniform float  u_specular;
uniform float  u_specularPower;
uniform float  u_edgeDensity;
uniform float  u_dispersion;
uniform float  u_refraction;
uniform float4 u_tint;
uniform float  u_shadow;
uniform float  u_shadowReach;
uniform float  u_debug;

uniform float  u_iconOn;
uniform float  u_iconScale;
uniform float4 u_inkIdle;
uniform float4 u_inkActive;

${VG_SDF}

const float VG_FALLOFF = ${VG_FALLOFF};
const float ICON_LAG = 0.5;
/* Толщина, на которой откалибровано поглощение: при ней полоса совпадает с прежним стеклом. */
const float VG_REF_THICKNESS = 0.18;
// Плотность тинта в плоской середине; у фаски она множится на u_edgeDensity.
const float VG_BODY_DENSITY = 0.19;

half4 vgPack(half3 c, float a) { return half4(c * half(a), half(a)); }

half3 vgHeat(float v) {
  float x = clamp(v, 0.0, 1.0);
  return half3(half(clamp(x * 2.2 - 0.2, 0.0, 1.0)),
               half(clamp(1.0 - abs(x - 0.5) * 2.2, 0.0, 1.0)),
               half(clamp(1.2 - x * 2.4, 0.0, 1.0)));
}

half4 main(float2 xy) {
  float2 p = xy - u_center - u_shift;

  // Обратная деформация: вдоль вектора тяги растяжение A, поперёк сжатие 1/sqrt(A). Ровно
  // этот закон повторяет трансформ живой подложки под канвасом, иначе они разъезжаются.
  if (u_stretch > 0.001) {
    float along = dot(p, u_dir);
    float2 perp = p - u_dir * along;
    float A = 1.0 + u_stretch;
    p = u_dir * (along / A) + perp * sqrt(A);
  }
  p *= 1.0 - u_press * 0.05;

  float halfMin = max(min(u_halfSize.x, u_halfSize.y), 1.0);
  float bevel = max(u_bevel, 1.0);

  float sd = vgScene(p, u_halfSize, u_corner, u_morphOffset, u_morphHalf, u_morphCorner, u_morphK);
  float t = vgBevelT(sd, bevel);
  float2 n = vgSceneNormal(p, u_halfSize, u_corner, u_morphOffset, u_morphHalf, u_morphCorner, u_morphK);
  float3 N = normalize(float3(n * vgBevelSlope(t), 1.0));
  float3 V = float3(0.0, 0.0, 1.0);

  float bloom = 1.0 + u_press * 0.45;

  float3 L1 = normalize(float3(u_light * 0.86, 0.42));
  float3 L2 = normalize(float3(-u_light * 0.78, 0.50));
  float bevelMask = smoothstep(0.10, 0.55, t);
  float s1 = pow(max(dot(reflect(-L1, N), V), 0.0), u_specularPower) * 0.85;
  float s2 = pow(max(dot(reflect(-L2, N), V), 0.0), u_specularPower * 1.45) * 0.14;
  float spec = (s1 + s2) * bevelMask * u_specular * bloom * (1.0 + u_active * 0.30);

  // Светящейся кромки здесь больше НЕТ. Она была отражением, нарисованным белым поверх, и
  // потому выглядела одинаково над чёрным списком и над светлой обложкой. Отражение
  // считает линза (lens-shader.ts) — там виден бэкдроп, и кромка берёт цвет от того, что
  // реально под ней. Здесь остаётся только то, что от окружения не зависит: блик от НАШЕГО
  // ключевого света, поглощение среды и тень.
  float facing = dot(n, u_light);

  // Толщина как поглощение: полоса там, где кромку не освещает ни один источник. Растёт
  // с фаской, поэтому тонкое стекло само по себе перестаёт «наливаться» у края.
  float absorb = smoothstep(0.0, 0.70, t) * (1.0 - smoothstep(0.80, 1.0, t))
    * (1.0 - abs(facing)) * 0.10 * (u_thickness / VG_REF_THICKNESS);

  if (u_debug > 0.5) {
    float inMask = 1.0 - smoothstep(-1.0, 1.0, sd);
    if (u_debug < 1.5) {
      float band = abs(fract(sd / (halfMin * 0.22)) - 0.5) * 2.0;
      half3 c = sd < 0.0 ? half3(0.20, 0.62, 1.0) : half3(1.0, 0.42, 0.22);
      return vgPack(c * half(0.25 + band * 0.75), 1.0);
    }
    if (u_debug < 2.5) { return vgPack(half3(1.0), inMask); }
    if (u_debug < 3.5) { return vgPack(vgHeat(t), inMask); }
    // Френель теперь у линзы; здесь показываем его ФОРМУ — насколько взгляд скользящий.
    if (u_debug < 4.5) { return vgPack(vgHeat(1.0 - clamp(N.z, 0.0, 1.0)), inMask); }
    if (u_debug < 5.5) {
      float push = pow(t, VG_FALLOFF) * u_refraction;
      return vgPack(vgHeat(push), inMask);
    }
    if (u_debug < 6.5) { return half4(0.0); }
    if (u_debug < 7.5) { return vgPack(half3(1.0), spec * inMask); }
    // Расщепление считает линза; здесь — поле, по которому оно нарастает.
    if (u_debug < 8.5) { return vgPack(vgHeat(u_dispersion * t * t), inMask); }
    return vgPack(half3(N * 0.5 + 0.5), inMask);
  }

  // Тень и ореол живут СНАРУЖИ формы: внутри их место занимает само стекло. Отрыв от
  // контента держится именно на тени — без неё поверхность лежит НА картинке, а не над ней.
  // Тень живёт только у кромки и снаружи: при sd < −1 множитель outside и так ноль.
  // Считать её глубоко внутри формы — это лишняя ПОЛНАЯ оценка SDF на каждый такой пиксель,
  // а тело занимает почти всю площадь. Ветвление здесь по координате, но расходятся только
  // нити на самой кромке.
  float shade = 0.0;
  float halo = 0.0;
  if (sd > -1.0) {
    float outside = smoothstep(-1.0, 1.0, sd);
    float sdDrop = vgScene(p - float2(0.0, u_shadowReach * 0.16), u_halfSize, u_corner,
                           u_morphOffset, u_morphHalf, u_morphCorner, u_morphK);
    float amb = 1.0 - smoothstep(0.0, u_shadowReach, max(sdDrop, 0.0));
    float con = 1.0 - smoothstep(0.0, u_shadowReach * 0.22, max(sd, 0.0));
    shade = (amb * amb * 0.22 + con * con * 0.18) * outside * u_shadow;
    halo = 1.0 - smoothstep(0.0, u_shadowReach * 0.30, max(sd, 0.0));
    halo = halo * halo * u_active * 0.10 * outside;
  }

  if (sd > 1.0) {
    return half4(half3(half(halo)), half(halo + shade * (1.0 - halo)));
  }

  float density = u_tint.w;
  float inner = clamp(-sd / halfMin, 0.0, 1.0);
  half3 col = half3(u_tint.rgb);

  // Тинт СВЕТЛЫЙ и слабый, а не тёмный: тёмное стекло на тёмном контенте исчезает, и его
  // приходится держать жирной кромкой — от этого поверхность читается хромированной бусиной.
  // Плотность тинта у фаски — отдельная величина: физически фаска гнёт свет сильнее, но
  // мутнее НЕ становится. Сцепленные, они давали молочное кольцо по всему обводу.
  float body = mix(VG_BODY_DENSITY, VG_BODY_DENSITY * u_edgeDensity, smoothstep(0.10, 0.62, t)) * density;
  float vignette = smoothstep(0.15, 1.0, inner) * 0.19 * density;
  float a = max(body, vignette) + u_press * 0.05;

  col = mix(col, half3(0.58, 0.58, 0.61), half(u_active * 0.40));
  a = max(a, u_active * 0.26) + absorb;
  col *= 1.0 - half(absorb * 1.2);

  col += half3(spec) * half3(0.98, 0.99, 1.0);

  float2 ip = u_center + p + u_shift * (1.0 - ICON_LAG);
  half4 ink = u_icon.eval(ip * u_iconScale) * half(u_iconOn);
  // Маска двухслойная: штрих в зелёном канале, размытый красный ореол под ним. Разность
  // каналов даёт тень под иконкой — без неё светлый штрих тонет в светлой обложке.
  half halation = ink.a - ink.g;
  col *= 1.0 - halation * 0.92;
  a = max(a, float(halation) * 0.72);
  half inkA = ink.g * half(mix(0.82, 1.0, u_active));
  half3 inkCol = mix(half3(u_inkIdle.rgb), half3(u_inkActive.rgb), half(u_active));
  col = col * (1.0 - inkA) + inkCol * inkA;

  // Альфа блика идёт вровень с его яркостью: при заниженной альфе premultiplied результат
  // гаснет и блик становится невидимым на тёмном фоне.
  a = clamp(a + spec, 0.0, 1.0);
  a = max(a, float(inkA));
  a *= 1.0 - smoothstep(-1.0, 1.0, sd);

  col = clamp(col, half3(0.0), half3(1.0));
  return half4(col * half(a), half(a + shade * (1.0 - a)));
}
`;
