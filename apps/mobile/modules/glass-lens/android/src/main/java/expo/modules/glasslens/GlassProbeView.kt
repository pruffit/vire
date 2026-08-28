package expo.modules.glasslens

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.RenderEffect
import android.graphics.RuntimeShader
import android.os.Build
import android.util.Log
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

// Диагностический зонд для одного вопроса: КАКИЕ пиксели попадают в шейдер
// `RenderEffect.createRuntimeShaderEffect`. Документация говорит «содержимое RenderNode,
// на который эффект повешен, вместе с детьми», но на это опирается вся архитектура
// VireGlass, поэтому проверяется экспериментом, а не цитатой.
//
// Шейдер намеренно тривиален: возвращает выборку как есть, без оптики. Что увидим на
// экране — то шейдер и получил.
//
// Продовую GlassLensView не трогает: отдельный класс, отдельное имя вьюхи.
private const val PROBE_AGSL = """
uniform shader content;
uniform float2 u_size;
uniform float  u_mode;

half4 main(float2 xy) {
  half4 c = content.eval(xy);

  // mode 0 — сырая выборка: видно ровно то, что пришло в шейдер.
  if (u_mode < 0.5) { return c; }

  // mode 1 — маркер живости шейдера: диагональная штриховка поверх выборки.
  // Отличает «шейдер получил прозрачность» от «шейдер не применился вовсе».
  if (u_mode < 1.5) {
    float stripe = step(0.5, fract((xy.x + xy.y) / 40.0));
    half3 marker = half3(1.0, 0.0, 1.0) * half(stripe * 0.35);
    return half4(c.rgb + marker * (1.0 - c.a), max(c.a, half(stripe * 0.35)));
  }

  // mode 2 — карта альфы выборки, непрозрачная. Однозначный ответ на вопрос §9:
  // белое = в шейдер пришло непрозрачное содержимое, чёрное = не пришло ничего.
  // Полутон в границах вьюхи — полупрозрачный захват (BlurView с тинтом).
  return half4(c.a, c.a, c.a, 1.0);
}
"""

@SuppressLint("ViewConstructor")
class GlassProbeView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val shader = try {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) RuntimeShader(PROBE_AGSL) else null
  } catch (e: Throwable) {
    Log.e("GlassProbe", "AGSL зонда не скомпилировался", e)
    null
  }

  /** 0 — сырая выборка, 1 — выборка + маркер живости шейдера. */
  var mode = 0f

  fun applyEffect() {
    val effect = shader ?: run {
      Log.w("GlassProbe", "шейдера нет — эффект не наложен")
      return
    }
    if (width <= 0 || height <= 0) return

    effect.setFloatUniform("u_size", width.toFloat(), height.toFloat())
    effect.setFloatUniform("u_mode", mode)
    setRenderEffect(RenderEffect.createRuntimeShaderEffect(effect, "content"))
    Log.i("GlassProbe", "эффект наложен: ${width}x$height mode=$mode")
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    applyEffect()
  }
}
