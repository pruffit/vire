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
uniform float2 u_morph2Offset;
uniform float2 u_morph2Half;
uniform float  u_morph2Corner;

uniform float  u_press;
uniform float  u_active;
/* 0 — деталь под пальцем вдавливается, 1 — поднимается в стекло (эталон §5). */
uniform float  u_lift;

uniform float  u_edgeDensity;
uniform float  u_dispersion;
uniform float  u_refraction;
uniform float4 u_tint;
uniform float  u_shadow;
uniform float  u_shadowReach;
uniform float3 u_ambient;
uniform float  u_presence;
uniform float  u_progress;
uniform float  u_appear;
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
/* Доля оттенка окружения в тени. Тень обязана остаться тенью, а не цветным пятном. */
const float VG_SHADOW_TINT = 1.0;
// Насколько тень слабее у самого контура, чем под серединой зазора, и на какой доле выноса
// она добирает полную глубину. У эталона минимум тени стоит не у кромки, а ниже неё.
const float VG_GAP_LIGHT = 0.76;
const float VG_GAP_REACH = 0.20;
/* Глубина краски под поверхностью, dp. На столько её уводит нормаль у самой кромки. */
const float VG_INK_DEPTH = 4.0;
/* Расфокус краски под пальцем (эталон §6): глиф теряет кромку и тонет в молоке. Задан ДОЛЕЙ
 * пятна касания, а не числом: пятно уже приходит в единицах устройства, поэтому радиус сам
 * следует и за плотностью экрана, и за габаритом детали. В покое он нулевой, и выборка
 * остаётся одиночной. */
const float VG_INK_DEFOCUS = 0.08;

half4 vgPack(half3 c, float a) { return half4(c * half(a), half(a)); }

// В тень затекает ЦВЕТ окружения, а не его яркость: из оттенка вычитается его собственная
// светлота, иначе тень бледнеет и теряет глубину вместо того, чтобы потеплеть. Силу задаёт то,
// сколько света вокруг: на почти чёрном фоне затекать в тень нечему.
float3 vgShadowTint(float3 ambient) {
  float peak = max(max(ambient.r, ambient.g), max(ambient.b, 0.001));
  float3 hue = ambient / peak;
  float lumaWeights = dot(ambient, float3(0.2126, 0.7152, 0.0722));
  return (hue - dot(hue, float3(0.2126, 0.7152, 0.0722))) * lumaWeights;
}

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

  float sd = vgScene(p, u_halfSize, u_corner, u_morphOffset, u_morphHalf, u_morphCorner, u_morphK,
                u_morph2Offset, u_morph2Half, u_morph2Corner);
  float t = vgBevelT(sd, bevel);
  float2 n = vgSceneNormal(p, u_halfSize, u_corner, u_morphOffset, u_morphHalf, u_morphCorner, u_morphK,
                u_morph2Offset, u_morph2Half, u_morph2Corner);
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
  float shade = 0.0;
  float halo = 0.0;
  if (sd > -1.0) {
    float outside = smoothstep(-1.0, 1.0, sd);
    // Под пальцем кнопка идёт К подложке, и тень поджимается: она и есть зазор между ними.
    // Орган, поднимающийся в стекло (ручка свитча, ползунка — эталон §5), идёт ОТ неё, и тогда
    // тень, наоборот, отходит. Куда именно — знает только приложение, поэтому направление
    // приходит долей: 0 — вдавливание, как было у всех деталей до появления этого правила.
    float reach = u_shadowReach * (1.0 + mix(-0.25, 0.55, u_lift) * u_press);
    // Тень мягкая и широкая, со сдвигом вниз (M 11:58): отрыв детали от контента держит она.
    float sdDrop = vgScene(p - float2(0.0, reach * 0.35), u_halfSize, u_corner,
                           u_morphOffset, u_morphHalf, u_morphCorner, u_morphK,
                u_morph2Offset, u_morph2Half, u_morph2Corner);
    float amb = 1.0 - smoothstep(-reach * 0.3, reach, sdDrop);
    // ЗАЗОР ПОД ПОДНЯТОЙ ДЕТАЛЬЮ ПОДСВЕЧЕН: у самого контура тень СЛАБЕЕ, чем ниже. Иначе
    // минимум встаёт вплотную к силуэту — обе части тени монотонны по расстоянию.
    float gap = smoothstep(0.0, max(reach * VG_GAP_REACH, 1.0), max(sd, 0.0));
    shade = amb * amb * 0.13 * mix(VG_GAP_LIGHT, 1.0, gap) * outside * u_shadow * u_appear;
    halo = 1.0 - smoothstep(0.0, reach * 0.30, max(sd, 0.0));
    halo = halo * halo * lit * 0.10 * outside * u_appear;
  }

  if (sd > 1.0) {
    // Свет окружения затекает в тень (219 @8:22): она не чёрная дыра, а подкрашена тем, что
    // лежит рядом. Иначе деталь над цветным контентом висит на сером пятне.
    half3 spill = max(half3(half(halo)) + half3(vgShadowTint(u_ambient)) * half(VG_SHADOW_TINT * shade * (1.0 - halo)), half3(0.0));
    return half4(spill, half(halo + shade * (1.0 - halo)));
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

  // ПОД ПАЛЬЦЕМ КРАСКА ТЕРЯЕТ РЕЗКОСТЬ (эталон §6): у эталона глиф под нажатием тонет в
  // молоке, а не просто светлеет. Ветка однородна по всей детали: нажатие приходит униформой,
  // поэтому расфокус ничего не стоит, пока деталь не трогают.
  float defocus = VG_INK_DEFOCUS * u_touchRadius * u_touchPress;
  float2 inkDx = float2(defocus, 0.0);
  float2 inkDy = float2(0.0, defocus);

  half4 ink;
  half4 over;
  if (defocus > 0.01) {
    // Крест вокруг центра с двойным весом середины: маска краски контрастная, и четырёх
    // отсчётов хватает, чтобы штрих перестал держать кромку.
    ink = (u_icon.eval((inkUv - inkDx) * u_iconScale)
         + u_icon.eval((inkUv + inkDx) * u_iconScale)
         + u_icon.eval((inkUv - inkDy) * u_iconScale)
         + u_icon.eval((inkUv + inkDy) * u_iconScale)
         + u_icon.eval(inkUv * u_iconScale) * 2.0) * half(u_iconOn / 6.0);
    // Цветной контент лежит в той же плоскости, что краска, и расплывается вместе с ней:
    // разная резкость двух слоёв одной плоскости читалась бы дефектом, а не нажатием.
    over = (u_overlay.eval((inkUv - inkDx) * u_iconScale)
          + u_overlay.eval((inkUv + inkDx) * u_iconScale)
          + u_overlay.eval((inkUv - inkDy) * u_iconScale)
          + u_overlay.eval((inkUv + inkDy) * u_iconScale)
          + u_overlay.eval(inkUv * u_iconScale) * 2.0) * half(u_overlayOn * u_appear / 6.0);
  } else {
    ink = u_icon.eval(inkUv * u_iconScale) * half(u_iconOn);
    over = u_overlay.eval(inkUv * u_iconScale) * half(u_overlayOn * u_appear);
  }

  // Подложку под краской держит ЛИНЗА (плотность тела по зонду), а не поверхность: читаемость
  // — свойство материала, и считать её здесь второй раз значит развести два ответа на один вопрос.

  // Слои ложатся premultiplied-over: в прямой альфе почти прозрачное тёмное тело затягивало
  // цвет полупрозрачной краски и света пальца к себе — кромки букв серели, нажатие темнило.
  half3 pm = col * half(a);
  half inkA = ink.g * half(mix(0.82, 1.0, u_active) * u_appear);
  half3 inkCol = mix(half3(u_inkIdle.rgb), half3(u_inkActive.rgb), half(u_active));
  pm = pm * (1.0 - inkA) + inkCol * inkA;
  a = a + float(inkA) * (1.0 - a);

  // ЦВЕТНОЙ КОНТЕНТ ЛЕЖИТ ТАМ ЖЕ, ГДЕ КРАСКА — внутри материала и на той же координате. Иначе
  // деформация ведёт их порознь: при нажатии название и артист трясутся вместе с поверхностью,
  // а обложка стоит на месте, потому что она была отдельным слоем поверх стекла. Полярность его
  // не трогает — у него свой цвет, и подменять его нечем.
  pm = pm * (1.0 - over.a) + over.rgb * over.a;
  a = a + float(over.a) * (1.0 - a);

  // Свет от пальца собирает ЛИНЗА: это концентрат окружения, а не своя белизна. Поверхности
  // остаётся лишь то, что стекло выплёскивает наружу, — ореол выше.

  float mask = 1.0 - smoothstep(-1.0, 1.0, sd);
  pm = clamp(pm, half3(0.0), half3(1.0)) * half(mask);
  a *= mask;
  pm = max(pm + half3(vgShadowTint(u_ambient)) * half(VG_SHADOW_TINT * shade * (1.0 - a)), half3(0.0));
  return half4(pm, half(a + shade * (1.0 - a)));
}
`;
