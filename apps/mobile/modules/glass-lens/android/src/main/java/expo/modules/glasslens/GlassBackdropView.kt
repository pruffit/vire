package expo.modules.glasslens

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.RenderNode
import android.graphics.drawable.ColorDrawable
import android.os.Build
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
 * Три вещи, на которых эта реализация уже ломалась, — держать в голове при правках:
 *
 * 1. Запись обязана идти из `dispatchDraw`. В `onPreDraw` ещё нет валидного контекста
 *    отрисовки, и `super.dispatchDraw` в отдельно созданную канву кладёт ПУСТОТУ.
 * 2. Узел нельзя класть на ту же канву, которая его только что записала: на экран уходит
 *    несвежий кадр, и сцена выглядит замерзшей, хотя анимация идёт. Детей рисуем напрямую,
 *    узел отдаём только линзе.
 * 3. Перезапись надо заказывать каждый кадр из `onPreDraw`: список отрисовки этой вьюхи сам
 *    не перестраивается, когда меняются только дети — он ссылается на их узлы.
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
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    viewTreeObserver.addOnPreDrawListener(onPreDraw)
  }

  override fun onDetachedFromWindow() {
    viewTreeObserver.removeOnPreDrawListener(onPreDraw)
    // Список линз НЕ чистим: ссылки слабые, а бэкдроп может пере-подключиться к окну, и
    // тогда линзы остались бы без обновлений навсегда.
    node?.discardDisplayList()
    super.onDetachedFromWindow()
  }
}
