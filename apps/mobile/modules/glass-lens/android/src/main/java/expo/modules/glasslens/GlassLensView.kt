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
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlin.math.abs
import kotlin.math.max
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

  /** Светлота, пестрота и цвет фона под этим стеклом. Приложение слушает это событие,
   *  чтобы перекрасить надпись, когда стекло уже отработало свой предел (см. зонд в
   *  GlassBackdropView). */
  private val onBackdropSample by EventDispatcher()

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
      backdrop = null
      attach(value, RESOLVE_TRIES)
      invalidate()
    }

  /** Поиск вьюхи захвата с повторами по кадрам: тег приезжает раньше, чем цель успевает
   *  зарегистрироваться, а второй установки того же тега сеттер уже не пропустит. */
  private fun attach(id: Int?, tries: Int) {
    if (id == null || id != backdropId || backdrop != null) return
    backdrop = appContext.findView<View>(id)?.let(::findBackdrop)
    if (backdrop != null) {
      backdrop?.register(this)
      invalidate()
      return
    }
    if (tries > 0) {
      postOnAnimation { attach(id, tries - 1) }
      return
    }
    Log.e("GlassLens", "бэкдроп $id не найден, стекло остаётся без преломления")
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

  /** Габарит ВИДИМОГО стекла в dp: по нему считается прямоугольник для зонда светлоты.
   *  Всё остальное про материал приходит общим каналом ниже. */
  var glassWidth = 0f
  var glassHeight = 0f

  // ОБЩИЙ КАНАЛ УНИФОРМ. Раньше каждая величина материала была отдельным Prop, и добавление
  // явления в шейдер требовало правки Kotlin, пересборки APK и — при опечатке — молчаливого
  // отключения линзы: неизвестный проп Expo проглатывает без единого слова (material-lab.md
  // E-01, из-за этого преломление было выключено в проде целую фазу). Теперь имя, размер и
  // значение приезжают ВМЕСТЕ, а несовпадение с шейдером пишется в лог с именем.
  var uniformNames: List<String> = emptyList()
  var uniformValues: List<Double> = emptyList()
  var uniformSizes: List<Int> = emptyList()

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

    try {
      // Вьюха задаёт ТОЛЬКО то, что знает она одна: свой размер и своё место на экране.
      effect.setFloatUniform("u_center", width / 2f, height / 2f)
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
      // Оценка фона под стеклом. Считать её в шейдере по нескольким отсчётам нельзя:
      // плотность тела — нелинейная функция светлоты, и на изломе разброс оценки между
      // соседними пикселями превращался в ПРИЗРАЧНЫЕ КОПИИ текста, лежащего под стеклом,
      // на расстоянии радиуса выборки. Здесь величина одна на всю поверхность, приходит из
      // зонда и сглажена по времени — гребёнке взяться неоткуда.
      effect.setFloatUniform("u_probeLuma", probeLuma)
      effect.setFloatUniform("u_probeBusy", probeBusy)
      effect.setFloatUniform("u_probeRange", probeLo, probeHi)
      effect.setFloatUniform("u_probeSlope", probeSlopeX, probeSlopeY)
      effect.setFloatUniform("u_probe", probeR, probeG, probeB)
      applyChannel(effect)
    } catch (e: Throwable) {
      Log.e("GlassLens", "униформы линзы разошлись с шейдером", e)
      setRenderEffect(null)
      return
    }

    setRenderEffect(RenderEffect.createRuntimeShaderEffect(effect, "content"))
  }

  /** Общий канал: имя, размер и значения уже согласованы на стороне JS (adapters.ts).
   *  Ошибку не глотаем — иначе линза выключается молча и симптом ни на что не похож. */
  private fun applyChannel(effect: RuntimeShader) {
    var at = 0
    for (k in uniformNames.indices) {
      val name = uniformNames[k]
      val size = uniformSizes.getOrElse(k) { 1 }
      if (at + size > uniformValues.size) break
      try {
        val v0 = uniformValues[at].toFloat()
        when (size) {
          1 -> effect.setFloatUniform(name, v0)
          2 -> effect.setFloatUniform(name, v0, uniformValues[at + 1].toFloat())
          3 -> effect.setFloatUniform(
            name,
            v0,
            uniformValues[at + 1].toFloat(),
            uniformValues[at + 2].toFloat(),
          )
          4 -> effect.setFloatUniform(
            name,
            v0,
            uniformValues[at + 1].toFloat(),
            uniformValues[at + 2].toFloat(),
            uniformValues[at + 3].toFloat(),
          )
        }
      } catch (e: Throwable) {
        Log.e("GlassLens", "униформа $name (размер $size) не принята шейдером", e)
      }
      at += size
    }
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

  /** Зонд снял свежую сетку. Берём из неё СВОЙ прямоугольник — у таб-бара и мини-плеера
   *  под ними разное — и сообщаем наружу, только если сдвинулось заметно: событие в JS
   *  стоит дороже самого замера. */
  fun onBackdropProbed() {
    val source = backdrop ?: return
    val luma = source.lumaGrid ?: return
    val color = source.colorGrid ?: return
    if (source.width <= 0 || source.height <= 0) return

    getLocationOnScreen(selfAt)
    source.getLocationOnScreen(backdropAt)
    val halfW = glassWidth * density / 2f
    val halfH = glassHeight * density / 2f
    val cx = (selfAt[0] - backdropAt[0]) + width / 2f
    val cy = (selfAt[1] - backdropAt[1]) + height / 2f

    val gw = GlassBackdropView.PROBE_W
    val gh = GlassBackdropView.PROBE_H
    val sx = gw / source.width.toFloat()
    val sy = gh / source.height.toFloat()
    val x0 = max(((cx - halfW) * sx).toInt(), 0)
    val x1 = min(((cx + halfW) * sx).toInt() + 1, gw)
    val y0 = max(((cy - halfH) * sy).toInt(), 0)
    val y1 = min(((cy + halfH) * sy).toInt() + 1, gh)
    if (x1 <= x0 || y1 <= y0) return

    var sum = 0f
    var r = 0f
    var g = 0f
    var b = 0f
    var count = 0
    val bins = IntArray(BINS)
    // Наклон светлоты по поверхности. Тонирование обязано быть ГРАДИЕНТНЫМ: там, где под
    // стеклом одна половина светлая, а другая тёмная, одна плотность на всю деталь не даёт
    // разделения ни на одной из них. Плоскость — самая грубая модель, которая это описывает,
    // и единственная, которая гладка по построению: точечная оценка на изломе плотности
    // превращалась в призрачные копии текста (material-lab.md E-36).
    var sumU = 0f
    var sumV = 0f
    var uu = 0f
    var vv = 0f
    val midX = (x0 + x1 - 1) * 0.5f
    val midY = (y0 + y1 - 1) * 0.5f
    val halfCellsX = max((x1 - 1 - x0) * 0.5f, 0.5f)
    val halfCellsY = max((y1 - 1 - y0) * 0.5f, 0.5f)
    for (y in y0 until y1) {
      for (x in x0 until x1) {
        val i = y * gw + x
        val l = luma[i]
        sum += l
        bins[((l * (BINS - 1)).toInt()).coerceIn(0, BINS - 1)]++
        val u = (x - midX) / halfCellsX
        val v = (y - midY) / halfCellsY
        sumU += l * u
        sumV += l * v
        uu += u * u
        vv += v * v
        r += color[i * 3]
        g += color[i * 3 + 1]
        b += color[i * 3 + 2]
        count++
      }
    }
    val n = count.toFloat()
    val mean = sum / n
    // Координаты центрированы, поэтому нормальные уравнения распадаются: наклон по каждой
    // оси считается независимо.
    val slopeX = if (uu > 0.001f) sumU / uu else 0f
    val slopeY = if (vv > 0.001f) sumV / vv else 0f

    // Края берутся ПЕРЦЕНТИЛЯМИ, а не min/max: одна белая точка под краем стекла не должна
    // выглядеть как «под стеклом есть белое поле». Судить по среднему нельзя тем более —
    // над границей чёрного и белого оно даёт серый, при котором формально всё в порядке,
    // а надпись тонет над светлой половиной.
    var lo = 0f
    var hi = 1f
    var acc = 0
    val loAt = (count * 0.1f).toInt()
    val hiAt = (count * 0.9f).toInt()
    var loSet = false
    for (k in 0 until BINS) {
      val next = acc + bins[k]
      if (!loSet && next > loAt) {
        lo = k / (BINS - 1f)
        loSet = true
      }
      if (next > hiAt) {
        hi = k / (BINS - 1f)
        break
      }
      acc = next
    }

    // Пестрота — среднее отклонение от средней светлоты, удвоенное (у поля из половины
    // чёрного и половины белого получается ровно 1). Размах для этого не годится: у
    // страницы тёмного текста он такой же, как у шахматки, хотя светлого там доли процента.
    var dev = 0f
    for (k in 0 until BINS) {
      dev += bins[k] * kotlin.math.abs(k / (BINS - 1f) - mean)
    }
    val busy = (2f * dev / n).coerceIn(0f, 1f)

    // Цель сглаживания. Само значение едет к ней по кадрам (см. settle): шаг зонда 180 мс,
    // и без промежуточных кадров адаптация читается ступеньками.
    targetLuma = mean
    targetBusy = busy
    targetLo = lo
    targetHi = hi
    targetSlopeX = slopeX
    targetSlopeY = slopeY
    targetR = r / n
    targetG = g / n
    targetB = b / n
    if (probeLuma < 0f) {
      probeLuma = mean
      probeBusy = busy
      probeLo = lo
      probeHi = hi
      probeSlopeX = slopeX
      probeSlopeY = slopeY
      probeR = targetR
      probeG = targetG
      probeB = targetB
    }
    settle()

    // Событие уходит на КАЖДЫЙ замер, а не только на изменение. Раньше здесь стоял порог, и
    // на статичном экране события прекращались вовсе — а решение о перекраске контента
    // требует нескольких подтверждений подряд и потому не набиралось никогда. Частота и так
    // низкая (PROBE_INTERVAL_MS), фильтровать её должен потребитель.
    emitSample(mean, busy, lo, hi, r / n, g / n, b / n)
  }

  private fun emitSample(
    luma: Float,
    busy: Float,
    lo: Float,
    hi: Float,
    r: Float,
    g: Float,
    b: Float,
  ) {
    onBackdropSample(
      mapOf("luma" to luma, "busy" to busy, "lo" to lo, "hi" to hi, "r" to r, "g" to g, "b" to b),
    )
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    attach(backdropId, RESOLVE_TRIES)
  }

  override fun onDetachedFromWindow() {
    backdrop?.unregister(this)
    super.onDetachedFromWindow()
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    applyEffect()
  }


  // Сглаженная оценка фона. Отрицательная светлота = зонд ещё ничего не сказал, и шейдер
  // держится на собственных отсчётах.
  private var probeLuma = -1f
  private var probeBusy = 0f
  private var probeLo = 0f
  private var probeHi = 0f
  private var probeSlopeX = 0f
  private var probeSlopeY = 0f
  private var probeR = 0f
  private var probeG = 0f
  private var probeB = 0f
  private var targetLuma = 0f
  private var targetBusy = 0f
  private var targetLo = 0f
  private var targetHi = 0f
  private var targetSlopeX = 0f
  private var targetSlopeY = 0f
  private var targetR = 0f
  private var targetG = 0f
  private var targetB = 0f
  private var settling = false

  /** Экспоненциальный подъезд к последнему замеру по кадрам. Останавливается сам, когда
   *  ехать больше некуда: пока значение стоит, эффект не пересоздаётся вовсе. */
  private fun settle() {
    if (settling) return
    settling = true
    post(object : Runnable {
      override fun run() {
        // Условие смотрит на ВСЕ величины, которые цикл двигает: по одной луме он вставал,
        // когда фон менял только оттенок. Максимум, а не сумма: порог задан на ОДНУ величину
        // и от суммы ужесточался бы с каждым слагаемым — это лишние кадры с applyEffect().
        val d = maxOf(
          maxOf(abs(targetLuma - probeLuma), abs(targetBusy - probeBusy), abs(targetLo - probeLo)),
          maxOf(abs(targetHi - probeHi), abs(targetSlopeX - probeSlopeX), abs(targetSlopeY - probeSlopeY)),
          maxOf(abs(targetR - probeR), abs(targetG - probeG), abs(targetB - probeB)),
        )
        probeLuma += (targetLuma - probeLuma) * SETTLE
        probeBusy += (targetBusy - probeBusy) * SETTLE
        probeLo += (targetLo - probeLo) * SETTLE
        probeHi += (targetHi - probeHi) * SETTLE
        probeSlopeX += (targetSlopeX - probeSlopeX) * SETTLE
        probeSlopeY += (targetSlopeY - probeSlopeY) * SETTLE
        probeR += (targetR - probeR) * SETTLE
        probeG += (targetG - probeG) * SETTLE
        probeB += (targetB - probeB) * SETTLE
        applyEffect()
        if (d > SETTLE_EPS) postOnAnimation(this) else settling = false
      }
    })
  }

  private companion object {
    /** Сколько кадров ждём появления вьюхи захвата, прежде чем признать её отсутствие. */
    const val RESOLVE_TRIES = 10

    /** Число корзин гистограммы. Хватает и на перцентили, и на среднее отклонение: точнее
     *  этого статистика всё равно не нужна — она управляет плавными величинами. */
    const val BINS = 32

    /** Доля пути к цели за кадр. Постоянная времени около трети секунды — адаптация обязана
     *  быть незаметной, а не мгновенной. */
    const val SETTLE = 0.08f

    /** Ниже этой разницы значение считается доехавшим, и покадровый подъезд останавливается. */
    const val SETTLE_EPS = 0.002f
  }
}

