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
uniform float  u_frost;
uniform float  u_reach;
uniform float2 u_contentMin;
uniform float2 u_contentMax;
uniform float  u_ink;
uniform float  u_legibility;
uniform float  u_adaptRadius;
uniform float3 u_bodyTint;
uniform float  u_bodyDensity;
uniform float  u_edgeLight;
uniform float  u_fresnel;
uniform float  u_fresnelPower;
uniform float  u_reflectReach;
uniform float2 u_morphOffset;
uniform float2 u_morphHalf;
uniform float  u_morphCorner;
uniform float  u_morphK;
uniform float  u_debug;

${VG_SDF}

const float VG_FALLOFF = ${VG_FALLOFF};
const int   VG_FROST_TAPS = 12;
// Разделение по светлоте, которое стекло обязано обеспечить надписи поверх себя при
// полной читаемости. Величина модели, а не ручка: ниже неё текст начинает тонуть.
const float VG_SEPARATION = 0.52;
// Светлота тинта в двух направлениях. Не чистые 0 и 1: у стекла тело не бывает ни угольным,
// ни бумажным, и упор в края даёт плоскую заливку вместо среды.
const float VG_TINT_DARK = 0.07;
const float VG_TINT_LIGHT = 0.94;

float vgLuma(float3 c) { return dot(c, float3(0.2126, 0.7152, 0.0722)); }

// Разворот premultiplied в обычный цвет. Деление одно и в float: у half около нуля шаг
// слишком грубый, и несколько делений подряд поднимают шум.
float3 vgUnpack(half4 c) {
  float a = float(c.a);
  return a > 0.004 ? float3(c.rgb) / a : float3(0.0);
}

// Захват кончается на краю экрана. Выборка, ушедшая за него, возвращает пустоту, и у
// стекла во всю ширину вдоль левой и правой кромок появлялась полоса вообще без
// преломления. Прижимаем координату к прямоугольнику, где контент есть: кромка тогда
// сжимает последний доступный кусок фона, а не проваливается в дыру.
float2 vgInContent(float2 q) { return clamp(q, u_contentMin, u_contentMax); }


// СОБСТВЕННОЕ РАЗМЫТИЕ. Платформенный блюр (dimezisBlurView) уменьшает вьюху, размывает и
// растягивает обратно, а полосы от 8-битного округления разбивает дизерингом — это и есть
// зерно, которое видно на тёмных участках. Замерено в стенде: в режиме backdrop, где все
// отсчёты берутся из одной точки, зерно есть, а при нулевой интенсивности захвата его нет.
// Поэтому BlurView оставлен чистым захватом, а размывает шейдер: усреднение отсчётов в float
// само сглаживает полосы и своего шума не добавляет.
//
// Отсчёты идут по спирали с золотым углом — равномерное покрытие диска без регулярной сетки,
// на которой был бы виден муар. Складываем PREMULTIPLIED — так усредняются полупрозрачные
// пиксели, разворот один и общий.
float4 vgGather(float2 q, float radius) {
  float4 acc = float4(content.eval(vgInContent(q)));
  if (radius <= 0.25) { return acc; }
  float ca = cos(2.39996323);
  float sa = sin(2.39996323);
  float2 dir = float2(1.0, 0.0);
  for (int i = 1; i <= VG_FROST_TAPS; i++) {
    dir = float2(dir.x * ca - dir.y * sa, dir.x * sa + dir.y * ca);
    float r = radius * sqrt(float(i) / float(VG_FROST_TAPS));
    acc += float4(content.eval(vgInContent(q + dir * r)));
  }
  return acc / float(VG_FROST_TAPS + 1);
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

  // ПЛОЩАДНОЕ ИНТЕГРИРОВАНИЕ. Настоящая линза собирает свет с площади, а мы берём точечные
  // отсчёты — поэтому там, где смещение выборки меняется быстро, по резкому фону идёт зерно.
  // Ширина площадки равна скорости изменения смещения на пиксель: смещение растёт как
  // edgePush · t^FALLOFF по всей фаске, значит его производная по экрану есть
  // edgePush · FALLOFF · t^(FALLOFF−1) / bevel.
  //
  // Расширяем ею тот же разброс, по которому уже идут шесть отсчётов: они лежат вдоль
  // нормали — ровно по той оси, где смещение и меняется быстрее всего. Лишних выборок нет.
  float footprint = u_edgePush * VG_FALLOFF * pow(t, VG_FALLOFF - 1.0) / max(u_bevel, 1.0);
  // Слабая мутность живёт в том же разбросе, что и площадка: шести отсчётов на неё хватает,
  // и хроматика при этом остаётся. Отдельный площадной сбор включается только там, где
  // рассеяние действительно широкое и направленный разброс дал бы полосу вместо матовости.
  float spread = max(max(u_spherical * t * t, footprint), min(u_frost, 3.0)) * on;
  float chroma = u_chroma * on * t * t;

  float3 rgb;
  float srcA;

  if (u_frost > 3.0) {
    // Матовая поверхность: направленная хроматика и площадка тонут в рассеянии, и шесть
    // отсчётов вдоль нормали дали бы полосу, а не матовость. Берём один площадной сбор.
    // Ветвление по униформе — одинаковое для всего стекла, расхождения нитей нет.
    // Радиус жёстко ограничен запасом вьюхи: дальше него содержимого нет совсем, и
    // отсчёты вернули бы прозрачность вместо фона — стекло становилось ровной плашкой.
    float reach = max(u_reach - length(p), 1.0);
    float4 g = vgGather(s, min(max(u_frost, spread), reach));
    srcA = g.a;
    rgb = srcA > 0.004 ? g.rgb / srcA : float3(0.0);
  } else if (chroma + spread < 0.25) {
    // В плоском теле разброс и хроматика вырождаются: все шесть отсчётов легли бы в ОДНУ
    // точку. Тело — это почти вся площадь стекла, а выборка текстуры здесь самое дорогое,
    // что есть. Один отсчёт вместо шести.
    half4 c = content.eval(vgInContent(s));
    srcA = float(c.a);
    rgb = srcA > 0.004 ? float3(c.rgb) / srcA : float3(0.0);
  } else {
    // content.eval отдаёт PREMULTIPLIED цвет. Брать .r/.g/.b из РАЗНЫХ точек и склеивать
    // напрямую нельзя: где альфа между выборками отличается, каналы делятся на разный
    // множитель и на границах содержимого вылезает цветная кайма, которой в контенте нет.
    half4 c0 = content.eval(vgInContent(s - n * (chroma + spread)));
    half4 c1 = content.eval(vgInContent(s - n * (chroma - spread)));
    half4 c2 = content.eval(vgInContent(s - n * spread));
    half4 c3 = content.eval(vgInContent(s + n * spread));
    half4 c4 = content.eval(vgInContent(s + n * (chroma - spread)));
    half4 c5 = content.eval(vgInContent(s + n * (chroma + spread)));

    // Разворачивать КАЖДУЮ выборку своим делением нельзя: деление на малую альфу поднимает
    // шум half-точности, а шесть делений поднимают его шесть раз. На тёмном фоне это и видно
    // — там и цвет, и альфа малы. Складываем premultiplied и делим ОДИН раз на пару, в float:
    // half у нуля квантуется слишком грубо. Альфа берётся своя на канал — иначе на границах
    // содержимого возвращается цветная кайма, которой в контенте нет.
    float aR = float(c0.a + c1.a) * 0.5;
    float aG = float(c2.a + c3.a) * 0.5;
    float aB = float(c4.a + c5.a) * 0.5;
    rgb = float3(
      aR > 0.004 ? float(c0.r + c1.r) * 0.5 / aR : 0.0,
      aG > 0.004 ? float(c2.g + c3.g) * 0.5 / aG : 0.0,
      aB > 0.004 ? float(c4.b + c5.b) * 0.5 / aB : 0.0);
    srcA = (aR + aG + aB) / 3.0;
  }

  // ОТРАЖЕНИЕ. Считается здесь, а не в поверхности, потому что отражение — это функция
  // окружения, а окружение видно только отсюда: поверхность рисуется поверх линзы и
  // бэкдропа не имеет вовсе. Раньше Френель добавлял к кромке БЕЛЫЙ — из-за этого стекло
  // над тёмным списком выглядело одинаково независимо от того, что под ним, а над светлой
  // обложкой белило.
  //
  // Собираем его СНАРУЖИ формы, а не из-под стекла: на скользящем угле в глаз приходит
  // окружение детали, а не то, что за ней. Отсюда и поведение, которого раньше не было —
  // яркая обложка рядом зажигает ближнюю к ней кромку, а посреди пустой черноты стекло
  // честно остаётся тёмным, потому что источника нет.
  float3 N = normalize(float3(n * vgBevelSlope(t), 1.0));
  float fres = u_fresnel * pow(1.0 - clamp(N.z, 0.0, 1.0), u_fresnelPower);
  float2 around = u_center + p + n * (u_reflectReach * mix(0.25, 1.0, t));
  half4 rc = content.eval(vgInContent(around));
  float ra = float(rc.a);
  float3 refl = ra > 0.004 ? float3(rc.rgb) / ra : float3(0.0);
  rgb = mix(rgb, refl, fres);

  // ЛОКАЛЬНАЯ ОЦЕНКА ФОНА. Адаптация обязана идти по НИЗКОЙ частоте. Если считать её по
  // самому пикселю, вокруг каждой буквы под стеклом появится ореол: стекло начнёт гоняться
  // за штрихами вместо того, чтобы отвечать на общую светлоту места. Четыре широких отсчёта
  // дают и среднюю светлоту окрестности, и её пестроту — по ним же идёт рассеяние, так что
  // лишних выборок ради адаптации не появляется.
  float2 wx = float2(u_adaptRadius, 0.0);
  float2 wy = float2(0.0, u_adaptRadius);
  float3 w0 = vgUnpack(content.eval(vgInContent(s + wx)));
  float3 w1 = vgUnpack(content.eval(vgInContent(s - wx)));
  float3 w2 = vgUnpack(content.eval(vgInContent(s + wy)));
  float3 w3 = vgUnpack(content.eval(vgInContent(s - wy)));
  float3 wide = (w0 + w1 + w2 + w3) * 0.25;

  float lumHere = vgLuma(rgb);
  float lumWide = vgLuma(wide);
  // Пестрота места: разброс светлоты между широкими отсчётами. На ровной заливке ноль, на
  // тексте и на обложке — заметная величина.
  float busy = max(max(abs(vgLuma(w0) - lumWide), abs(vgLuma(w1) - lumWide)),
                   max(abs(vgLuma(w2) - lumWide), abs(vgLuma(w3) - lumWide)));

  // АДАПТИВНОЕ РАССЕЯНИЕ. Мутить фон нужно ровно там, где он пёстрый: на ровной заливке
  // размытие ничего не даёт, а на тексте и обложке оно и есть то, что делает надпись поверх
  // читаемой.
  //
  // Размывать смешиванием с четырьмя широкими отсчётами НЕЛЬЗЯ. Это не размытие, а гребёнка:
  // на выходе получаются четыре смещённые копии — текст под стеклом двоился, а шахматка
  // рассыпалась в кашу. Широкие отсчёты годятся только на ОЦЕНКУ; видимое размытие делает
  // честный дисковый сбор по спирали.
  float adaptBlur = busy * u_legibility * u_adaptRadius * 0.6;
  if (adaptBlur > 0.5) {
    float reach = max(u_reach - length(p), 1.0);
    float4 g = vgGather(s, min(adaptBlur, reach));
    float ga = g.a;
    float3 blurred = ga > 0.004 ? g.rgb / ga : float3(0.0);
    rgb = mix(rgb, blurred, smoothstep(0.5, 2.0, adaptBlur));
  }
  float local = mix(vgLuma(rgb), lumWide, 0.6);

  // ТЕЛО СТЕКЛА. Считается ЗДЕСЬ, а не в поверхности, по той же причине, что и отражение:
  // фон виден только отсюда. Пока тинт рисовался поверх, он был обязан быть одинаковым на
  // всей детали — точечной адаптации не существовало в принципе.
  //
  // Цель — гарантировать разделение по светлоте с тем, что приложение рисует ПОВЕРХ стекла
  // (u_ink). Светлой надписи нужно тело темнее себя, тёмной — светлее. И то и другое —
  // одна монотонная функция локальной светлоты, поэтому «переключения режима» как события
  // нет: над светлой обложкой стекло темнеет, над чёрным списком светлеет, а между ними
  // переходит непрерывно, потому что непрерывна сама оценка фона.
  float sep = VG_SEPARATION * u_legibility;
  float target = u_ink > 0.5 ? min(local, u_ink - sep) : max(local, u_ink + sep);
  float dark = target < local ? 1.0 : 0.0;
  float tintLuma = mix(VG_TINT_LIGHT, VG_TINT_DARK, dark);

  // Плотность — ровно та, что доводит светлоту тела до цели. Знаменатель не может обнулиться:
  // цель всегда по ту же сторону от местной светлоты, что и выбранный тинт.
  float needed = clamp((target - local) / (tintLuma - local), 0.0, 0.92);
  float density = max(u_bodyDensity, needed);
  float3 tint = u_bodyTint * (tintLuma / max(vgLuma(u_bodyTint), 0.001));
  rgb = mix(rgb, tint, density);

  // СВЕТ ОКРУЖЕНИЯ. Стекло на чёрном не бывает дырой: до него доходит свет от того, что
  // лежит рядом. Берём цвет окрестности (тот же отсчёт, что и у отражения), поэтому кромка
  // и тело окрашиваются В ЦВЕТ КОНТЕНТА — рядом с жёлтой обложкой стекло теплеет, рядом с
  // синей холодает. На светлом фоне добавка сама сходит на нет: там прибавлять нечего.
  rgb += refl * u_edgeLight * (0.12 + 0.55 * (1.0 - local)) * mix(0.35, 1.0, t);

  // Альфа выборок обязана дожить до результата: развернуть цвет по исходной альфе, а вернуть
  // с чужой (маской формы) — значит сделать прозрачный бэкдроп непрозрачным и засветить его.
  float alpha = srcA * (1.0 - smoothstep(-1.0, 1.0, sd));
  return half4(half3(rgb * alpha), half(alpha));
}
`;
