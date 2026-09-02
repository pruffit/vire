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
  /** Фуллскрин-плеер: единственное стекло экрана — полоса текста на обложке. Транспорт
   *  плоский: под ним затемнённый ambient-фон, преломлять там нечего. */
  playerLyrics: 1,
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

/**
 * Фуллскрин-плеер перекрывает всё приложение, но таб-бар и мини-плеер остаются
 * смонтированными под ним (он — модальный экран корневого стека). Без подавления
 * получалось бы 4 + 1 + 2 = 7 поверхностей — за пределами измеренной зелёной зоны.
 * Поэтому плеер поднимает тот же счётчик, что и лист.
 */
export const FULLSCREEN_PLAYER: readonly GlassElement[] = ['playerLyrics'];

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
  'фуллскрин-плеер': ['playerLyrics'],
  'фуллскрин-плеер + шит': ['playerLyrics', 'sheet'],
  // Плеер открыт поверх табов и мини-плеера — те остаются смонтированными.
  'фуллскрин-плеер поверх табов': ['tabBar', 'miniPlayer', ...FULLSCREEN_PLAYER],
};

/**
 * Живой бэкдроп нужен, только когда стекло включено и поверх ничего не открыто.
 *
 * `topLayer` — для поверхностей САМОГО верхнего слоя: экран, который поднял счётчик листов,
 * глушит то, что осталось под ним, но не себя. Без этой оговорки фуллскрин-плеер выключал
 * собственное стекло, и панель текста рисовалась непрозрачной плашкой — ровно тем, за что
 * материал и ругают.
 */
export function backdropAllowed(
  { glassEnabled, openSheets }: { glassEnabled: boolean; openSheets: number },
  topLayer: boolean,
): boolean {
  return glassEnabled && (topLayer || openSheets === 0);
}
