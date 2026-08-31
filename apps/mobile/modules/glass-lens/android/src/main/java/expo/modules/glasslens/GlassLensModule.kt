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

      Prop("shaderSource") { view: GlassLensView, value: String -> view.shaderSource = value }
      Prop("glassWidth") { view: GlassLensView, value: Float -> view.glassWidth = value }
      Prop("glassHeight") { view: GlassLensView, value: Float -> view.glassHeight = value }
      Prop("cornerRadius") { view: GlassLensView, value: Float -> view.cornerRadius = value }
      Prop("bevel") { view: GlassLensView, value: Float -> view.bevel = value }
      Prop("magnify") { view: GlassLensView, value: Float -> view.magnify = value }
      Prop("edgePush") { view: GlassLensView, value: Float -> view.edgePush = value }
      Prop("chroma") { view: GlassLensView, value: Float -> view.chroma = value }
      Prop("spherical") { view: GlassLensView, value: Float -> view.spherical = value }
      Prop("frost") { view: GlassLensView, value: Float -> view.frost = value }
      Prop("adapt") { view: GlassLensView, value: Float -> view.adapt = value }
      Prop("adaptTarget") { view: GlassLensView, value: Float -> view.adaptTarget = value }
      Prop("fresnel") { view: GlassLensView, value: Float -> view.fresnel = value }
      Prop("fresnelPower") { view: GlassLensView, value: Float -> view.fresnelPower = value }
      Prop("reflectReach") { view: GlassLensView, value: Float -> view.reflectReach = value }
      Prop("morphX") { view: GlassLensView, value: Float -> view.morphX = value }
      Prop("morphY") { view: GlassLensView, value: Float -> view.morphY = value }
      Prop("morphWidth") { view: GlassLensView, value: Float -> view.morphWidth = value }
      Prop("morphHeight") { view: GlassLensView, value: Float -> view.morphHeight = value }
      Prop("morphCorner") { view: GlassLensView, value: Float -> view.morphCorner = value }
      Prop("morphSmoothing") { view: GlassLensView, value: Float -> view.morphSmoothing = value }
      Prop("debug") { view: GlassLensView, value: Float -> view.debug = value }

      OnViewDidUpdateProps { view: GlassLensView -> view.applyEffect() }
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
