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

uniform float  u_fresnel;
uniform float  u_fresnelPower;
uniform float  u_specular;
uniform float  u_specularPower;
uniform float  u_edgeStrength;
uniform float  u_edgeWidth;
uniform float  u_dispersion;
uniform float  u_refraction;
uniform float4 u_tint;
uniform float  u_opacity;
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
  float lift = 1.0 + u_active * 0.85;

  // Френель считается от НАКЛОНА фаски, а не от расстояния до края: поэтому он гаснет вместе
  // с толщиной и не превращается в контур постоянной ширины.
  float fres = pow(1.0 - clamp(N.z, 0.0, 1.0), u_fresnelPower) * u_fresnel;

  float3 L1 = normalize(float3(u_light * 0.86, 0.42));
  float3 L2 = normalize(float3(-u_light * 0.78, 0.50));
  float bevelMask = smoothstep(0.10, 0.55, t);
  float s1 = pow(max(dot(reflect(-L1, N), V), 0.0), u_specularPower) * 0.85;
  float s2 = pow(max(dot(reflect(-L2, N), V), 0.0), u_specularPower * 1.45) * 0.14;
  float spec = (s1 + s2) * bevelMask * u_specular * bloom * (1.0 + u_active * 0.30);

  // Кромка — не кольцо, а две дуги: яркая со стороны ключевого света и слабая с обратной.
  // Именно перепад по обводу глаз опознаёт как стекло; ровное кольцо читается контуром.
  float facing = dot(n, u_light);
  float lo = 1.0 - clamp(u_edgeWidth, 0.05, 1.0);
  float edgeBand = smoothstep(lo, mix(lo, 1.0, 0.85), t);
  float arcTop = pow(max(facing, 0.0), 1.5);
  float arcBot = pow(max(-facing, 0.0), 4.0) * 0.16;
  float rimLum = edgeBand * (arcTop + arcBot) * u_edgeStrength * bloom * lift;
  half3 cool = mix(half3(1.0), half3(0.88, 0.95, 1.0), half(clamp(u_dispersion, 0.0, 1.0)));
  half3 warm = mix(half3(1.0), half3(1.0, 0.94, 0.84), half(clamp(u_dispersion, 0.0, 1.0)));
  half3 rimCol = (half3(half(arcTop)) * cool + half3(half(arcBot)) * warm)
    * half(edgeBand * u_edgeStrength * bloom * lift);

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
    if (u_debug < 4.5) { return vgPack(vgHeat(fres), inMask); }
    if (u_debug < 5.5) {
      float push = pow(t, VG_FALLOFF) * u_refraction;
      return vgPack(vgHeat(push), inMask);
    }
    if (u_debug < 6.5) { return half4(0.0); }
    if (u_debug < 7.5) { return vgPack(half3(1.0), spec * inMask); }
    if (u_debug < 8.5) {
      half3 split = (half3(half(arcTop)) * cool - half3(half(arcTop)) * warm) * half(6.0);
      return vgPack(clamp(abs(split), half3(0.0), half3(1.0)), edgeBand * inMask);
    }
    return vgPack(half3(N * 0.5 + 0.5), inMask);
  }

  // Тень и ореол живут СНАРУЖИ формы: внутри их место занимает само стекло. Отрыв от
  // контента держится именно на тени — без неё поверхность лежит НА картинке, а не над ней.
  float outside = smoothstep(-1.0, 1.0, sd);
  float sdDrop = vgScene(p - float2(0.0, u_shadowReach * 0.16), u_halfSize, u_corner,
                         u_morphOffset, u_morphHalf, u_morphCorner, u_morphK);
  float amb = 1.0 - smoothstep(0.0, u_shadowReach, max(sdDrop, 0.0));
  float con = 1.0 - smoothstep(0.0, u_shadowReach * 0.22, max(sd, 0.0));
  float shade = (amb * amb * 0.22 + con * con * 0.18) * outside * u_shadow;
  float halo = 1.0 - smoothstep(0.0, u_shadowReach * 0.30, max(sd, 0.0));
  halo = halo * halo * u_active * 0.10 * outside;

  if (sd > 1.0) {
    return half4(half3(half(halo)), half(halo + shade * (1.0 - halo)));
  }

  float density = u_tint.w;
  float inner = clamp(-sd / halfMin, 0.0, 1.0);
  half3 col = half3(u_tint.rgb);

  // Тинт СВЕТЛЫЙ и слабый, а не тёмный: тёмное стекло на тёмном контенте исчезает, и его
  // приходится держать жирной кромкой — от этого поверхность читается хромированной бусиной.
  float body = mix(0.19, 0.69, smoothstep(0.10, 0.62, t)) * density;
  float vignette = smoothstep(0.15, 1.0, inner) * 0.19 * density;
  float a = max(body, vignette) + u_press * 0.05;

  col = mix(col, half3(0.58, 0.58, 0.61), half(u_active * 0.40));
  a = max(a, u_active * 0.26) + absorb;
  col *= 1.0 - half(absorb * 1.2);

  col += half3(spec) * half3(0.98, 0.99, 1.0);
  col += rimCol;
  col += half3(half(fres * 0.34)) * half3(0.96, 0.98, 1.0);

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

  // Альфа кромки и блика идёт вровень с их яркостью: при заниженной альфе premultiplied
  // результат гаснет и край становится невидимым на тёмном фоне.
  a = clamp(a + spec + rimLum + fres * 0.30, 0.0, 1.0);
  a = max(a, float(inkA));
  a *= u_opacity;
  a *= 1.0 - smoothstep(-1.0, 1.0, sd);

  col = clamp(col, half3(0.0), half3(1.0));
  return half4(col * half(a), half(a + shade * (1.0 - a)));
}
`;
