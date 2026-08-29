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
// Исходник шейдера приходит ПРОПОМ из JS (`lib/vireglass/lens-shader.ts`): AGSL и SKSL — один
// язык, поэтому геометрия у линзы и у поверхности буквально одна строка. Держать вторую копию
// SDF здесь значит вернуть расхождение, которое эта фаза и закрывает.
@SuppressLint("ViewConstructor")
class GlassLensView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val density = context.resources.displayMetrics.density

  private var shader: RuntimeShader? = null
  private var compiledSource: String? = null

  var shaderSource: String? = null
  var glassWidth = 0f
  var glassHeight = 0f
  var cornerRadius = 0f
  var bevel = 0.18f
  var magnify = 1f
  var edgePush = 0f
  var chroma = 0f
  var spherical = 0f
  var morphX = 0f
  var morphY = 0f
  var morphWidth = 0f
  var morphHeight = 0f
  var morphCorner = 0f
  var morphSmoothing = 0f
  var debug = 0f

  // Компиляция AGSL стоит дорого и обязана происходить только на смену исходника: пропы
  // прилетают пачкой на каждый рендер, а строка при этом та же самая.
  private fun ensureShader(): RuntimeShader? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return null
    val src = shaderSource ?: return null
    if (src == compiledSource) return shader
    compiledSource = src
    // Ошибка компиляции прилетает исключением из конструктора и без перехвата валит вьюху.
    // Но молчать нельзя: без эффекта BlurView рисует свой ПРЯМОУГОЛЬНИК во всю вьюху, а
    // симптом с текстом ошибки никак не связан.
    shader = try {
      RuntimeShader(src)
    } catch (e: Throwable) {
      Log.e("GlassLens", "AGSL не скомпилировался, линза выключена", e)
      null
    }
    return shader
  }

  /** Единственный вызов после смены любого пропа — униформы применяются только через повторный
   *  `setRenderEffect`, мутации самого `RuntimeShader` вьюху не инвалидируют. */
  fun applyEffect() {
    // Прятать вьюху можно ТОЛЬКО когда шейдера нет совсем: `dimezisBlurView` внутри прекращает
    // захват фона, если его спрятать, и обратно сам не оживает — вместо преломления остаётся
    // ровная плашка. Переходное состояние просто ждёт следующего вызова.
    val effect = ensureShader()
    if (effect == null) {
      visibility = INVISIBLE
      return
    }
    visibility = VISIBLE
    if (width <= 0 || height <= 0 || glassWidth <= 0f || glassHeight <= 0f) return

    val halfW = glassWidth * density / 2f
    val halfH = glassHeight * density / 2f
    val halfMin = min(halfW, halfH)

    // Имена униформ задаёт JS-исходник. Рассинхрон здесь — IllegalArgumentException, который
    // без перехвата валит вьюху вместо того, чтобы деградировать до плашки.
    try {
      effect.setFloatUniform("u_center", width / 2f, height / 2f)
      effect.setFloatUniform("u_halfSize", halfW, halfH)
      effect.setFloatUniform("u_corner", min(cornerRadius * density, halfMin))
      effect.setFloatUniform("u_bevel", maxOf(bevel * halfMin, 1f))
      effect.setFloatUniform("u_magnify", maxOf(magnify, 0.01f))
      effect.setFloatUniform("u_edgePush", edgePush * density)
      effect.setFloatUniform("u_chroma", chroma * density)
      effect.setFloatUniform("u_spherical", spherical * density)
      effect.setFloatUniform("u_morphOffset", morphX * density, morphY * density)
      effect.setFloatUniform("u_morphHalf", morphWidth * density / 2f, morphHeight * density / 2f)
      effect.setFloatUniform("u_morphCorner", morphCorner * density)
      effect.setFloatUniform("u_morphK", morphSmoothing * density)
      effect.setFloatUniform("u_debug", debug)
    } catch (e: Throwable) {
      Log.e("GlassLens", "униформы линзы разошлись с шейдером", e)
      setRenderEffect(null)
      return
    }

    setRenderEffect(RenderEffect.createRuntimeShaderEffect(effect, "content"))
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    applyEffect()
  }
}
