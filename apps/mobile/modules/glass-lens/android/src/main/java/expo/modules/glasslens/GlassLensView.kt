package expo.modules.glasslens

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.RenderEffect
import android.graphics.RuntimeShader
import android.os.Build
import android.util.Log
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.min

// Преломление живого фона нельзя посчитать ни трансформом вьюхи, ни Skia-шейдером поверх неё:
// трансформ аффинный (один коэффициент на всю линзу — это лупа, а не линза), а Skia-канвас
// пикселей нативной подложки не видит. `RenderEffect.createRuntimeShaderEffect` — единственный
// на Android способ отдать AGSL-шейдеру УЖЕ отрисованное содержимое вьюхи: сюда приходит
// размытый бэкдроп от BlurView-ребёнка, и шейдер семплирует его по смещённой координате.
//
// Форма задаётся знаковым расстоянием до скруглённого прямоугольника, поэтому круг — его
// частный случай (`corner` = половина меньшей стороны), и кнопка навигации с панелью
// мини-плеера используют один и тот же шейдер.
//
// Ход луча: в плоской середине — равномерное увеличение (толщина стекла), в фаске выборка
// уходит НАРУЖУ по нормали к кромке, и у самого края видно то, что лежит за стеклом, сжатое
// в тонкую полосу. Отсюда же обе аберрации: хроматическая (каналы расходятся) и сферическая
// (у кромки луч «промахивается», картинка смазывается) — обе живут только в фаске.
private const val AGSL = """
uniform shader content;

uniform float2 u_center;
uniform float2 u_half;
uniform float  u_corner;
uniform float  u_bevel;
uniform float  u_magnify;
uniform float  u_edgePush;
uniform float  u_chroma;
uniform float  u_spherical;

const float FALLOFF = 2.6;

// Деление на околонулевую альфу раздувает шум half-точности до единицы, поэтому порог, а не > 0.
half3 straight(half4 c) {
  return c.a > 0.004 ? c.rgb / c.a : half3(0.0);
}

float sdRect(float2 p) {
  float2 q = abs(p) - u_half + u_corner;
  return min(max(q.x, q.y), 0.0) + length(max(q, float2(0.0))) - u_corner;
}

// Нормаль к кромке — градиент SDF: на скруглении радиальная, на прямых участках осевая.
float2 edgeNormal(float2 p) {
  float2 q = abs(p) - u_half + u_corner;
  float2 g = (q.x > 0.0 && q.y > 0.0)
    ? normalize(max(q, float2(0.0001)))
    : (q.x > q.y ? float2(1.0, 0.0) : float2(0.0, 1.0));
  return g * sign(p);
}

half4 main(float2 xy) {
  float2 p = xy - u_center;
  float sd = sdRect(p);
  if (sd > 1.0) { return half4(0.0); }

  float t = clamp((sd + u_bevel) / u_bevel, 0.0, 1.0);
  float2 n = edgeNormal(p);

  float2 s = u_center + p / u_magnify + n * (u_edgePush * pow(t, FALLOFF));

  float spread = u_spherical * t * t;
  float chroma = u_chroma * t * t;

  // `content.eval` отдаёт PREMULTIPLIED цвет. Брать .r/.g/.b из РАЗНЫХ точек и склеивать
  // напрямую нельзя: там, где альфа между выборками отличается, каналы делятся на разный
  // множитель и на границах содержимого вылезает цветная кайма — линия, которой в контенте нет.
  half4 c0 = content.eval(s - n * (chroma + spread));
  half4 c1 = content.eval(s - n * (chroma - spread));
  half4 c2 = content.eval(s - n * spread);
  half4 c3 = content.eval(s + n * spread);
  half4 c4 = content.eval(s + n * (chroma - spread));
  half4 c5 = content.eval(s + n * (chroma + spread));

  half3 rgb = half3(
    (straight(c0).r + straight(c1).r) * 0.5,
    (straight(c2).g + straight(c3).g) * 0.5,
    (straight(c4).b + straight(c5).b) * 0.5);

  // Альфа выборок обязана дожить до результата: развернуть цвет по исходной альфе, а вернуть
  // с чужой (маской формы) — значит сделать прозрачный бэкдроп непрозрачным и засветить его.
  half srcA = (c0.a + c1.a + c2.a + c3.a + c4.a + c5.a) / 6.0;
  half alpha = srcA * half(1.0 - smoothstep(-1.0, 1.0, sd));
  return half4(rgb * alpha, alpha);
}
"""

@SuppressLint("ViewConstructor")
class GlassLensView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  // Ошибка компиляции AGSL прилетает исключением из конструктора `RuntimeShader` и без
  // перехвата валит создание всей вьюхи. Но молчать нельзя: без эффекта BlurView рисует свой
  // ПРЯМОУГОЛЬНИК во всю вьюху (она заметно больше стекла), а симптом с текстом ошибки никак
  // не связан — поэтому её обязательно в лог.
  private val shader = try {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) RuntimeShader(AGSL) else null
  } catch (e: Throwable) {
    Log.e("GlassLens", "AGSL не скомпилировался, линза выключена", e)
    null
  }

  private val density = context.resources.displayMetrics.density

  var glassWidth = 0f
  var glassHeight = 0f
  var cornerRadius = 0f
  var bevel = 0.18f
  var magnify = 1.22f
  var edgePush = 0f
  var chroma = 0f
  var spherical = 0f

  /** Единственный вызов после смены любого пропа — униформы применяются только через повторный
   *  `setRenderEffect`, мутации самого `RuntimeShader` вьюху не инвалидируют. */
  fun applyEffect() {
    // Прятать вьюху можно ТОЛЬКО когда шейдера нет совсем: `dimezisBlurView` внутри прекращает
    // захват фона, если его спрятать, и обратно сам не оживает — вместо преломления остаётся
    // ровная плашка. Переходное состояние просто ждёт следующего вызова.
    val effect = shader
    if (effect == null) {
      visibility = INVISIBLE
      return
    }
    if (width <= 0 || height <= 0 || glassWidth <= 0f || glassHeight <= 0f) return

    val halfW = glassWidth * density / 2f
    val halfH = glassHeight * density / 2f
    val halfMin = min(halfW, halfH)

    effect.setFloatUniform("u_center", width / 2f, height / 2f)
    effect.setFloatUniform("u_half", halfW, halfH)
    effect.setFloatUniform("u_corner", min(cornerRadius * density, halfMin))
    effect.setFloatUniform("u_bevel", maxOf(bevel * halfMin, 1f))
    effect.setFloatUniform("u_magnify", magnify)
    effect.setFloatUniform("u_edgePush", edgePush * density)
    effect.setFloatUniform("u_chroma", chroma * density)
    effect.setFloatUniform("u_spherical", spherical * density)

    setRenderEffect(RenderEffect.createRuntimeShaderEffect(effect, "content"))
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    applyEffect()
  }
}
