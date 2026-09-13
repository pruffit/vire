import { VG_SDF } from './sdf';

// Исходник линзы собирается ЗДЕСЬ и уезжает в нативную вьюху пропом: AGSL и SKSL — один
// язык, поэтому геометрия у линзы и поверхности буквально одна и та же строка (`VG_SDF`).
//
// Стекло — толстая пластина с выпуклым закруглённым краем (docs/vireglass/reference.md §1).
// Луч сверху преломляется на верхней грани и приходит на контент со сдвигом ВНУТРЬ формы:
// середина не смещена, кромка показывает то, что лежит под телом детали.
//
// Униформы, кроме геометрии самой вьюхи, приезжают ОБЩИМ КАНАЛОМ (`adapters.ts` →
// `uniformNames`/`uniformSizes`/`uniformValues`). Отдельных Prop под каждую величину больше
// нет: именно они давали молчаливое отключение линзы при опечатке (material-lab.md E-01).
export const LENS_SHADER = `
uniform shader content;

// Знает только сама вьюха: свой размер и своё место на экране.
uniform float2 u_center;
uniform float  u_reach;
uniform float2 u_contentMin;
uniform float2 u_contentMax;
// Оценка фона ПОД стеклом из нативного зонда: светлота, пестрота и средний цвет, уже
// сглаженные по времени. Отрицательная светлота — зонда ещё нет, держимся на своих отсчётах.
uniform float  u_probeLuma;
uniform float  u_probeBusy;
// Края диапазона светлоты под стеклом: над границей чёрного и белого среднее — серый, при
// котором «всё в порядке», а надпись тонет над светлой половиной.
uniform float2 u_probeRange;
// Наклон светлоты по поверхности, доли на полуразмер: тонирование градиентное, одна
// плотность на деталь не разводит надпись с обеими половинами фона.
uniform float2 u_probeSlope;
uniform float3 u_probe;

// Материал — общим каналом из JS, уже в пикселях устройства.
uniform float2 u_halfSize;
uniform float  u_corner;
uniform float  u_bevel;
uniform float  u_thick;
uniform float  u_rim;
uniform float  u_ior;
uniform float  u_iorSpread;
uniform float2 u_light;
uniform float  u_appear;
uniform float4 u_accent;
uniform float  u_frost;
uniform float  u_ink;
uniform float  u_legibility;
uniform float  u_dim;
uniform float  u_presence;
uniform float  u_progress;
uniform float  u_adaptRadius;
uniform float  u_bodyDensity;
uniform float  u_edgeLight;
uniform float  u_fresnel;
uniform float  u_specular;
uniform float  u_reflectReach;
uniform float  u_film;
uniform float  u_iridescence;
uniform float  u_diffraction;
uniform float  u_colorPickup;
uniform float2 u_morphOffset;
uniform float2 u_morphHalf;
uniform float  u_morphCorner;
uniform float  u_morphK;
uniform float2 u_morph2Offset;
uniform float2 u_morph2Half;
uniform float  u_morph2Corner;
uniform float  u_debug;
uniform float2 u_touch;
uniform float2 u_pull;
uniform float  u_touchPress;
uniform float  u_touchRadius;
uniform float2 u_wave;

${VG_SDF}

// Отсчётов в дисковом сборе: на резкой границе меньшее число читается лесенкой из копий.
const int   VG_FROST_TAPS = 20;
// Число проб растёт с площадью круга: шум оценки — разброс под стеклом, делённый на корень
// из числа проб. Потолок — цена: выборка текстуры здесь самое дорогое.
const int   VG_FROST_TAPS_MAX = 64;
// Поправка радиуса на сжатие фона у кромки ограничена: у силуэта она уходит в бесконечность.
const float VG_FOOTPRINT_MAX = 1.8;
const float VG_TAU = 6.28318530718;
// Потолок светлоты тела под светлой надписью (и зеркальный пол под тёмной). Это потолок, а
// не разность: «на 0.14 темнее белого» — светлота 0.86, на которой белый текст не виден.
const float VG_BODY_CAP_LOOSE = 0.62;
const float VG_BODY_CAP_TIGHT = 0.38;
// Светлота тинта в двух направлениях: у стекла тело не бывает ни угольным, ни бумажным.
const float VG_TINT_DARK = 0.07;
const float VG_TINT_LIGHT = 0.94;
// Опорные длины волн каналов, нм — для дифракции и интерференции.
const float3 VG_LAMBDA = float3(610.0, 550.0, 460.0);
// Показатель преломления плёнки: у всех тонких плёнок на стекле он около этого.
const float VG_FILM_IOR = 1.35;
// Потолок наклона профиля у самого силуэта: там он уходит в бесконечность.
const float VG_SLOPE_MAX = 40.0;
// Доля радиуса сбора, до которой доходит рассеяние над пёстрым фоном под краской (M 11:47).
// Выставлена по эталону: там структура под капсулой гаснет в 9–10 раз, а не в тридцать.
const float VG_SCATTER_MAX = 0.20;
const float VG_SCATTER_BASE = 0.1;
// Отклик на структуру под стеклом насыщается рано: спорит с надписью не площадь чужого
// текста, а сам факт его наличия (строка под плашкой даёт busy около 0.12).
const float VG_STRUCTURE_GAIN = 20.0;
// Насколько плотнее тело с краской над ПЁСТРЫМ фоном, чем над спокойным. Ровного пола здесь
// нет: читаемость набирает адресное требование ниже, а базовую матовость — VG_MATTE_LIFT.
const float VG_GROUND_SPAN = 0.06;
// Рассеянный свет матовой детали — ДОБАВКА поверх фона, а не доля пути к тинту: доля обнуляется,
// когда полотно доходит до светлоты тинта, и выше неё темнит (bench 2026-09-13-matte).
const float VG_MATTE_LIFT = 0.10;
// Доля разброса фона, которая доживает до тела сквозь рассеяние: требование читаемости
// считается от этого края, а не от средней светлоты места.
const float VG_BUSY_EDGE = 0.75;
// Концентрация света: тело чуть светлее того, что под ним (M 2:29).
const float VG_CONCENTRATE = 0.01;
// Светлота, к которой среда стягивает содержимое под стеклом, и сила этой стяжки. Среда и
// забирает свет, и подмешивает рассеянный: над светлым фоном тело темнеет, над тёмным светлеет.
const float VG_MEDIUM_LUMA = 0.40;
const float VG_MEDIUM_PULL = 0.07;
// Сколько света окружения доходит до тела поверх стяжки.
const float VG_AMBIENT_SPILL = 0.01;

float vgLuma(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }

// Разворот premultiplied в обычный цвет. Деление одно и в float: у half около нуля шаг
// слишком грубый, и несколько делений подряд поднимают шум.
float3 vgUnpack(half4 c) {
  float a = float(c.a);
  return a > 0.004 ? float3(c.rgb) / a : float3(0.0);
}

// Захват кончается на краю экрана: выборку прижимаем к прямоугольнику, где контент есть,
// иначе у стекла во всю ширину по кромкам появлялась полоса пустоты.
float2 vgInContent(float2 q) { return clamp(q, u_contentMin, u_contentMax); }

// Оттенок без светлоты. Ниже порога у цвета оттенка нет, а деление улетает.
float3 vgHue(float3 c) {
  float l = vgLuma(c);
  if (l < 0.02) { return float3(1.0); }
  return clamp(c / l, float3(0.0), float3(2.0));
}

// Профиль края — выпуклый сквиркл: x = 0 у силуэта, 1 там, где закругление переходит в плоскость.
float vgRimQ(float x) {
  float k = 1.0 - x;
  return sqrt(sqrt(max(1.0 - k * k * k * k, 0.0)));
}

float vgRimQd(float x) {
  float k = 1.0 - x;
  return k * k * k / pow(max(1.0 - k * k * k * k, 1e-5), 0.75);
}

// Высота стекла над контентом на расстоянии e от силуэта.
float vgHeight(float e, float w) {
  return mix(u_rim, u_thick, vgRimQ(clamp(e / w, 0.0, 1.0)));
}

// Наклон верхней грани там же: производная высоты по расстоянию от силуэта.
float vgSlope(float e, float w) {
  if (e >= w) { return 0.0; }
  return min((u_thick - u_rim) / w * vgRimQd(clamp(e / w, 0.0, 1.0)), VG_SLOPE_MAX);
}

// Куда уходит луч, упавший сверху на грань с нормалью N: преломление по Снеллу, затем путь
// сквозь толщу z до контента. Выпуклая грань гнёт луч к нормали — то есть внутрь формы.
float2 vgShift(float3 N, float z, float ior) {
  float3 T = refract(float3(0.0, 0.0, -1.0), N, 1.0 / ior);
  return z * T.xy / max(-T.z, 0.05);
}

// Интерференция в тонкой плёнке: разность хода 2·n·d·cosθt, у каждого канала своя λ.
// Возвращается оттенок, нормированный на своё среднее, — красит, но не осветляет.
float3 vgInterference(float cosI) {
  float sinT2 = (1.0 - cosI * cosI) / (VG_FILM_IOR * VG_FILM_IOR);
  float cosT = sqrt(max(1.0 - sinT2, 0.0));
  float opd = 2.0 * VG_FILM_IOR * u_film * cosT;
  float3 i = 0.5 + 0.5 * cos(VG_TAU * opd / VG_LAMBDA + 3.14159265);
  return i / max((i.r + i.g + i.b) / 3.0, 0.001);
}

// Дифракция на кромке: полосы тем чаще, чем острее фаска. Тоже оттенок, не яркость.
float3 vgDiffraction(float distFromEdge, float bevel) {
  float phase = VG_TAU * 4.0 * distFromEdge / max(bevel, 1.0);
  float3 d = 0.5 + 0.5 * cos(phase * (550.0 / VG_LAMBDA));
  return d / max((d.r + d.g + d.b) / 3.0, 0.001);
}

float vgHash(float2 p) {
  return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453);
}

// Мягкое сжатие вместо жёсткого клампа: на белом фоне добавки выбивали канал в единицу, и
// стекло превращалось в плоское пятно без деталей.
float3 vgSoftClip(float3 c) {
  float3 over = max(c - 0.86, float3(0.0));
  return min(c, float3(0.86)) + over * 0.14 / (0.14 + over);
}

// Собственное размытие: захват оставлен чистым, размывает шейдер — усреднение в float само
// сглаживает полосы и своего шума не добавляет. Спираль с золотым углом, развёрнутая на свой
// угол в каждом пикселе: с общим углом соседние пиксели брали одни и те же отсчёты, и фактура
// под стеклом читалась комками. Складываем premultiplied — разворот один и общий.
float4 vgGather(float2 q, float radius, float2 seed) {
  float4 acc = float4(content.eval(vgInContent(q)));
  if (radius <= 0.25) { return acc; }
  if (radius < 4.0) {
    float r = radius * 0.7;
    acc += float4(content.eval(vgInContent(q + float2(r, 0.0))))
      + float4(content.eval(vgInContent(q - float2(r, 0.0))))
      + float4(content.eval(vgInContent(q + float2(0.0, r))))
      + float4(content.eval(vgInContent(q - float2(0.0, r))));
    return acc * 0.2;
  }
  float ca = cos(2.39996323);
  float sa = sin(2.39996323);
  float a0 = vgHash(seed) * 6.28318530718;
  float2 dir = float2(cos(a0), sin(a0));
  float wide = radius * 0.5;
  int taps = int(clamp(float(VG_FROST_TAPS) * wide * wide, float(VG_FROST_TAPS), float(VG_FROST_TAPS_MAX)));
  for (int i = 1; i <= VG_FROST_TAPS_MAX; i++) {
    if (i > taps) { break; }
    dir = float2(dir.x * ca - dir.y * sa, dir.x * sa + dir.y * ca);
    float r = radius * sqrt(float(i) / float(taps));
    acc += float4(content.eval(vgInContent(q + dir * r)));
  }
  return acc / float(taps + 1);
}

half4 main(float2 xy) {
  float2 p = vgTouchWarp(xy - u_center, u_touch, u_pull, u_touchPress, u_touchRadius, u_wave.x, u_wave.y);
  float sd = vgScene(p, u_halfSize, u_corner, u_morphOffset, u_morphHalf, u_morphCorner, u_morphK,
                u_morph2Offset, u_morph2Half, u_morph2Corner);
  // Снаружи стекла нет — кроме света, который оно выплёскивает под пальцем на подложку
  // (M 3:38): это тот же концентрат окружения, что и внутри, поэтому над тёмным фоном
  // белого ореола не возникает.
  if (sd > 1.0) {
    float spill = u_touchPress * exp(-sd / max(min(u_halfSize.x, u_halfSize.y) * 0.5, 4.0)) * 0.5 * u_appear;
    if (spill < 0.004) { return half4(0.0); }
    float3 lit = clamp((u_probeLuma >= 0.0 ? u_probe : float3(0.35)) * 1.6 + float3(0.1), float3(0.0), float3(1.0));
    return half4(half3(lit * spill), half(spill));
  }

  float bevel = max(u_bevel, 1.0);
  float e = max(-sd, 0.0);
  // 0 в плоской середине, 1 у силуэта.
  float t = 1.0 - clamp(e / bevel, 0.0, 1.0);
  float2 n = vgSceneNormal(p, u_halfSize, u_corner, u_morphOffset, u_morphHalf, u_morphCorner, u_morphK,
                u_morph2Offset, u_morph2Half, u_morph2Corner);

  // Режим «бэкдроп» отдаёт содержимое как есть — это опорная точка для сравнения оптики.
  float on = u_debug > 5.5 && u_debug < 6.5 ? 0.0 : 1.0;
  float lens = on * u_appear;

  float z = vgHeight(e, bevel);
  float slope = vgSlope(e, bevel);
  float3 N = normalize(float3(n * slope, 1.0));
  float2 shift = vgShift(N, z, u_ior) * lens;
  float2 s = u_center + p + shift;

  // Площадь, которую линза собирает в один пиксель: шаг на пиксель внутрь по экрану против
  // шага выборки. У силуэта он велик — там полоса фона сжата в линию, и точка даёт зерно.
  float e1 = e + 1.0;
  float3 N1 = normalize(float3(n * vgSlope(e1, bevel), 1.0));
  float2 shift1 = vgShift(N1, vgHeight(e1, bevel), u_ior) * lens;
  float footprint = length(shift1 - shift - n);
  float spread = max(footprint - 1.0, 0.0) * 0.5 * on;

  // Дисперсия: тот же луч с показателем каждого канала. Синий гнётся сильнее красного.
  float2 dR = vgShift(N, z, u_ior - 0.4 * u_iorSpread) * lens - shift;
  float2 dB = vgShift(N, z, u_ior + 0.6 * u_iorSpread) * lens - shift;
  float chroma = length(dB - dR);

  float3 rgb;
  float srcA;

  if (chroma + spread < 0.25) {
    // В плоском теле все отсчёты легли бы в одну точку, а тело — почти вся площадь стекла.
    half4 c = content.eval(vgInContent(s));
    srcA = float(c.a);
    rgb = srcA > 0.004 ? float3(c.rgb) / srcA : float3(0.0);
  } else {
    // Складываем premultiplied и делим один раз на пару: каналы из разных точек с разной
    // альфой иначе дают на границах контента цветную кайму, которой в нём нет.
    float2 ev = n * spread;
    half4 c0 = content.eval(vgInContent(s + dR - ev));
    half4 c1 = content.eval(vgInContent(s + dR + ev));
    half4 c2 = content.eval(vgInContent(s - ev));
    half4 c3 = content.eval(vgInContent(s + ev));
    half4 c4 = content.eval(vgInContent(s + dB - ev));
    half4 c5 = content.eval(vgInContent(s + dB + ev));

    float aR = float(c0.a + c1.a) * 0.5;
    float aG = float(c2.a + c3.a) * 0.5;
    float aB = float(c4.a + c5.a) * 0.5;
    rgb = float3(
      aR > 0.004 ? float(c0.r + c1.r) * 0.5 / aR : 0.0,
      aG > 0.004 ? float(c2.g + c3.g) * 0.5 / aG : 0.0,
      aB > 0.004 ? float(c4.b + c5.b) * 0.5 / aB : 0.0);
    srcA = (aR + aG + aB) / 3.0;
  }

  // «ПОДЛОЖКА» — сверка ЗАХВАТА, а не облегчённая оптика. Дальше идут слои, не завязанные на
  // линзу (тело, среда, рассеяние), и они смешивали вопрос «дошли ли пиксели» с вопросом «как
  // мы их обработали». Здесь деталь обязана ИСЧЕЗНУТЬ: видимый силуэт = потеря в захвате.
  if (u_debug > 5.5 && u_debug < 6.5) {
    float bypass = srcA * (1.0 - smoothstep(-1.0, 1.0, sd));
    return half4(half3(clamp(rgb, float3(0.0), float3(1.0)) * bypass), half(bypass));
  }

  // Затемняющий слой прозрачного варианта держит читаемость вместо тела. Умножение, а не тинт:
  // контент обязан остаться видимым, только тише.
  rgb *= 1.0 - u_dim * u_appear;

  // ОТРАЖЕНИЕ. Френель по настоящему наклону грани: у силуэта взгляд скользящий и отражение
  // почти полное, поэтому кромка — тонкая линия сама. Отражается окружение детали и ключевой свет.
  float cosT = clamp(N.z, 0.0, 1.0);
  float f0 = (u_ior - 1.0) / (u_ior + 1.0);
  f0 *= f0;
  float fres = (f0 + (1.0 - f0) * pow(1.0 - cosT, 5.0)) * u_fresnel * lens;

  float lineW = clamp(min(u_halfSize.x, u_halfSize.y) * 0.03, 1.5, 5.0);
  float3 refl;
  if (e < lineW * 2.0 || fres > 0.01) {
    float2 around = u_center + p + n * (u_reflectReach * mix(0.35, 1.0, clamp(slope / 3.2, 0.0, 1.0)));
    // Два кольца по восемь отсчётов: один сдвинутый отсчёт — это неискажённая КОПИЯ соседнего
    // содержимого внутри стекла (material-lab.md E-33).
    float p1 = u_reflectReach * 0.75;
    float p2 = u_reflectReach * 0.4;
    float d = 0.7071;
    float4 rsum = float4(content.eval(vgInContent(around + float2(p1, 0.0))))
      + float4(content.eval(vgInContent(around - float2(p1, 0.0))))
      + float4(content.eval(vgInContent(around + float2(0.0, p1))))
      + float4(content.eval(vgInContent(around - float2(0.0, p1))))
      + float4(content.eval(vgInContent(around + float2(p2, p2) * d)))
      + float4(content.eval(vgInContent(around + float2(-p2, p2) * d)))
      + float4(content.eval(vgInContent(around + float2(p2, -p2) * d)))
      + float4(content.eval(vgInContent(around + float2(-p2, -p2) * d)));
    float ra = rsum.a * 0.125;
    refl = ra > 0.004 ? rsum.rgb * 0.125 / ra : float3(0.0);
  } else {
    refl = u_probeLuma >= 0.0 ? u_probe : rgb;
  }

  // Свет, доходящий до тела, одинаков по всей детали: смесь с окрестностью по полосе фаски
  // рисовала на теле кольцевой шов.
  float3 ambient = u_probeLuma >= 0.0 ? u_probe : rgb;

  // Свет приходит оттуда, где окружение ярче (M 11:04): наклон светлоты под деталью тянет
  // ключевой свет на себя, а на ровном фоне он остаётся в покое.
  float2 bright = u_probeLuma >= 0.0 ? u_probeSlope : float2(0.0);
  float brightLen = length(bright);
  float2 L = normalize(mix(u_light, bright / max(brightLen, 1e-4), smoothstep(0.03, 0.2, brightLen)) + float2(1e-5));
  // Отражение ключевого света — по настоящей нормали грани: у плоского верха она смотрит
  // вверх, и зависеть от направления там нечему. По нормали SDF тело заливалось конусом.
  float facing = dot(N.xy, L);
  float key = u_specular * (pow(max(facing, 0.0), 3.0) + 0.45 * pow(max(-facing, 0.0), 3.0));
  float rimFacing = dot(n, L);
  float rimKey = u_specular * (pow(max(rimFacing, 0.0), 3.0) + 0.45 * pow(max(-rimFacing, 0.0), 3.0));
  // Где ключевой свет не падает, грань отражает затенённое окружение — отсюда тёмная обводка.
  float3 env = refl * (0.55 + 0.45 * min(key, 1.0)) + float3(1.2 * key);

  // Интерференция и дифракция живут в отражённом луче на скользящем угле — один множитель
  // оттенка к отражению, без лишних выборок.
  float3 spectral = float3(1.0);
  if (u_iridescence > 0.001) {
    spectral *= mix(float3(1.0), vgInterference(cosT), u_iridescence);
  }
  if (u_diffraction > 0.001) {
    float w = u_diffraction * smoothstep(0.45, 1.0, t);
    spectral *= mix(float3(1.0), vgDiffraction(e, bevel), w);
  }

  // ОЦЕНКА ФОНА приходит из зонда одной величиной на поверхность: считать её здесь по
  // отсчётам нельзя — излом плотности превращал дискретность оценки в призрачные копии текста.
  float3 wide;
  float busy;
  if (u_probeLuma >= 0.0) {
    wide = u_probe;
    busy = u_probeBusy;
  } else {
    // Зонд ещё не отчитался (первые кадры) — держимся на своих отсчётах.
    float2 wx = float2(u_adaptRadius, 0.0);
    float2 wy = float2(0.0, u_adaptRadius);
    float3 w0 = vgUnpack(content.eval(vgInContent(s + wx)));
    float3 w1 = vgUnpack(content.eval(vgInContent(s - wx)));
    float3 w2 = vgUnpack(content.eval(vgInContent(s + wy)));
    float3 w3 = vgUnpack(content.eval(vgInContent(s - wy)));
    wide = (w0 + w1 + w2 + w3) * 0.25;
    float lw = vgLuma(wide);
    // Та же статистика, что у зонда (удвоенное среднее отклонение): от неё зависит не только
    // размытие, но и запас контраста краски, и масштабы двух путей расходиться не должны.
    busy = clamp(0.5 * (abs(vgLuma(w0) - lw) + abs(vgLuma(w1) - lw)
      + abs(vgLuma(w2) - lw) + abs(vgLuma(w3) - lw)), 0.0, 1.0);
  }
  // Светлота в ЭТОМ месте поверхности: плоскость зонда, зажатая в измеренный диапазон.
  float2 nrm = p / max(u_halfSize, float2(1.0));
  float local = u_probeLuma >= 0.0
    ? clamp(u_probeLuma + dot(u_probeSlope, nrm), u_probeRange.x, u_probeRange.y)
    : vgLuma(wide);
  float mean = u_probeLuma >= 0.0 ? u_probeLuma : vgLuma(wide);

  // РАССЕЯНИЕ. Regular приглушает чужую структуру под своей краской размытием, а не заливкой
  // (M 11:47): текст под капсулой становится пятнами. Одинаково по всей линзе, радиус меряется
  // в фоне — у силуэта линза его сжимает.
  float structure = 1.0 - exp(-busy * VG_STRUCTURE_GAIN);
  // Под краской Regular рассеивает фон всегда, над пёстрым — сильнее.
  float adaptBlur = max(
    (structure * VG_SCATTER_MAX + VG_SCATTER_BASE) * u_legibility * u_adaptRadius
      * min(max(footprint, 1.0), VG_FOOTPRINT_MAX),
    u_frost) * u_appear;
  if (adaptBlur > 0.5) {
    float reach = max(u_reach - length(p), 1.0);
    float4 g = vgGather(s, min(adaptBlur, reach), xy);
    float ga = g.a;
    float3 blurred = ga > 0.004 ? g.rgb / ga : float3(0.0);
    rgb = mix(rgb, blurred, smoothstep(0.5, 2.0, adaptBlur));
  }

  // ПОСЛЕ рассеяния, а не до: рассеяние — свойство ПРОШЕДШЕГО света и заменяет rgb целиком, так
  // что обратный порядок стирал отражение на всей детали (issue #106).
  rgb = mix(rgb, env * spectral, fres);

  // ТЕЛО. Тинт и динамический диапазон под стеклом сжимаются ровно настолько, чтобы надпись
  // поверх читалась (M 6:42). u_ink — ПОЛЯРНОСТЬ надписи (1 светлая, 0 тёмная): требования
  // считаются на концах и смешиваются по ней, иначе на перекраске стекло ныряет в середину.
  float strict = clamp(u_legibility * 2.0, 0.0, 1.0);
  float capLight = mix(VG_BODY_CAP_LOOSE, VG_BODY_CAP_TIGHT, strict);
  float floorDark = 1.0 - capLight;
  float pol = clamp(u_ink, 0.0, 1.0);
  // Требование гаснет вместе с legibility: детали без краски модель обещает прозрачное стекло.
  float demand = clamp(u_legibility * 4.0, 0.0, 1.0);

  // Где надписи нет, стекло тонируется в сторону от фона. Сторону выбирает средняя светлота
  // под деталью, а не светлота места: иначе на градиенте порог проходит по телу косой ступенью.
  float darkSide = smoothstep(0.42, 0.58, mean);
  float away = mix(VG_TINT_LIGHT, VG_TINT_DARK, darkSide);
  float tintLuma = mix(away, mix(VG_TINT_LIGHT, VG_TINT_DARK, pol), demand);

  // Сколько среды нужно, чтобы увести светлоту под надписью за порог — по месту. Считается от
  // того края разброса фона, который ближе к краске: светлую надпись топит светлое пятно под
  // ней, а средняя светлота места про это пятно не знает.
  float edge = busy * VG_BUSY_EDGE;
  float inkHi = min(local + edge, 1.0);
  float inkLo = max(local - edge, 0.0);
  float needForLight = inkHi > capLight
    ? clamp((inkHi - capLight) / max(inkHi - VG_TINT_DARK, 1e-4), 0.0, 0.92)
    : 0.0;
  float needForDark = inkLo < floorDark
    ? clamp((floorDark - inkLo) / max(VG_TINT_LIGHT - inkLo, 1e-4), 0.0, 0.92)
    : 0.0;
  float needForInk = mix(needForDark, needForLight, pol) * demand;

  float ground = structure * u_legibility * VG_GROUND_SPAN;
  float density = max(max(u_bodyDensity, ground), needForInk);

  // Своего цвета у стекла нет — только цвет того, что под ним (HIG «Color»).
  float3 tintHue = mix(float3(1.0), vgHue(wide * 0.5 + ambient * 0.5), u_colorPickup);
  // Появляется деталь нарастанием линзы и тела, а не прозрачностью (M 2:55): при u_appear = 0
  // она неотличима от фона под ней.
  rgb = mix(rgb, tintHue * tintLuma, density * u_appear);
  rgb += tintHue * (u_legibility * VG_MATTE_LIFT * u_appear);

  // ТОНИРОВАНИЕ — цветное стекло, а не заливка (M 16:31, 17:03): тон ведёт светлота фона,
  // над тёмным он глубже, над светлым светлее, и фактура контента видна сквозь цвет.
  if (u_accent.a > 0.0) {
    float3 tone = u_accent.rgb * mix(0.88, 1.08, local);
    float3 through = tone * (0.85 + 0.3 * vgLuma(rgb));
    rgb = mix(rgb, clamp(through, float3(0.0), float3(1.0)), u_accent.a * u_appear);
  }

  // СЖАТИЕ КОНТРАСТА. Среда забирает часть света и подмешивает рассеянный, поэтому содержимое
  // под стеклом идёт к середине, а не просто светлеет (M 2:35). Прежний слой только добавлял
  // свет и над светлым фоном уводил тело в сторону, противоположную эталону.
  rgb = mix(rgb, vgHue(ambient) * VG_MEDIUM_LUMA, VG_MEDIUM_PULL * u_appear);
  // Свет окружения доходит до тела одинаково по всей детали.
  rgb += ambient * u_edgeLight * VG_AMBIENT_SPILL * u_appear;
  // Стекло концентрирует свет; сыгранная часть — участок, где его больше.
  float glow = VG_CONCENTRATE + 0.08 * vgProgress(p, u_halfSize, u_progress);
  rgb += (1.0 - rgb) * glow * lens;

  // Под пальцем и в морфинге стекло сгущает свет в пятно (M 4:56, 5:11). Это КОНЦЕНТРАТ
  // окружения, а не собственная белизна: над тёмным фоном деталь светлеет, но белой не
  // становится, и краска поверх неё остаётся читаемой.
  if (u_touchPress > 0.001) {
    float2 fromTouch = p - u_touch;
    float spotR = max(min(u_halfSize.x, u_halfSize.y) * 1.2, 1.0);
    float spot = u_touchPress * (0.3 + 0.55 * exp(-dot(fromTouch, fromTouch) / (spotR * spotR)));
    rgb = mix(rgb, clamp(ambient * 1.6 + float3(0.1), float3(0.0), float3(1.0)), spot * lens);
  }

  // КРОМОЧНЫЙ СВЕТ — отдельный слой, линия в ~1 pt по силуэту (M 2:36, 11:04): ярче там, где
  // грань смотрит на ключевой свет, слабее напротив; где свет не падает — тёмная обводка.
  // Различимость детали держит эта линия, а не заливка тела: над ровным фоном у элемента
  // управления она видна по всему силуэту.
  float line = (1.0 - smoothstep(0.0, lineW, e)) * lens;
  float outline = (1.0 - smoothstep(0.0, lineW * 0.6, e)) * lens;
  float lit = clamp(max(rimKey * 1.4, u_presence * 2.0), 0.0, 1.0);
  // Тёмная кромка — самостоятельный слой по всему силуэту, блик ложится ПОВЕРХ неё (iOS 27).
  // Пока обводка гасла множителем (1 − lit), силуэт читался одной дугой: блик ИЛИ тень.
  rgb *= 1.0 - 0.22 * outline;
  rgb = mix(rgb, mix(refl, float3(1.0), 0.75), line * lit);

  if (u_debug > 9.5 && u_debug < 10.5) { rgb = spectral * 0.5; }
  if (u_debug > 10.5 && u_debug < 11.5) { rgb = float3(density, needForInk, structure); }
  // ЧТО ЗОНД СКАЗАЛ ПРО ФОН — три величины, от которых зависит всё тонирование: средняя
  // светлота под деталью, наклон светлоты по вертикали и светлота В ЭТОМ месте. Наклон ложится
  // со сдвигом и вдвое ужатым: он знакопеременный и по модулю редко больше половины.
  if (u_debug > 11.5) { rgb = float3(max(u_probeLuma, 0.0), 0.5 + u_probeSlope.y * 0.5, local); }

  rgb = vgSoftClip(rgb);

  // Альфа выборок обязана дожить до результата: развернуть цвет по исходной альфе, а вернуть
  // с чужой (маской формы) — значит сделать прозрачный бэкдроп непрозрачным и засветить его.
  float alpha = srcA * (1.0 - smoothstep(-1.0, 1.0, sd));
  return half4(half3(clamp(rgb, float3(0.0), float3(1.0)) * alpha), half(alpha));
}
`;
