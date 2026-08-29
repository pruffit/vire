import { VG_FALLOFF, VG_SDF } from './sdf';

// Исходник линзы собирается ЗДЕСЬ и уезжает в нативную вьюху пропом: AGSL и SKSL — один
// язык, поэтому геометрия у линзы и поверхности буквально одна и та же строка (`VG_SDF`).
// В Kotlin остаётся встроенный дефолт на случай отсутствия пропа.
//
// Ход луча: в плоской середине равномерное увеличение (оптическая толщина среды), в фаске
// выборка уходит НАРУЖУ по нормали, и у самого края видно то, что лежит за стеклом, сжатое
// в тонкую полосу. Обе аберрации живут только в фаске — в реальном толстом стекле центр резкий.
export const LENS_SHADER = `
uniform shader content;

uniform float2 u_center;
uniform float2 u_halfSize;
uniform float  u_corner;
uniform float  u_bevel;
uniform float  u_magnify;
uniform float  u_edgePush;
uniform float  u_chroma;
uniform float  u_spherical;
uniform float2 u_morphOffset;
uniform float2 u_morphHalf;
uniform float  u_morphCorner;
uniform float  u_morphK;
uniform float  u_debug;

${VG_SDF}

const float VG_FALLOFF = ${VG_FALLOFF};

// Деление на околонулевую альфу раздувает шум half-точности до единицы, поэтому порог, а не > 0.
half3 vgStraight(half4 c) {
  return c.a > 0.004 ? c.rgb / c.a : half3(0.0);
}

half4 main(float2 xy) {
  float2 p = xy - u_center;
  float sd = vgScene(p, u_halfSize, u_corner, u_morphOffset, u_morphHalf, u_morphCorner, u_morphK);
  if (sd > 1.0) { return half4(0.0); }

  float t = vgBevelT(sd, max(u_bevel, 1.0));
  float2 n = vgSceneNormal(p, u_halfSize, u_corner, u_morphOffset, u_morphHalf, u_morphCorner, u_morphK);

  // Режим «бэкдроп» отдаёт содержимое как есть — это опорная точка для сравнения оптики.
  float on = u_debug > 5.5 && u_debug < 6.5 ? 0.0 : 1.0;
  float magnify = mix(1.0, u_magnify, on);
  float2 s = u_center + p / magnify + n * (u_edgePush * on * pow(t, VG_FALLOFF));

  float spread = u_spherical * on * t * t;
  float chroma = u_chroma * on * t * t;

  // content.eval отдаёт PREMULTIPLIED цвет. Брать .r/.g/.b из РАЗНЫХ точек и склеивать
  // напрямую нельзя: где альфа между выборками отличается, каналы делятся на разный
  // множитель и на границах содержимого вылезает цветная кайма, которой в контенте нет.
  half4 c0 = content.eval(s - n * (chroma + spread));
  half4 c1 = content.eval(s - n * (chroma - spread));
  half4 c2 = content.eval(s - n * spread);
  half4 c3 = content.eval(s + n * spread);
  half4 c4 = content.eval(s + n * (chroma - spread));
  half4 c5 = content.eval(s + n * (chroma + spread));

  half3 rgb = half3(
    (vgStraight(c0).r + vgStraight(c1).r) * 0.5,
    (vgStraight(c2).g + vgStraight(c3).g) * 0.5,
    (vgStraight(c4).b + vgStraight(c5).b) * 0.5);

  // Альфа выборок обязана дожить до результата: развернуть цвет по исходной альфе, а вернуть
  // с чужой (маской формы) — значит сделать прозрачный бэкдроп непрозрачным и засветить его.
  half srcA = (c0.a + c1.a + c2.a + c3.a + c4.a + c5.a) / 6.0;
  half alpha = srcA * half(1.0 - smoothstep(-1.0, 1.0, sd));
  return half4(rgb * alpha, alpha);
}
`;
