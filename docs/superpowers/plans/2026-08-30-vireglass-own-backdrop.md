# Свой захват фона для VireGlass

## Зачем

`dimezisBlurView` снимает фон в уменьшенный 8-битный битмап и растягивает обратно —
внутри стекла стоит решётка блоков с шагом ~7 dp. Замеры и опровергнутые гипотезы:
`docs/vireglass/material-lab.md` §E-23. Усреднением в шейдере не лечится (−24% ценой
радиуса 14 dp и втрое большей выборки).

## Решение

Захват держим в **RenderNode**, а не в битмапе: `beginRecording` даёт GPU-канву, запись
списка отрисовки не платит растеризацией, поэтому разрешение остаётся полным и
промежуточного 8-битного шага нет вовсе.

```
GlassBackdropView (ExpoView, ViewGroup)
  onPreDraw → node.beginRecording(w, h) → super.dispatchDraw(canvas) → endRecording()
           → invalidate() всем зарегистрированным линзам
GlassLensView
  onDraw → canvas.translate(позиция бэкдропа − своя) → canvas.drawRenderNode(node)
  RenderEffect берёт нарисованное как `content` — как раньше брал рисунок BlurView
```

Прятать линзу при захвате НЕ нужно: стекло приложения и так живёт вне поддерева цели
(`BlurTargetScope` отдаёт `null` потребителям внутри неё — иначе `prepareTreeImpl` уходил
в бесконечную рекурсию). Поэтому в записываемом поддереве линз нет.

## Что меняем

| Файл | Что |
|---|---|
| `modules/glass-lens/android/.../GlassBackdropView.kt` | новый: запись детей в RenderNode на onPreDraw |
| `.../GlassLensView.kt` | проп `backdropId`, резолв вьюхи, отрисовка RenderNode со смещением |
| `.../GlassLensModule.kt` | регистрация вьюхи и пропа |
| `modules/glass-lens/index.ts` | экспорт `GlassBackdrop`, тип пропа |
| `lib/blur-target.tsx` | контекст отдаёт ещё и тег бэкдропа |
| `components/glass-backdrop.tsx` | новый: пара «expo-цель для фолбэка + свой бэкдроп» |
| `components/vireglass/glass-surface.tsx` | на пути линзы — `backdropId` вместо ребёнка-BlurView |
| 5 экранов + 3 потребителя | замена `BlurTargetView` на `GlassBackdrop`, проброс тега |

expo-blur остаётся ТОЛЬКО на фолбэке ниже Android 13 (там нет
`createRuntimeShaderEffect`, и вьюха работает обычной лупой).

## Проверка

Тот же замер, что в §E-23: зерно внутри стекла над идеально ровным тёмным участком
(снаружи 0.000). Цель — 0.000 или околонулевое против нынешних 0.834.
