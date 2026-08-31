package expo.modules.glasslens

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.RenderEffect
import android.graphics.RuntimeShader
import android.os.Build
import android.graphics.Canvas
import android.util.Log
import android.view.View
import android.view.ViewGroup
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.min

// Преломление живого фона нельзя посчитать ни трансформом вьюхи, ни Skia-шейдером поверх неё:
// трансформ аффинный (один коэффициент на всю линзу — это лупа, а не линза), а Skia-канвас
// пикселей нативной подложки не видит. `RenderEffect.createRuntimeShaderEffect` — единственный
// на Android способ отдать AGSL-шейдеру УЖЕ отрисованное содержимое вьюхи: сюда приходит
// снимок фона от BlurView-ребёнка, и шейдер семплирует его по смещённой координате.
//
// Исходник шейдера приходит ПРОПОМ из JS (`lib/vireglass/lens-shader.ts`): AGSL и SKSL — один
// язык, поэтому геометрия у линзы и у поверхности буквально одна строка. Держать вторую копию
// SDF здесь значит вернуть расхождение, которое эта фаза и закрывает.
@SuppressLint("ViewConstructor")
class GlassLensView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val density = context.resources.displayMetrics.density

  private val screenAt = IntArray(2)
  private val selfAt = IntArray(2)
  private val backdropAt = IntArray(2)

  // ViewGroup себя не рисует по умолчанию, а фон линзе рисовать теперь именно ей.
  init { setWillNotDraw(false) }

  private var backdrop: GlassBackdropView? = null

  /** Тег ЦЕЛИ (components/backdrop.tsx), а не самого захвата: снаружи стоит BlurTargetView
   *  ради фолбэка ниже Android 13, наш GlassBackdropView лежит внутри неё. */
  var backdropId: Int? = null
    set(value) {
      if (field == value) return
      field = value
      backdrop?.unregister(this)
      backdrop = value?.let { id -> appContext.findView<View>(id)?.let(::findBackdrop) }
      if (value != null && backdrop == null) {
        Log.e("GlassLens", "бэкдроп $value не найден, стекло остаётся без преломления")
      }
      backdrop?.register(this)
      invalidate()
    }

  private fun findBackdrop(view: View, depth: Int = 0): GlassBackdropView? {
    if (view is GlassBackdropView) return view
    if (depth >= 3 || view !is ViewGroup) return null
    for (i in 0 until view.childCount) {
      findBackdrop(view.getChildAt(i), depth + 1)?.let { return it }
    }
    return null
  }

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
  var frost = 0f
  var ink = 1f
  var legibility = 0f
  var adaptRadius = 22f
  var bodyDensity = 0f
  var edgeLight = 0f
  var bodyTintR = 1f
  var bodyTintG = 1f
  var bodyTintB = 1f
  var fresnel = 0f
  var fresnelPower = 5f
  var reflectReach = 0f
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
    // Прятать вьюху можно ТОЛЬКО когда шейдера нет совсем: BlurView внутри прекращает
    // захват фона, если его спрятать, и обратно сам не оживает. Переходное состояние
    // просто ждёт следующего вызова.
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
      effect.setFloatUniform("u_frost", frost * density)
      // Докуда вообще есть содержимое: вьюха линзы шире стекла на запас, дальше пусто.
      effect.setFloatUniform("u_reach", min(width, height) / 2f)

      // Захват кончается на краю экрана, а вьюха линзы у поверхности во всю ширину за него
      // выходит. Отдаём шейдеру прямоугольник, где содержимое реально есть, в СВОИХ
      // координатах — иначе вдоль таких кромок остаётся полоса без преломления.
      getLocationOnScreen(screenAt)
      val metrics = resources.displayMetrics
      val minX = maxOf(-screenAt[0], 0).toFloat() + 1f
      val minY = maxOf(-screenAt[1], 0).toFloat() + 1f
      val maxX = minOf(metrics.widthPixels - screenAt[0], width).toFloat() - 1f
      val maxY = minOf(metrics.heightPixels - screenAt[1], height).toFloat() - 1f
      effect.setFloatUniform("u_contentMin", minX, minY)
      effect.setFloatUniform("u_contentMax", maxX, maxY)
      effect.setFloatUniform("u_ink", ink)
      effect.setFloatUniform("u_legibility", legibility)
      effect.setFloatUniform("u_adaptRadius", adaptRadius * density)
      effect.setFloatUniform("u_bodyDensity", bodyDensity)
      effect.setFloatUniform("u_edgeLight", edgeLight)
      effect.setFloatUniform("u_bodyTint", bodyTintR, bodyTintG, bodyTintB)
      effect.setFloatUniform("u_fresnel", fresnel)
      effect.setFloatUniform("u_fresnelPower", fresnelPower)
      effect.setFloatUniform("u_reflectReach", reflectReach * density)
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

  /** Содержимое линзы — снимок фона, и рисует его она сама: RenderEffect работает по тому,
   *  что вьюха нарисовала. Смещение берём по позиции на экране — она учитывает трансформы,
   *  и когда стекло едет, под ним оказывается другой участок фона. */
  override fun onDraw(canvas: Canvas) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
    val source = backdrop ?: return
    // Регистрация идемпотентна и восстанавливается сама: бэкдроп может пере-подключиться.
    source.register(this)
    val n = source.content ?: return
    getLocationOnScreen(selfAt)
    source.getLocationOnScreen(backdropAt)
    canvas.save()
    canvas.translate((backdropAt[0] - selfAt[0]).toFloat(), (backdropAt[1] - selfAt[1]).toFloat())
    canvas.drawRenderNode(n)
    canvas.restore()
  }

  override fun onDetachedFromWindow() {
    backdrop?.unregister(this)
    super.onDetachedFromWindow()
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    applyEffect()
  }
}
