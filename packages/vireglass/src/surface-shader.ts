import { VG_FALLOFF, VG_SDF } from './sdf';

/** Порядок совпадает с `DEBUG_MODES` в `material.ts`: индекс уезжает в `u_debug`. */
export const SURFACE_SHADER = `
uniform shader u_icon;
/** Цветной контент приложения НА стекле — обложка, миниатюра. Отдельный слой от маски краски:
 *  та одноканальная и красится полярностью, а этот несёт свой цвет как есть. */
uniform shader u_overlay;

uniform float2 u_center;
uniform float2 u_halfSize;
uniform float  u_corner;
uniform float  u_bevel;
uniform float  u_thickness;
uniform float2 u_morphOffset;
uniform float2 u_morphHalf;
uniform float  u_morphCorner;
uniform float  u_morphK;

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
uniform float  u_presence;
uniform float  u_progress;
uniform float  u_debug;

uniform float  u_iconOn;
uniform float  u_overlayOn;
uniform float  u_iconScale;
uniform float4 u_inkIdle;
uniform float4 u_inkActive;
uniform float2 u_touch;
uniform float2 u_pull;
uniform float  u_touchPress;
uniform float  u_touchRadius;
uniform float2 u_wave;

${VG_SDF}

const float VG_FALLOFF = ${VG_FALLOFF};

// Плотность тинта в плоской середине; у фаски она множится на u_edgeDensity.
const float VG_BODY_DENSITY = 0.19;
/* Глубина краски под поверхностью, dp. На столько её уводит нормаль у самой кромки. */
const float VG_INK_DEPTH = 4.0;

half4 vgPack(half3 c, float a) { return half4(c * half(a), half(a)); }

half3 vgHeat(float v) {
  float x = clamp(v, 0.0, 1.0);
  return half3(half(clamp(x * 2.2 - 0.2, 0.0, 1.0)),
               half(clamp(1.0 - abs(x - 0.5) * 2.2, 0.0, 1.0)),
               half(clamp(1.2 - x * 2.4, 0.0, 1.0)));
}

half4 main(float2 xy) {
  float2 p = vgTouchWarp(xy - u_center, u_touch, u_pull, u_touchPress, u_touchRadius, u_wave.x, u_wave.y);

  // Обратная деформация: вдоль вектора тяги растяжение A, поперёк сжатие 1/sqrt(A). Ровно
  // этот закон повторяет трансформ живой подложки под канвасом, иначе они разъезжаются.
  // Геометрии движения здесь НЕТ — ни тяги, ни вздутия от нажатия. Всё это делает один
  // трансформ обёртки, он же несёт нативную линзу: шейдер её не достаёт, а два конвейера
  // на одно движение расходятся на кадр, и слои становится видно по отдельности.

  float halfMin = max(min(u_halfSize.x, u_halfSize.y), 1.0);
  float bevel = max(u_bevel, 1.0);

  float sd = vgScene(p, u_halfSize, u_corner, u_morphOffset, u_morphHalf, u_morphCorner, u_morphK);
  float t = vgBevelT(sd, bevel);
  float2 n = vgSceneNormal(p, u_halfSize, u_corner, u_morphOffset, u_morphHalf, u_morphCorner, u_morphK);
  float3 N = normalize(float3(n * vgBevelSlope(t), 1.0));

  // Прогресс — активное состояние, ставшее полем: сыгранная часть блестит и светится ровно
  // настолько, насколько блестит активная деталь целиком. Краску это НЕ трогает: перекрашивать
  // надпись по ходу трека значит менять её посреди слова.
  float lit = max(u_active, vgProgress(p, u_halfSize, u_progress));

  // Блик и кромку считает линза: отражение — функция окружения, а его видно только оттуда.

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
    if (u_debug < 7.5) { return half4(0.0); }
    // Расщепление считает линза; здесь — поле, по которому оно нарастает.
    if (u_debug < 8.5) { return vgPack(vgHeat(u_dispersion * t * t), inMask); }
    if (u_debug < 9.5) { return vgPack(half3(N * 0.5 + 0.5), inMask); }
    // spectral и adapt показывает ЛИНЗА — поверхность обязана уйти с дороги.
    return half4(0.0);
  }

  // Тень и ореол живут СНАРУЖИ формы: внутри их место занимает само стекло. Отрыв от
  // контента держится именно на тени — без неё поверхность лежит НА картинке, а не над ней.
  // Тень живёт только у кромки и снаружи: при sd < −1 множитель outside и так ноль.
  // Считать её глубоко внутри формы — это лишняя ПОЛНАЯ оценка SDF на каждый такой пиксель,
  // а тело занимает почти всю площадь. Ветвление здесь по координате, но расходятся только
  // нити на самой кромке.
  // Касание зажигает материал изнутри от точки пальца (M 3:38, 12:05): свет расходится по
  // детали и стекает наружу, на подложку.
  float2 fromTouch = p - u_touch;
  float glowR = halfMin * 1.6;
  float touchGlow = u_press * exp(-dot(fromTouch, fromTouch) / (glowR * glowR));

  float shade = 0.0;
  float halo = 0.0;
  if (sd > -1.0) {
    float outside = smoothstep(-1.0, 1.0, sd);
    // Тень мягкая и широкая, со сдвигом вниз (M 11:58): отрыв детали от контента держит она.
    float sdDrop = vgScene(p - float2(0.0, u_shadowReach * 0.35), u_halfSize, u_corner,
                           u_morphOffset, u_morphHalf, u_morphCorner, u_morphK);
    float amb = 1.0 - smoothstep(-u_shadowReach * 0.3, u_shadowReach, sdDrop);
    float con = 1.0 - smoothstep(0.0, max(u_shadowReach * 0.12, 1.0), max(sd, 0.0));
    shade = (amb * amb * 0.14 + con * con * 0.10) * outside * u_shadow;
    halo = 1.0 - smoothstep(0.0, u_shadowReach * 0.30, max(sd, 0.0));
    halo = halo * halo * (lit * 0.10 + touchGlow * 0.35) * outside;
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
  // Прибавки плотности на нажатие здесь НЕТ. Она задумывалась как «деталь заметнее под
  // пальцем», но тянет тело к тинту, а тинт зависит от полярности: над светлым фоном
  // (полярность тёмная) нажатие ТЕМНИЛО деталь. Присутствие показывают деформация поля
  // vgTouchWarp и расцветающий блик ниже — им знак полярности безразличен.
  float a = max(body, vignette);

  // Цвет тела активность НЕ трогает. Подмешивание фиксированного серого сюда меняло знак
  // эффекта от фона: над тёмным деталь светлела, над светлым — темнела, хотя состояние одно
  // и то же. Активность показывают блик и подсветка кромки выше: им фон безразличен.

  // ЗНАЧОК ЛЕЖИТ ПОД ПОВЕРХНОСТЬЮ, а не наклеен на неё: раньше он подмешивался последним,
  // поверх блика, и читался плоским стикером на объёмном стекле. У кромки его уводит нормаль,
  // как всё, что видно сквозь стекло, а блик ложится СВЕРХУ — он живёт на самой поверхности.
  //
  // Никакой тени под значком здесь НЕТ. Она делалась разницей двух смещённых выборок маски и
  // давала по краю второй контур — границы значка выглядели рваными.
  // СДВИГ КРАСКИ ЗАДАН ЕЁ ГЛУБИНОЙ, А НЕ ШИРИНОЙ ФАСКИ. Краска лежит у самой поверхности, и
  // уводит её ровно та тонкая толща, что над ней, — а не то, насколько широкую фаску сняли у
  // этого куска стекла. Долей фаски это и было: на тонком стекле сдвиг выходил 4 dp и всё
  // сходилось, а на толстом — 8, и обложка, отбитая от края на 6, растягивалась к кромке и
  // вылезала за габарит. Потолок абсолютный: у краски одна глубина при любом стекле.
  float2 inkShift = n * (min(u_bevel * 0.5, VG_INK_DEPTH) * t);
  float2 inkUv = u_center + p - inkShift;

  half4 ink = u_icon.eval(inkUv * u_iconScale) * half(u_iconOn);

  // ПОДЛОЖКА ПОД КРАСКОЙ. Читаемость — требование МЕСТНОЕ, а не общее по детали. Гасить фон по
  // всей площади значит платить прозрачностью там, где гасить нечего: под пустым местом стекло
  // обязано оставаться стеклом. Плотность поднимается только под самой краской и в кайме
  // вокруг неё — так на стекле матируют зону под гравировкой, а не весь лист.
  //
  // Поле каймы приходит ГОТОВЫМ, красным каналом маски (контракт описан у iconMask в рендерере):
  // приложение размывает краску один раз на кадр настоящим гауссианом. Считать это поле здесь
  // нечем: кольцо отсчётов вокруг пикселя — то же недосэмплирование, что и в дисковом сборе,
  // и подложка выходила рваной, с видимой границей вокруг каждой группы букв.

  half inkA = ink.g * half(mix(0.82, 1.0, u_active));
  half3 inkCol = mix(half3(u_inkIdle.rgb), half3(u_inkActive.rgb), half(u_active));
  col = col * (1.0 - inkA) + inkCol * inkA;

  // ЦВЕТНОЙ КОНТЕНТ ЛЕЖИТ ТАМ ЖЕ, ГДЕ КРАСКА — внутри материала и на той же координате. Иначе
  // деформация ведёт их порознь: при нажатии название и артист трясутся вместе с поверхностью,
  // а обложка стоит на месте, потому что она была отдельным слоем поверх стекла. Полярность его
  // не трогает — у него свой цвет, и подменять его нечем.
  half4 over = u_overlay.eval(inkUv * u_iconScale) * half(u_overlayOn);
  col = col * (1.0 - over.a) + over.rgb * over.a;

  float glow = touchGlow * 0.45 + u_press * 0.06;
  col = col * half(1.0 - glow) + half3(half(glow));
  a = clamp(a + glow * (1.0 - a), 0.0, 1.0);
  a = max(a, max(float(inkA), float(over.a)));
  a *= 1.0 - smoothstep(-1.0, 1.0, sd);

  col = clamp(col, half3(0.0), half3(1.0));
  return half4(col * half(a), half(a + shade * (1.0 - a)));
}
`;
