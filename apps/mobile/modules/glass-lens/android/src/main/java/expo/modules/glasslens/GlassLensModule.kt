package expo.modules.glasslens

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class GlassLensModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GlassLens")

    // `createRuntimeShaderEffect` появился в Android 13. Ниже — вьюха работает как обычный
    // контейнер, а JS оставляет прежнее аффинное увеличение как фолбэк.
    Constants("isSupported" to (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU))

    View(GlassLensView::class) {
      Name("GlassLensView")

      // Светлота фона под стеклом. Событие, а не проп: приложение обязано узнать предел,
      // за которым стекло уже не разведёт себя с надписью, и перекрасить надпись само.
      Events("onBackdropSample")

      Prop("backdropId") { view: GlassLensView, value: Int? -> view.backdropId = value }
      Prop("shaderSource") { view: GlassLensView, value: String -> view.shaderSource = value }
      Prop("glassWidth") { view: GlassLensView, value: Float -> view.glassWidth = value }
      Prop("glassHeight") { view: GlassLensView, value: Float -> view.glassHeight = value }
      // Весь материал — одним каналом: имя ↔ размер ↔ значение приезжают вместе, поэтому
      // рассинхрон с шейдером больше невозможен молча (см. applyChannel).
      Prop("uniformNames") { view: GlassLensView, value: List<String> -> view.uniformNames = value }
      Prop("uniformValues") { view: GlassLensView, value: List<Double> -> view.uniformValues = value }
      Prop("uniformSizes") { view: GlassLensView, value: List<Int> -> view.uniformSizes = value }

      OnViewDidUpdateProps { view: GlassLensView -> view.applyEffect() }
    }

    // Захват фона: пишет своих детей в RenderNode, линза берёт его как content.
    View(GlassBackdropView::class) {
      Name("GlassBackdropView")
    }

    // Диагностический зонд (docs/vireglass/ADR-001): показывает, какие пиксели реально
    // приходят в createRuntimeShaderEffect. В продовом UI не используется.
    View(GlassProbeView::class) {
      Name("GlassProbeView")
      Prop("mode") { view: GlassProbeView, value: Float -> view.mode = value }
      OnViewDidUpdateProps { view: GlassProbeView -> view.applyEffect() }
    }
  }
}
