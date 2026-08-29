/**
 * Бюджет одновременных стеклянных поверхностей.
 *
 * Цифры не выдуманы: замер на устройстве (Xiaomi 2311DRK48G, Android 16, release, 120 Гц,
 * `docs/vireglass/benchmarks/2026-08-29-scaling-validation.md`) даёт 113–120 кадров/с на
 * 1–6 поверхностях, 101 на семи и 80 и ниже на девяти. Цена — в ЧИСЛЕ поверхностей, а не
 * в площади: полноширинная панель ×11.4 по площади держит 120 кадров/с, а семь мелких
 * кнопок — 101. Каждая поверхность несёт свой `BlurView`, перерисовывающий весь экран.
 */

export const GLASS_GREEN_MAX = 6;

/** Сколько поверхностей несёт каждый элемент интерфейса. */
export const GLASS_SURFACES = {
  /** Таб-бар — раздельные круглые кнопки, каждая своя поверхность. */
  tabBar: 4,
  miniPlayer: 1,
  sheet: 1,
  searchField: 1,
  /** Фуллскрин-плеер: кнопка закрытия + ряд транспорта. */
  playerControls: 2,
  /** Крупная контентная плашка (шапка артиста) — одна поверхность независимо от площади. */
  contentPlate: 1,
} as const;

export type GlassElement = keyof typeof GLASS_SURFACES;

/**
 * Пока открыт sheet, нижние поверхности гасят живой бэкдроп: они за скримом, и преломлять
 * им нечего. Это предписывает сам кит («нижний слой на время открытия снэпшотится»), и это
 * же чинит единственный сценарий, который выбивался из зелёной зоны:
 * поиск + мини-плеер + таб-бар + sheet давали 7.
 */
export const SUPPRESSED_BY_SHEET: readonly GlassElement[] = [
  'tabBar',
  'miniPlayer',
  'searchField',
  'contentPlate',
];

export function countSurfaces(elements: readonly GlassElement[]): number {
  const sheetOpen = elements.includes('sheet');
  return elements
    .filter((e) => !(sheetOpen && SUPPRESSED_BY_SHEET.includes(e)))
    .reduce((sum, e) => sum + GLASS_SURFACES[e], 0);
}

/** Достижимые обычными действиями пользователя состояния — не искусственные. */
export const REACHABLE_SCENARIOS: Record<string, readonly GlassElement[]> = {
  'экран без плеера': ['tabBar'],
  'обычная работа с играющим треком': ['tabBar', 'miniPlayer'],
  'поиск с играющим треком': ['tabBar', 'miniPlayer', 'searchField'],
  'поиск + шит «в плейлист»': ['tabBar', 'miniPlayer', 'searchField', 'sheet'],
  'экран артиста с играющим треком': ['tabBar', 'miniPlayer', 'contentPlate'],
  'артист + шит': ['tabBar', 'miniPlayer', 'contentPlate', 'sheet'],
  'фуллскрин-плеер': ['playerControls'],
  'фуллскрин-плеер + шит': ['playerControls', 'sheet'],
};
