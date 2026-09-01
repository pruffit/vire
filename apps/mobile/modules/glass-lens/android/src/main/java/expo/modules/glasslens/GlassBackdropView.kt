package expo.modules.glasslens

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.HardwareRenderer
import android.graphics.PixelFormat
import android.graphics.RenderNode
import android.graphics.drawable.ColorDrawable
import android.hardware.HardwareBuffer
import android.media.ImageReader
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.ViewTreeObserver
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import java.util.Collections
import java.util.WeakHashMap

/**
 * Захват фона для линзы: содержимое экрана пишется в `RenderNode` БЕЗ размытия.
 *
 * Раньше эту роль играл `BlurView` из expo-blur, и он давал дизеренную копию. Замерено в
 * стенде: выборка один в один из его захвата даёт шум 6.4–8.0 при 0.000 на том же участке
 * экрана рядом. Причина — сам путь: на Android 13+ библиотека гонит захват через
 * `RenderEffect.createBlurEffect`, а Skia дизерит выход блюра, чтобы прятать полосы.
 * При нулевом радиусе размытия нет, а дизеринг остаётся. Здесь блюра нет вовсе.
 *
 * Четыре вещи, на которых эта реализация уже ломалась, — держать в голове при правках:
 *
 * 1. Запись обязана идти из `dispatchDraw`. В `onPreDraw` ещё нет валидного контекста
 *    отрисовки, и `super.dispatchDraw` в отдельно созданную канву кладёт ПУСТОТУ.
 * 2. Узел нельзя класть на ту же канву, которая его только что записала: на экран уходит
 *    несвежий кадр, и сцена выглядит замерзшей, хотя анимация идёт. Детей рисуем напрямую,
 *    узел отдаём только линзе.
 * 3. Перезапись надо заказывать каждый кадр из `onPreDraw`: список отрисовки этой вьюхи сам
 *    не перестраивается, когда меняются только дети — он ссылается на их узлы.
 * 4. `setPosition` обязателен. Узел клипуется своими границами, а у свежесозданного они
 *    ПУСТЫЕ: `beginRecording(w, h)` задаёт лишь размер записи, но не bounds. Без этого
 *    `drawRenderNode` рисует ничто, `content.eval` в линзе возвращает нулевую альфу, и
 *    стекло становится прозрачным — при этом выглядит «чистым» по любой метрике шума,
 *    потому что показывать ему нечего (ровно ловушка E-27 в material-lab.md).
 */
@SuppressLint("ViewConstructor")
class GlassBackdropView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val node: RenderNode? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) RenderNode("vireglass-backdrop") else null

  // Слабые ссылки: линза уходит с экрана раньше бэкдропа, и держать её здесь значит держать
  // всё её поддерево.
  private val lenses = Collections.newSetFromMap(WeakHashMap<GlassLensView, Boolean>())

  private var capturing = false

  private val onPreDraw = ViewTreeObserver.OnPreDrawListener {
    if (lenses.isNotEmpty()) invalidate()
    true
  }

  /** Снимок кадра или null, пока записи ещё не было. */
  val content: RenderNode?
    get() = node?.takeIf { it.hasDisplayList() }

  fun register(lens: GlassLensView) {
    if (lenses.add(lens)) invalidate()
  }

  fun unregister(lens: GlassLensView) {
    lenses.remove(lens)
  }

  override fun dispatchDraw(canvas: Canvas) {
    val n = node
    if (n == null || capturing || lenses.isEmpty() ||
      !canvas.isHardwareAccelerated || width <= 0 || height <= 0
    ) {
      super.dispatchDraw(canvas)
      return
    }

    capturing = true
    try {
      n.setPosition(0, 0, width, height)
      val recording = n.beginRecording(width, height)
      try {
        // Фон экрана задан стилем на РОДИТЕЛЬСКОЙ вьюхе, а в узел попадают только наши дети.
        // Без заливки линза над незакрашенным местом просемплирует прозрачность вместо фона.
        (parent as? View)?.background?.let { if (it is ColorDrawable) recording.drawColor(it.color) }
        super.dispatchDraw(recording)
      } finally {
        n.endRecording()
      }
    } finally {
      capturing = false
    }

    super.dispatchDraw(canvas)

    // Линза перезаписывает свой список отрисовки: в нём лежит смещение до бэкдропа, а оно
    // меняется, когда стекло едет. Содержимое узла подхватывается по ссылке и без этого.
    for (lens in lenses) lens.invalidate()

    scheduleProbe()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnPreDrawListener(onPreDraw)
    // Защёлка сбоя снимается только здесь, на новой жизни вьюхи: сброс в releaseProbe
    // означал бы пересоздание потока и рендерера каждые 180 мс на стабильном сбое.
    probeFailed = false
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnPreDrawListener(onPreDraw)
    // Список линз НЕ чистим: ссылки слабые, а бэкдроп может пере-подключиться к окну, и
    // тогда линзы остались бы без обновлений навсегда.
    node?.discardDisplayList()
    releaseProbe()
    super.onDetachedFromWindow()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ЗОНД СВЕТЛОТЫ
  //
  // Стекло умеет само подстроить своё тело под фон, но у него есть предел: когда фон
  // светлый И надпись поверх светлая, никакая плотность тела уже не разведёт их по
  // светлоте. Дальше решение принимает не стекло, а ПРИЛОЖЕНИЕ — оно перекрашивает
  // надпись. Для этого приложению нужно знать светлоту фона ПОД стеклом, а знает её
  // только эта вьюха.
  //
  // Читаем не с экрана (там уже нарисовано само стекло — вышла бы обратная связь), а из
  // своего же узла захвата: он содержит ровно фон и ничего больше. Узел уменьшается до
  // сетки 16×32 и рендерится в `ImageReader` через `HardwareRenderer` — тот же механизм,
  // которым Compose снимает свои слои. Раз в PROBE_INTERVAL_MS, поэтому в кадровый бюджет
  // это не попадает.
  // ─────────────────────────────────────────────────────────────────────────────

  private var probeNode: RenderNode? = null
  private var probeReader: ImageReader? = null
  private var probeRenderer: HardwareRenderer? = null
  private var probeThread: HandlerThread? = null
  private var probeHandler: Handler? = null
  private var probeFailed = false
  private var lastProbeAt = 0L
  private var probePending = false

  /** Сетка светлоты последнего снимка, PROBE_W×PROBE_H, значения 0..1. */
  @Volatile
  var lumaGrid: FloatArray? = null
    private set

  /** Средний цвет того же снимка по клеткам: линза красит кромку в цвет контента. */
  @Volatile
  var colorGrid: FloatArray? = null
    private set

  private val mainHandler = Handler(Looper.getMainLooper())

  private fun scheduleProbe() {
    if (probeFailed || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
    if (probePending) return
    val now = android.os.SystemClock.uptimeMillis()
    if (now - lastProbeAt < PROBE_INTERVAL_MS) return
    lastProbeAt = now
    probePending = true
    // Не внутри прохода отрисовки: `syncAndDraw` синхронизирует дерево узлов, а мы сейчас
    // ровно в середине его обхода. `post` ставит рендер сразу после кадра.
    post { renderProbe() }
  }

  private fun renderProbe() {
    probePending = false
    val n = content ?: return
    if (width <= 0 || height <= 0) return
    try {
      ensureProbe() ?: return
      val pn = probeNode ?: return
      pn.setPosition(0, 0, PROBE_W, PROBE_H)
      val c = pn.beginRecording(PROBE_W, PROBE_H)
      try {
        c.scale(PROBE_W.toFloat() / width, PROBE_H.toFloat() / height)
        c.drawRenderNode(n)
      } finally {
        pn.endRecording()
      }
      probeRenderer?.createRenderRequest()?.setWaitForPresent(false)?.syncAndDraw()
    } catch (e: Throwable) {
      // Зонд — не обязательная часть: без него стекло теряет только автоинверсию темы.
      Log.w("GlassLens", "зонд светлоты выключен", e)
      probeFailed = true
      releaseProbe()
    }
  }

  private fun ensureProbe(): HardwareRenderer? {
    probeRenderer?.let { return it }
    val thread = HandlerThread("vireglass-probe").apply { start() }
    probeThread = thread
    val handler = Handler(thread.looper)
    probeHandler = handler
    val reader = ImageReader.newInstance(
      PROBE_W,
      PROBE_H,
      PixelFormat.RGBA_8888,
      2,
      HardwareBuffer.USAGE_GPU_COLOR_OUTPUT or HardwareBuffer.USAGE_CPU_READ_OFTEN,
    )
    reader.setOnImageAvailableListener({ r -> readProbe(r) }, handler)
    probeReader = reader
    val pn = RenderNode("vireglass-probe")
    probeNode = pn
    val renderer = HardwareRenderer().apply {
      setSurface(reader.surface)
      setContentRoot(pn)
    }
    probeRenderer = renderer
    return renderer
  }

  private fun readProbe(reader: ImageReader) {
    val image = try {
      reader.acquireLatestImage()
    } catch (e: Throwable) {
      null
    } ?: return
    try {
      val plane = image.planes[0]
      val buf = plane.buffer
      val rowStride = plane.rowStride
      val pixelStride = plane.pixelStride
      val luma = FloatArray(PROBE_W * PROBE_H)
      val color = FloatArray(PROBE_W * PROBE_H * 3)
      for (y in 0 until PROBE_H) {
        for (x in 0 until PROBE_W) {
          val o = y * rowStride + x * pixelStride
          val r = (buf.get(o).toInt() and 0xFF) / 255f
          val g = (buf.get(o + 1).toInt() and 0xFF) / 255f
          val b = (buf.get(o + 2).toInt() and 0xFF) / 255f
          val i = y * PROBE_W + x
          luma[i] = 0.2126f * r + 0.7152f * g + 0.0722f * b
          color[i * 3] = r
          color[i * 3 + 1] = g
          color[i * 3 + 2] = b
        }
      }
      lumaGrid = luma
      colorGrid = color
    } catch (e: Throwable) {
      Log.w("GlassLens", "снимок зонда не прочитался", e)
    } finally {
      // Кадр закрывается на потоке зонда и может опоздать: releaseProbe с главного потока
      // уже закрыл reader, и тогда close() кидает IllegalStateException.
      try {
        image.close()
      } catch (e: Throwable) {
      }
    }
    mainHandler.post { for (lens in lenses) lens.onBackdropProbed() }
  }

  private fun releaseProbe() {
    probeRenderer?.let {
      it.stop()
      // Поверхность отвязывается ДО destroy: иначе рантайм пишет «A resource failed to call
      // Surface.release» на каждый пересозданный зонд.
      it.setSurface(null)
      it.destroy()
    }
    probeRenderer = null
    probeReader?.close()
    probeReader = null
    probeNode?.discardDisplayList()
    probeNode = null
    probeThread?.quitSafely()
    probeThread = null
    probeHandler = null
    lumaGrid = null
    colorGrid = null
  }

  companion object {
    /**
     * Сетка зонда. Клетка обязана быть МЕЛЬЧЕ той фактуры, которую нужно различать: на
     * 16×32 клетка выходила 67 пикселей, и шахматка 8 dp усреднялась в ровный серый —
     * зонд честно сообщал «фон однородный», а надпись поверх стекла тонула в клетках.
     * При 48×96 клетка около 22 пикселей, то есть размера самой мелкой фактуры продукта.
     * Разбор идёт на фоновом потоке раз в PROBE_INTERVAL_MS, в кадровый бюджет не попадает.
     */
    const val PROBE_W = 48
    const val PROBE_H = 96

    /** Частота снимка. Адаптация всё равно едет по времени порядка полусекунды, поэтому
     *  чаще смысла нет, а кадровый бюджет это трогать не должно. */
    const val PROBE_INTERVAL_MS = 180L
  }
}
