// Цель Android. AGSL и SkSL — один язык, поэтому `lens-shader.ts`/`surface-shader.ts` уже
// собирают готовый AGSL-текст строкой (SDF + тело через `${VG_SDF}`) — переводить нечего.
// Тождество здесь фиксирует контракт "вход = выход" как отдельную цель, симметричную
// `targets/glsl.ts`, и защищает нативный путь от случайной правки при будущем рефакторе.
export function toAGSL(shaderSource: string): string {
  return shaderSource;
}
